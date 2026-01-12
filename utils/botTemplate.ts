export const pythonBotCode = `
import os
import time
import logging
import json
import re
import ccxt
import pandas as pd
import pandas_ta as ta
import google.generativeai as genai
import telebot
import backtrader as bt
from dotenv import load_dotenv
from datetime import datetime

# -----------------------------------------------------------------------------
# 配置與初始化 (Configuration & Init)
# -----------------------------------------------------------------------------

# 配置日誌 (繁體中文)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("ai_trader.log", encoding='utf-8'),
        logging.StreamHandler()
    ]
)

# 載入環境變數 (.env)
load_dotenv()
BINANCE_API_KEY = os.getenv('BINANCE_API_KEY')
BINANCE_SECRET_KEY = os.getenv('BINANCE_SECRET_KEY')
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
TELEGRAM_TOKEN = os.getenv('TELEGRAM_TOKEN')
TELEGRAM_CHAT_ID = os.getenv('TELEGRAM_CHAT_ID')
IS_TESTNET = os.getenv('IS_TESTNET', 'True').lower() == 'true'

# -----------------------------------------------------------------------------
# AI 決策引擎 (AI Decision Engine)
# -----------------------------------------------------------------------------

class GeminiBrain:
    def __init__(self, api_key):
        if not api_key:
            logging.warning("⚠️ 未檢測到 Gemini API Key，AI 決策將被禁用")
            self.model = None
            return
        
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-pro')
        logging.info("🧠 Gemini AI 模組已就緒")

    def analyze(self, symbol, df, strategy_type="Momentum"):
        if not self.model:
            return {'action': 'HOLD', 'confidence': 0, 'reasoning': 'No API Key'}

        # 準備市場數據摘要
        last_row = df.iloc[-1]
        prev_row = df.iloc[-2]
        
        market_context = f"""
        Symbol: {symbol}
        Time: {datetime.now()}
        Price: {last_row['close']}
        RSI(14): {last_row['rsi']:.2f}
        MACD: {last_row['macd']:.2f} (Signal: {last_row['macd_signal']:.2f})
        Bollinger Bands: Upper={last_row['bbe']:.2f}, Lower={last_row['bbl']:.2f}
        ATR(14): {last_row['atr']:.2f}
        Volume Change: {((last_row['volume'] - prev_row['volume']) / prev_row['volume']) * 100:.1f}%
        Strategy: {strategy_type}
        """

        prompt = f"""
        你是一個頂尖的加密貨幣交易員，請根據以下技術指標與市場狀況進行分析。
        
        市場數據:
        {market_context}
        
        任務:
        1. 分析當前趨勢 (牛市/熊市/盤整)。
        2. 判斷入場時機 (是否符合 {strategy_type} 策略)。
        3. 給出操作建議。
        
        請嚴格輸出 JSON 格式:
        {{
            "action": "BUY" | "SELL" | "HOLD",
            "confidence": 0-100 (整數),
            "reasoning": "繁體中文簡述 (50字以內)",
            "stop_loss": 建議止損價,
            "take_profit": 建議止盈價
        }}
        """

        try:
            response = self.model.generate_content(prompt)
            # 清理並解析 JSON
            text = response.text.strip()
            json_match = re.search(r'\{.*\}', text, re.DOTALL)
            if json_match:
                return json.loads(json_match.group(0))
        except Exception as e:
            logging.error(f"❌ AI 分析錯誤: {e}")
        
        return {'action': 'HOLD', 'confidence': 0, 'reasoning': 'Error in generation'}

# -----------------------------------------------------------------------------
# 交易機器人核心 (Trading Bot Core)
# -----------------------------------------------------------------------------

class AICryptoBot:
    def __init__(self):
        self.setup_exchange()
        self.ai = GeminiBrain(GEMINI_API_KEY)
        self.setup_telegram()
        
        # 配置參數
        self.symbols = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT']
        self.timeframe = '1h'
        self.risk_per_trade = 0.02  # 2% Account Equity per trade
        self.max_open_orders = 3
        self.active_positions = {}

    def setup_exchange(self):
        try:
            self.exchange = ccxt.binance({
                'apiKey': BINANCE_API_KEY,
                'secret': BINANCE_SECRET_KEY,
                'enableRateLimit': True,
                'options': {'defaultType': 'future'}  # 合約交易模式
            })
            if IS_TESTNET:
                self.exchange.set_sandbox_mode(True)
                logging.info("🧪 已切換至 Binance Testnet 模式")
            
            self.exchange.load_markets()
            logging.info("✅ 交易所連線成功")
        except Exception as e:
            logging.critical(f"❌ 交易所連線失敗: {e}")
            exit(1)

    def setup_telegram(self):
        if TELEGRAM_TOKEN and TELEGRAM_CHAT_ID:
            self.bot = telebot.TeleBot(TELEGRAM_TOKEN)
            self.chat_id = TELEGRAM_CHAT_ID
            logging.info("📱 Telegram 通知服務已啟動")
        else:
            self.bot = None

    def notify(self, message):
        logging.info(f"🔔 {message}")
        if self.bot:
            try:
                self.bot.send_message(self.chat_id, message)
            except Exception as e:
                logging.error(f"Telegram 發送失敗: {e}")

    def fetch_data(self, symbol, limit=100):
        try:
            bars = self.exchange.fetch_ohlcv(symbol, self.timeframe, limit=limit)
            df = pd.DataFrame(bars, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
            df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
            
            # 計算指標 (pandas_ta)
            df['rsi'] = ta.rsi(df['close'], length=14)
            df['macd'], df['macd_signal'], _ = ta.macd(df['close'])
            df['atr'] = ta.atr(df['high'], df['low'], df['close'], length=14)
            
            # 布林帶
            bb = ta.bbands(df['close'], length=20)
            df['bbl'] = bb['BBL_20_2.0']
            df['bbe'] = bb['BBU_20_2.0']
            
            return df
        except Exception as e:
            logging.error(f"數據獲取失敗 {symbol}: {e}")
            return None

    def calculate_position_size(self, stop_loss_price, current_price):
        try:
            balance = self.exchange.fetch_balance()['USDT']['free']
            risk_amount = balance * self.risk_per_trade
            
            # 止損距離
            risk_per_share = abs(current_price - stop_loss_price)
            if risk_per_share == 0: return 0
            
            amount = risk_amount / risk_per_share
            return amount
        except Exception:
            return 0

    def execute_trade(self, symbol, signal, current_price):
        action = signal['action']
        confidence = signal.get('confidence', 0)
        
        # 過濾低信心訊號
        if confidence < 75:
            logging.info(f"⏸️ {symbol} 訊號信心不足 ({confidence}%), 略過操作")
            return

        amount = 0.001 # 預設最小單位，實際應調用 calculate_position_size
        
        try:
            if action == 'BUY':
                logging.info(f"🚀 執行做多: {symbol}")
                # order = self.exchange.create_market_buy_order(symbol, amount)
                self.notify(f"🟢 [開倉做多] {symbol}\n價格: {current_price}\nAI 理由: {signal['reasoning']}")
                
            elif action == 'SELL':
                logging.info(f"🔻 執行做空: {symbol}")
                # order = self.exchange.create_market_sell_order(symbol, amount)
                self.notify(f"🔴 [開倉做空] {symbol}\n價格: {current_price}\nAI 理由: {signal['reasoning']}")
                
        except Exception as e:
            logging.error(f"❌ 下單失敗: {e}")
            self.notify(f"⚠️ 下單異常: {e}")

    def scan_and_trade(self):
        logging.info("🔄 開始市場掃描...")
        
        # 動態掃描：可加入根據 24h 交易量過濾 symbols 的邏輯
        
        for symbol in self.symbols:
            df = self.fetch_data(symbol)
            if df is None: continue
            
            # AI 分析
            signal = self.ai.analyze(symbol, df)
            current_price = df.iloc[-1]['close']
            
            logging.info(f"🤖 {symbol} 分析結果: {signal['action']} ({signal['confidence']}%)")
            
            if signal['action'] != 'HOLD':
                self.execute_trade(symbol, signal, current_price)
            
            time.sleep(1) # 避免 API Rate Limit

    def start(self):
        self.notify("🤖 AI 交易機器人已啟動 (Python Full Ver.)")
        while True:
            try:
                self.scan_and_trade()
                logging.info("💤 休眠 60 秒...")
                time.sleep(60)
            except KeyboardInterrupt:
                logging.info("🛑 機器人停止運行")
                break
            except Exception as e:
                logging.error(f"⚠️ 主循環錯誤: {e}")
                time.sleep(10)

# -----------------------------------------------------------------------------
# 回測模式 (Backtesting Mode)
# -----------------------------------------------------------------------------

class BacktestStrategy(bt.Strategy):
    def next(self):
        # 這裡可以整合簡單的指標策略進行回測驗證
        pass

def run_backtest():
    cerebro = bt.Cerebro()
    # 添加數據、策略...
    logging.info("回測功能開發中...")

# -----------------------------------------------------------------------------
# 主程式入口 (Main Entry)
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    # 可以通過參數切換模式
    bot = AICryptoBot()
    bot.start()
`;
