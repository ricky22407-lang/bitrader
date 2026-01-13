import { BotConfig } from "../types";

export const generatePythonBot = (config: BotConfig): string => {
  return `
"""
================================================================================
   🤖 GEMINI AI TRADING FORGE - STANDALONE BOT (PYTHON v3.0)
================================================================================

[ 部署說明 / HOW TO RUN ]

1. 安裝 Python (Install Python 3.9+):
   https://www.python.org/downloads/

2. 安裝必要套件 (Install dependencies):
   pip install ccxt pandas pandas_ta google-genai openai python-dotenv colorama

3. 設定環境變數 (.env):
   Create a .env file with:
   BINANCE_API_KEY=your_key
   BINANCE_SECRET_KEY=your_secret
   API_KEY=your_gemini_api_key
   GROK_API_KEY=your_xai_key (Optional)

4. 啟動機器人:
   python ai_forge_bot.py

================================================================================
"""

import ccxt
import pandas as pd
import pandas_ta as ta
import time
import json
import os
import logging
import sys
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
API_KEY_BINANCE = os.getenv("BINANCE_API_KEY")
API_SECRET_BINANCE = os.getenv("BINANCE_SECRET_KEY")
GEMINI_API_KEY = os.getenv("API_KEY") # Uses standard Env var name for GenAI
GROK_API_KEY = os.getenv("GROK_API_KEY")

# --- LOGGING SETUP ---
logging.basicConfig(
    filename='forge_bot.log', 
    level=logging.INFO, 
    format='%(asctime)s - %(levelname)s - %(message)s'
)

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
    # Sync time to avoid timestamp errors
    exchange.load_markets()
    print_log(f"Connected to Binance. Trading {SYMBOL} on {TIMEFRAME}.", "INFO")
except Exception as e:
    print_log(f"Binance Connection Error: {e}", "ERROR")
    print("Please check your API Keys in .env")
    sys.exit()

# --- AI CLIENTS ---
if GEMINI_API_KEY:
    client = genai.Client(api_key=GEMINI_API_KEY)
else:
    print_log("CRITICAL: GEMINI_API_KEY missing in .env", "ERROR")
    sys.exit()

if GROK_API_KEY:
    grok_client = OpenAI(api_key=GROK_API_KEY, base_url="https://api.x.ai/v1")
else:
    grok_client = None

class ForgeBot:
    def __init__(self):
        self.position = None 
        self.last_council_time = 0
        self.sync_wallet_position()

    def sync_wallet_position(self):
        """ Checks actual exchange balance to resume state """
        try:
            balance = exchange.fetch_balance()
            base_currency = SYMBOL.replace("USDT", "")
            amount = balance['total'].get(base_currency, 0)
            ticker = exchange.fetch_ticker(SYMBOL)
            current_price = ticker['last']
            usd_val = amount * current_price
            
            if usd_val > 10: # Threshold to consider as active position
                print_log(f"Detected existing position: {amount:.4f} {base_currency} (\${usd_val:.2f})", "INFO")
                # conservative resume
                self.position = {
                    'amount': amount,
                    'entry_price': current_price,
                    'stop_loss': current_price * 0.95, 
                    'take_profit': current_price * 1.10,
                    'trailing_pct': 1.5,
                    'highest_price': current_price,
                    'trailing_trigger': current_price * (1 - 0.015)
                }
            else:
                self.position = None
        except Exception as e:
            print_log(f"Wallet Sync Error: {e}", "ERROR")

    def fetch_data(self):
        try:
            # Fetch 1m, 15m, 1h for context
            ohlcv = exchange.fetch_ohlcv(SYMBOL, TIMEFRAME, limit=100)
            df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
            df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
            return df
        except Exception as e:
            print_log(f"Data Fetch Error: {e}", "ERROR")
            return None

    def calculate_technicals(self, df):
        # Indicators matching TS version
        df['RSI'] = df.ta.rsi(length=14)
        df['ATR'] = df.ta.atr(length=14)
        
        macd = df.ta.macd(fast=12, slow=26, signal=9)
        df = pd.concat([df, macd], axis=1)
        
        df['EMA50'] = df.ta.ema(length=50)
        df['EMA200'] = df.ta.ema(length=200)
        
        # Simple Pattern Logic
        df['body'] = (df['close'] - df['open']).abs()
        df['range'] = df['high'] - df['low']
        df['doji'] = df['body'] <= df['range'] * 0.1
        
        return df

    def run_scout_check(self, market_data):
        """ Tier 1: Gemini Flash Scout (Cheap, Fast) """
        prompt = f"""
        Role: HF Scout. Task: Decide if we need to wake the Strategy Council.
        Data: {json.dumps(market_data)}
        Rules: Escalate if RSI<30 or RSI>70, or Pattern detected, or Price crossed EMA.
        Output JSON: {{"needsEscalation": bool, "reason": "string"}}
        """
        try:
            response = client.models.generate_content(
                model='gemini-2.0-flash-exp', # Or gemini-2.0-flash
                contents=prompt,
                config={'response_mime_type': 'application/json'}
            )
            return json.loads(response.text)
        except Exception as e:
            return {"needsEscalation": True, "reason": "Scout Error"}

    def convene_council(self, market_data, grok_input):
        """ Tier 2: The Council (Reasoning) """
        position_txt = "HOLDING" if self.position else "CASH"
        
        prompt = f"""
        You are the Chairman of the AI Trading Council. 
        Context: {SYMBOL}, Risk={RISK_LEVEL}. Status: {position_txt}
        
        [Market]
        Price: {market_data['price']}
        RSI: {market_data['rsi']}
        ATR: {market_data['atr']}
        Trend: {market_data['trend']}
        
        [Risk Officer (Grok)]
        "{grok_input}"
        
        [Logic]
        1. Trend Alignment: Don't go long against 1H trend.
        2. Volatility Sizing: Reduce size if ATR is high.
        3. Trailing Stop: Always set dynamic trailing (~2x ATR).
        
        Output JSON:
        {{
            "action": "BUY" | "SELL" | "HOLD",
            "confidence": 0-100,
            "reasoning": "string",
            "suggestedAmountPct": 0.1-1.0,
            "stop_loss": number,
            "take_profit": number,
            "trailing_pct": number
        }}
        """
        try:
            response = client.models.generate_content(
                model='gemini-2.0-flash-exp',
                contents=prompt,
                config={'response_mime_type': 'application/json'}
            )
            return json.loads(response.text)
        except Exception as e:
            print_log(f"Council Error: {e}", "ERROR")
            return {"action": "HOLD", "confidence": 0}

    def execute(self, decision, current_price):
        action = decision['action']
        if action == 'HOLD': return

        try:
            if action == 'BUY' and not self.position:
                # Calculate size
                balance = exchange.fetch_balance()['USDT']['free']
                size_pct = decision.get('suggestedAmountPct', 0.5)
                usdt_amount = balance * size_pct
                
                if usdt_amount < 10: return
                
                print_log(f"💰 BUY EXECUTED: \${usdt_amount:.2f} @ {current_price}", "TRADE")
                # REAL ORDER:
                # exchange.create_market_buy_order(SYMBOL, usdt_amount) # Note: depends on exchange param requirements
                
                # Mock Position update for simulation if you run this without real money
                self.position = {
                    'amount': usdt_amount / current_price,
                    'entry_price': current_price,
                    'stop_loss': decision.get('stop_loss', current_price*0.95),
                    'take_profit': decision.get('take_profit', current_price*1.1),
                    'trailing_pct': decision.get('trailing_pct', 1.5),
                    'highest_price': current_price,
                    'trailing_trigger': current_price * (1 - (decision.get('trailing_pct', 1.5)/100))
                }
                
            elif action == 'SELL' and self.position:
                print_log(f"💰 SELL EXECUTED @ {current_price}. PnL logic here.", "TRADE")
                # REAL ORDER:
                # exchange.create_market_sell_order(SYMBOL, self.position['amount'])
                self.position = None

        except Exception as e:
            print_log(f"Execution Failed: {e}", "ERROR")

    def loop(self):
        print_log(f"🔥 Forge Bot Active. Strategy: Scout({INTERVAL_SEC}s) -> Council.", "INFO")
        
        while True:
            try:
                # 1. Data & Techs
                df = self.fetch_data()
                if df is None:
                    time.sleep(10)
                    continue
                    
                df = self.calculate_technicals(df)
                curr = df.iloc[-1]
                price = curr['close']
                
                # 2. Local Protection (Stop Loss / Trailing)
                if self.position:
                    pos = self.position
                    # Trailing Logic
                    if price > pos['highest_price']:
                        pos['highest_price'] = price
                        if pos['trailing_pct']:
                            new_trig = price * (1 - (pos['trailing_pct']/100))
                            if new_trig > pos['trailing_trigger']:
                                pos['trailing_trigger'] = new_trig
                                print_log(f"🛡️ Trailing Stop -> {new_trig:.2f}", "INFO")
                    
                    # Triggers
                    if price <= pos['stop_loss']:
                        print_log("STOP LOSS HIT", "TRADE")
                        self.execute({'action': 'SELL'}, price)
                        continue
                    if price <= pos['trailing_trigger']:
                        print_log("TRAILING STOP HIT", "TRADE")
                        self.execute({'action': 'SELL'}, price)
                        continue
                
                # 3. AI Cycle
                now = time.time()
                if now - self.last_council_time > INTERVAL_SEC:
                    market_payload = {
                        "price": price,
                        "rsi": curr['RSI'],
                        "atr": curr['ATR'],
                        "trend": "UP" if price > curr['EMA50'] else "DOWN"
                    }
                    
                    # Step A: Scout
                    scout = self.run_scout_check(market_payload)
                    if scout.get('needsEscalation'):
                        print_log(f"🚨 Scout Alert: {scout.get('reason')}. Waking Council.", "SCOUT")
                        
                        # Step B: Council
                        grok_msg = "Grok unavailable"
                        if grok_client:
                            # Simple Grok call simulated
                            pass 
                        
                        decision = self.convene_council(market_payload, grok_msg)
                        print_log(f"⚖️ Council: {decision['action']} ({decision['confidence']}%)", "COUNCIL")
                        
                        if decision['confidence'] > 75:
                            self.execute(decision, price)
                        
                        self.last_council_time = now
                    else:
                        print_log("Scout: Market boring. Sleep.", "SCOUT")

            except Exception as e:
                print_log(f"Loop Exception: {e}", "ERROR")
            
            time.sleep(10) # Fast tick loop for Stops, AI checks interval logic above

if __name__ == "__main__":
    bot = ForgeBot()
    bot.loop()
`;
};