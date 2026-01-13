
import { BotConfig } from "../types";

export const generatePythonBot = (config: BotConfig): string => {
  return `
"""
================================================================================
   🤖 GEMINI AI TRADER - HYBRID LOCAL CORE (PYTHON v4.0)
================================================================================

[ 架構說明 / ARCHITECTURE ]
此腳本設計為「本地執行核心 (Execution Core)」。
1. 它負責：連接交易所、執行 AI 決策、下單、以及將資料寫入本地 SQLite 資料庫。
2. 它解決了瀏覽器長時間運行可能崩潰的問題。
3. 您可以繼續使用 Web App 觀看 Binance 的即時餘額變動，作為「監控儀表板」。

[ 部署步驟 / SETUP ]

1. 安裝 Python (Install Python 3.9+):
   https://www.python.org/downloads/

2. 安裝必要套件 (Install dependencies):
   pip install ccxt pandas pandas_ta google-genai openai python-dotenv colorama

3. 設定環境變數 (.env):
   Create a .env file in the same folder:
   BINANCE_API_KEY=your_binance_api_key
   BINANCE_SECRET_KEY=your_binance_secret_key
   API_KEY=your_gemini_api_key
   GROK_API_KEY=your_xai_key (Optional)

4. 啟動機器人:
   python ai_trader.py

================================================================================
"""

import ccxt
import pandas as pd
import pandas_ta as ta
import time
import json
import os
import sqlite3
import logging
import sys
import traceback
from datetime import datetime
from google import genai
from openai import OpenAI
from dotenv import load_dotenv
from colorama import init, Fore, Style

# Load environment variables
load_dotenv()
init(autoreset=True)

# --- CONFIGURATION ---
SYMBOL = "${config.symbol.replace('/', '')}" 
TIMEFRAME = "1m" 
RISK_LEVEL = "${config.riskLevel}"
INTERVAL_SEC = ${config.minPulse / 1000}
DB_FILE = "trading_data.db"

API_KEY_BINANCE = os.getenv("BINANCE_API_KEY")
API_SECRET_BINANCE = os.getenv("BINANCE_SECRET_KEY")
GEMINI_API_KEY = os.getenv("API_KEY") 
GROK_API_KEY = os.getenv("GROK_API_KEY")

# --- LOGGING & DATABASE ---
logging.basicConfig(
    filename='bot_system.log', 
    level=logging.INFO, 
    format='%(asctime)s - %(levelname)s - %(message)s'
)

def init_db():
    """ Initialize SQLite Database for persistent storage """
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    # Table: Trades
    c.execute('''CREATE TABLE IF NOT EXISTS trades
                 (id INTEGER PRIMARY KEY AUTOINCREMENT, 
                  timestamp REAL, 
                  symbol TEXT, 
                  side TEXT, 
                  price REAL, 
                  amount REAL, 
                  cost REAL, 
                  reason TEXT)''')
    # Table: Logs (AI Thoughts)
    c.execute('''CREATE TABLE IF NOT EXISTS ai_logs
                 (id INTEGER PRIMARY KEY AUTOINCREMENT, 
                  timestamp REAL, 
                  category TEXT, 
                  message TEXT, 
                  confidence REAL)''')
    conn.commit()
    conn.close()
    print_log("Database initialized (SQLite).", "INFO")

def save_trade_to_db(side, price, amount, cost, reason):
    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        c.execute("INSERT INTO trades (timestamp, symbol, side, price, amount, cost, reason) VALUES (?, ?, ?, ?, ?, ?, ?)",
                  (time.time(), SYMBOL, side, price, amount, cost, reason))
        conn.commit()
        conn.close()
    except Exception as e:
        print_log(f"DB Error: {e}", "ERROR")

def save_log_to_db(category, message, confidence=0):
    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        c.execute("INSERT INTO ai_logs (timestamp, category, message, confidence) VALUES (?, ?, ?, ?)",
                  (time.time(), category, message, confidence))
        conn.commit()
        conn.close()
    except Exception as e:
        print_log(f"DB Error: {e}", "ERROR")

def print_log(msg, type="INFO"):
    timestamp = datetime.now().strftime("%H:%M:%S")
    color = Fore.CYAN
    if type == "TRADE": color = Fore.GREEN
    elif type == "ALERT": color = Fore.YELLOW
    elif type == "ERROR": color = Fore.RED
    elif type == "COUNCIL": color = Fore.MAGENTA
    elif type == "SCOUT": color = Fore.BLUE
    
    print(f"{color}[{timestamp}] {type}: {msg}")
    logging.info(msg)

# --- EXCHANGE CONNECTION ---
try:
    exchange = ccxt.binance({
        'apiKey': API_KEY_BINANCE,
        'secret': API_SECRET_BINANCE,
        'enableRateLimit': True,
        'options': {'defaultType': 'spot'} 
    })
    exchange.load_markets()
except Exception as e:
    print_log(f"Binance Config Error: {e}", "ERROR")
    print("Please check your API Keys in .env")
    sys.exit()

# --- AI CLIENTS ---
if not GEMINI_API_KEY:
    print_log("CRITICAL: GEMINI_API_KEY missing in .env", "ERROR")
    sys.exit()

client = genai.Client(api_key=GEMINI_API_KEY)
grok_client = OpenAI(api_key=GROK_API_KEY, base_url="https://api.x.ai/v1") if GROK_API_KEY else None

class HybridBot:
    def __init__(self):
        self.position = None 
        self.last_council_time = 0
        init_db()
        self.sync_state()

    def sync_state(self):
        """ Sync local state with actual exchange balance """
        try:
            balance = exchange.fetch_balance()
            base = SYMBOL.replace("USDT", "")
            amount = balance['total'].get(base, 0)
            ticker = exchange.fetch_ticker(SYMBOL)
            price = ticker['last']
            val = amount * price
            
            if val > 15: # Valid position threshold
                print_log(f"Resumed Position: {amount:.4f} {base} (\${val:.2f})", "INFO")
                # Resume logic (simplified)
                self.position = {
                    'amount': amount,
                    'entry_price': price, # Approximation if restart
                    'stop_loss': price * 0.90, 
                    'highest_price': price
                }
            else:
                self.position = None
        except Exception as e:
            print_log(f"Sync Error: {e}", "ERROR")

    def get_market_data(self):
        try:
            ohlcv = exchange.fetch_ohlcv(SYMBOL, TIMEFRAME, limit=100)
            df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
            df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
            
            # Indicators
            df['RSI'] = df.ta.rsi(length=14)
            df['ATR'] = df.ta.atr(length=14)
            df['EMA50'] = df.ta.ema(length=50)
            
            return df
        except Exception as e:
            print_log(f"Data Error: {e}", "ERROR")
            return None

    def ask_scout(self, data):
        """ Gemini Flash Scout """
        prompt = f"""
        Role: Crypto Scout. 
        Data: Price={data['close']}, RSI={data['RSI']}, ATR={data['ATR']}.
        Task: Return JSON {{ "alert": bool, "reason": "brief" }}
        Conditions: Alert if RSI < 30 (Oversold) or RSI > 70 (Overbought) or Price breakout.
        """
        try:
            res = client.models.generate_content(
                model='gemini-2.0-flash-exp', 
                contents=prompt,
                config={'response_mime_type': 'application/json'}
            )
            return json.loads(res.text)
        except:
            return {"alert": False}

    def ask_council(self, data, grok_opinion=""):
        """ Gemini Pro Council """
        pos_txt = "HOLDING" if self.position else "CASH"
        prompt = f"""
        Role: Trading Council Chairman.
        Asset: {SYMBOL}. Status: {pos_txt}. Risk: {RISK_LEVEL}.
        
        [Market]
        Price: {data['close']}
        RSI: {data['RSI']:.2f}
        ATR: {data['ATR']:.4f}
        Trend: {'UP' if data['close'] > data['EMA50'] else 'DOWN'}
        
        [Risk (Grok)] {grok_opinion}
        
        Output JSON:
        {{
            "action": "BUY" | "SELL" | "HOLD",
            "confidence": 0-100,
            "reasoning": "string",
            "size_pct": 0.1-1.0
        }}
        """
        try:
            res = client.models.generate_content(
                model='gemini-2.0-flash-exp',
                contents=prompt,
                config={'response_mime_type': 'application/json'}
            )
            return json.loads(res.text)
        except Exception as e:
            print_log(f"Council Fail: {e}", "ERROR")
            return {"action": "HOLD", "confidence": 0}

    def execute_trade(self, action, current_price, size_pct=0.5, reason=""):
        try:
            if action == 'BUY' and not self.position:
                # Get Balance
                bal = exchange.fetch_balance()['USDT']['free']
                cost = bal * size_pct
                if cost < 10: return
                
                amount = cost / current_price
                # EXECUTE ORDER
                # order = exchange.create_market_buy_order(SYMBOL, cost) # UNCOMMENT FOR REAL MONEY
                
                print_log(f"🔵 BUY: \${cost:.2f} @ {current_price} | {reason}", "TRADE")
                save_trade_to_db("BUY", current_price, amount, cost, reason)
                
                self.position = {
                    'amount': amount,
                    'entry_price': current_price,
                    'stop_loss': current_price * 0.95,
                    'highest_price': current_price
                }

            elif action == 'SELL' and self.position:
                amount = self.position['amount']
                # EXECUTE ORDER
                # order = exchange.create_market_sell_order(SYMBOL, amount) # UNCOMMENT FOR REAL MONEY
                
                revenue = amount * current_price
                print_log(f"🔴 SELL: \${revenue:.2f} @ {current_price} | {reason}", "TRADE")
                save_trade_to_db("SELL", current_price, amount, revenue, reason)
                
                self.position = None
                
        except Exception as e:
            print_log(f"Exec Error: {e}", "ERROR")

    def run(self):
        print_log(f"🚀 System Started. Monitoring {SYMBOL}...", "INFO")
        
        while True:
            try:
                df = self.get_market_data()
                if df is None: 
                    time.sleep(10)
                    continue
                
                curr = df.iloc[-1]
                price = curr['close']
                
                # 1. Stop Loss Check (Local Priority)
                if self.position:
                    # Update Trailing High
                    if price > self.position['highest_price']:
                        self.position['highest_price'] = price
                        # Dynamic SL update logic could go here
                        
                    if price < self.position['stop_loss']:
                        self.execute_trade('SELL', price, 1.0, "Stop Loss Hit")
                        continue

                # 2. AI Cycle
                now = time.time()
                if now - self.last_council_time > INTERVAL_SEC:
                    scout = self.ask_scout(curr)
                    
                    if scout.get('alert'):
                        print_log(f"👀 Scout Alert: {scout['reason']}", "SCOUT")
                        
                        grok_msg = ""
                        # if grok_client: ... (Grok logic)
                        
                        decision = self.ask_council(curr, grok_msg)
                        
                        save_log_to_db("COUNCIL", decision.get('reasoning'), decision.get('confidence'))
                        print_log(f"🧠 Decision: {decision['action']} ({decision['confidence']}%)", "COUNCIL")
                        
                        if decision['confidence'] > 75:
                            self.execute_trade(decision['action'], price, decision.get('size_pct', 0.5), decision.get('reasoning'))
                        
                        self.last_council_time = now
                    else:
                        pass
                        # print_log("Scout: Market Quiet", "SCOUT")

            except Exception as e:
                print_log(f"Loop Error: {e}", "ERROR")
                traceback.print_exc()
            
            time.sleep(10)

if __name__ == "__main__":
    bot = HybridBot()
    bot.run()
`;
};
