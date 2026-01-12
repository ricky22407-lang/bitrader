export const pythonBotCode = `
# -*- coding: utf-8 -*-
"""
AI Binance Trading Bot (Phase 7: Refactored & Optimized)
版本: v7.0 (Modular Architecture)
架構:
  1. ConfigManager: 配置管理
  2. ExchangeAdapter: 交易所交互 (CCXT + WebSocket)
  3. NewsAgent: 新聞情感分析
  4. AIBrain: Gemini LLM 決策核心
  5. RiskManager: 風控與移動止損計算
  6. PositionTracker: 持倉狀態管理
  7. BotEngine: 主控邏輯與事件循環
  8. GUI: Tkinter 使用者介面
功能: 實時串流、模擬/實盤切換、AI 分析、新聞整合、自動風控、Telegram 通知
"""

import sys
import subprocess
import importlib
import threading
import time
import json
import os
import logging
import queue
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple

# -----------------------------------------------------------------------------
# 0. 依賴檢查與安裝
# -----------------------------------------------------------------------------

REQUIRED_LIBS = {
    'ccxt': 'ccxt',
    'pandas': 'pandas',
    'pandas_ta': 'pandas_ta',
    'google.generativeai': 'google-generativeai',
    'telebot': 'pyTelegramBotAPI',
    'requests': 'requests',
    'websocket-client': 'websocket-client',
    'dotenv': 'python-dotenv'
}

def check_dependencies():
    """檢查並自動安裝缺少的依賴庫"""
    for import_name, install_name in REQUIRED_LIBS.items():
        try:
            if import_name == 'websocket-client':
                import websocket
            else:
                importlib.import_module(import_name)
        except ImportError:
            print(f"📦 正在安裝 {install_name}...")
            try:
                subprocess.check_call([sys.executable, "-m", "pip", "install", install_name])
            except Exception as e:
                print(f"❌ 安裝失敗 {install_name}: {e}")
                sys.exit(1)

check_dependencies()

import ccxt
import pandas as pd
import pandas_ta as ta
import google.generativeai as genai
import telebot
import requests
import websocket
import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox

# -----------------------------------------------------------------------------
# 1. 基礎組件 (Config, Notification, Logging)
# -----------------------------------------------------------------------------

class ConfigManager:
    """管理系統配置與參數"""
    def __init__(self, filepath="config.json"):
        self.filepath = filepath
        self.defaults = {
            "binance_key": "", "binance_secret": "",
            "gemini_key": "", "cryptopanic_key": "",
            "tg_token": "", "tg_chat": "",
            "risk_pct": 2.0, "max_drawdown": 15.0, "trailing_stop": 1.5,
            "max_symbols": 5, "sim_initial_balance": 10000.0,
            "is_sim": True, "is_testnet": False
        }
        self.data = self.load()

    def load(self) -> Dict[str, Any]:
        if os.path.exists(self.filepath):
            try:
                with open(self.filepath, "r", encoding='utf-8') as f:
                    loaded = json.load(f)
                    # Merge with defaults
                    for k, v in self.defaults.items():
                        if k not in loaded: loaded[k] = v
                    return loaded
            except: pass
        return self.defaults.copy()

    def save(self, new_data: Dict[str, Any]):
        self.data.update(new_data)
        with open(self.filepath, "w", encoding='utf-8') as f:
            json.dump(self.data, f, indent=4)

    def get(self, key: str) -> Any:
        return self.data.get(key, self.defaults.get(key))

class TelegramNotifier:
    """處理 Telegram 訊息推送"""
    def __init__(self, token: str, chat_id: str):
        self.bot = None
        self.chat_id = chat_id
        if token:
            try:
                self.bot = telebot.TeleBot(token)
            except Exception as e:
                logging.error(f"Telegram Init Error: {e}")

    def send(self, message: str):
        if self.bot and self.chat_id:
            try:
                self.bot.send_message(self.chat_id, message)
            except Exception as e:
                logging.error(f"TG Send Error: {e}")

class GuiLogHandler(logging.Handler):
    """將 Log 輸出導向至 Tkinter Text Widget"""
    def __init__(self, text_widget):
        super().__init__()
        self.text_widget = text_widget

    def emit(self, record):
        msg = self.format(record)
        def _append():
            self.text_widget.configure(state='normal')
            self.text_widget.insert(tk.END, msg + '\\n')
            self.text_widget.see(tk.END)
            self.text_widget.configure(state='disabled')
        try:
            self.text_widget.after(0, _append)
        except: pass

# -----------------------------------------------------------------------------
# 2. 數據與分析 (News, Indicators, AI)
# -----------------------------------------------------------------------------

class NewsAgent:
    """負責獲取與緩存 CryptoPanic 新聞數據"""
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.cache = "系統初始化中..."
        self.last_fetch_time = 0
        self.cache_duration = 300  # 5分鐘緩存

    def get_market_sentiment(self) -> str:
        if not self.api_key:
            return "新聞 API 未配置"
        
        if time.time() - self.last_fetch_time < self.cache_duration:
            return self.cache

        try:
            url = f"https://cryptopanic.com/api/v1/posts/?auth_token={self.api_key}&public=true&filter=important"
            resp = requests.get(url, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                results = data.get('results', [])
                if results:
                    titles = [f"• {item['title']}" for item in results[:3]]
                    self.cache = "\\n".join(titles)
                else:
                    self.cache = "近期無重大新聞"
                self.last_fetch_time = time.time()
                return self.cache
        except Exception as e:
            logging.error(f"News Fetch Error: {e}")
        return self.cache

class TechnicalAnalyzer:
    """計算技術指標"""
    @staticmethod
    def calculate(ohlcv: List[list]) -> Dict[str, float]:
        if not ohlcv: return {}
        try:
            df = pd.DataFrame(ohlcv, columns=['time', 'open', 'high', 'low', 'close', 'vol'])
            # RSI
            df['rsi'] = ta.rsi(df['close'], length=14)
            # MACD
            macd = ta.macd(df['close'])
            df['macd'] = macd['MACD_12_26_9']
            df['macd_signal'] = macd['MACDs_12_26_9']
            # ATR
            df['atr'] = ta.atr(df['high'], df['low'], df['close'], length=14)
            
            last = df.iloc[-1]
            return {
                'price': float(last['close']),
                'rsi': float(last['rsi']),
                'macd': float(last['macd']),
                'macd_signal': float(last['macd_signal']),
                'atr': float(last['atr'])
            }
        except Exception as e:
            logging.error(f"TA Error: {e}")
            return {}

class AIBrain:
    """Gemini LLM 決策核心"""
    def __init__(self, api_key: str):
        self.enabled = False
        if api_key:
            try:
                genai.configure(api_key=api_key)
                self.model = genai.GenerativeModel('gemini-pro')
                self.enabled = True
            except: pass

    def get_trading_decision(self, symbol: str, price: float, techs: Dict, 
                             position: Optional[Dict], is_sim: bool, news: str) -> Dict:
        if not self.enabled:
            return {'action': 'HOLD', 'confidence': 0, 'reason': 'AI Disabled'}

        mode_str = "SIMULATION (Paper Trading)" if is_sim else "REAL TRADING"
        pos_str = f"{position['side']} (PnL: {position['pnl_pct']:.2f}%)" if position else "NO POSITION"

        prompt = f"""
        Role: Senior Crypto Trader. Analyze the market for {symbol}.
        
        [Context]
        Mode: {mode_str} | Price: {price}
        Position: {pos_str}
        
        [News Sentiment]
        {news}
        
        [Technical Indicators]
        RSI(14): {techs.get('rsi', 0):.1f} (Over 70=Overbought, Under 30=Oversold)
        MACD: {techs.get('macd', 0):.4f} | Signal: {techs.get('macd_signal', 0):.4f}
        ATR: {techs.get('atr', 0):.4f} (Volatility)
        
        [Instructions]
        1. Synthesize News and Technicals. News overrides weak technicals.
        2. High confidence (>70) required for entry.
        3. Output strict JSON.
        
        JSON Format:
        {{
            "action": "OPEN_LONG" | "OPEN_SHORT" | "CLOSE" | "HOLD",
            "confidence": <0-100 integer>,
            "reason": "<Concise Traditional Chinese reasoning>",
            "expectation": "<Short prediction>"
        }}
        """
        try:
            response = self.model.generate_content(prompt)
            clean_text = response.text.replace('\`\`\`json', '').replace('\`\`\`', '').strip()
            return json.loads(clean_text)
        except Exception as e:
            logging.error(f"AI Brain Error: {e}")
            return {'action': 'HOLD', 'confidence': 0, 'reason': 'AI Error'}

# -----------------------------------------------------------------------------
# 3. 交易所連接與數據流 (Exchange & WebSocket)
# -----------------------------------------------------------------------------

class WebSocketStream(threading.Thread):
    """處理 Binance WebSocket 實時行情"""
    def __init__(self, symbols: List[str], callback_price, callback_candle):
        super().__init__()
        self.symbols = [s.lower().replace('/', '') for s in symbols]
        self.cb_price = callback_price
        self.cb_candle = callback_candle
        self.ws = None
        self.running = False
        self.daemon = True

    def run(self):
        self.running = True
        streams = '/'.join([f"{s}@kline_1m" for s in self.symbols])
        url = f"wss://fstream.binance.com/stream?streams={streams}"
        
        self.ws = websocket.WebSocketApp(url,
            on_message=self._on_message,
            on_error=self._on_error,
            on_close=self._on_close)
        self.ws.run_forever()

    def _on_message(self, ws, message):
        if not self.running: return
        try:
            data = json.loads(message)
            if 'data' in data:
                k = data['data']['k']
                symbol = k['s'][:-4] + '/' + k['s'][-4:] # BTCUSDT -> BTC/USDT
                price = float(k['c'])
                is_closed = k['x']
                
                self.cb_price(symbol, price)
                if is_closed:
                    self.cb_candle(symbol, price)
        except: pass

    def _on_error(self, ws, error):
        logging.error(f"WS Error: {error}")

    def _on_close(self, ws, *args):
        logging.info("WebSocket Closed")
        self.running = False

    def stop(self):
        self.running = False
        if self.ws: self.ws.close()

class ExchangeAdapter:
    """統一管理 CCXT 交互與 WebSocket 生命週期"""
    def __init__(self, config: Dict[str, Any]):
        self.cfg = config
        self.client = None
        self.stream = None
        
    def connect(self) -> bool:
        try:
            self.client = ccxt.binance({
                'apiKey': self.cfg['binance_key'],
                'secret': self.cfg['binance_secret'],
                'enableRateLimit': True,
                'options': {'defaultType': 'future'}
            })
            if self.cfg['is_testnet'] and not self.cfg['is_sim']:
                self.client.set_sandbox_mode(True)
            self.client.load_markets()
            return True
        except Exception as e:
            logging.error(f"Exchange Connect Error: {e}")
            return False

    def start_stream(self, symbols: List[str], on_price, on_candle):
        self.stream = WebSocketStream(symbols, on_price, on_candle)
        self.stream.start()

    def stop_stream(self):
        if self.stream: self.stream.stop()

    def fetch_ohlcv(self, symbol: str) -> List[list]:
        try:
            return self.client.fetch_ohlcv(symbol, timeframe='1h', limit=50)
        except: return []

    def get_real_balance(self) -> float:
        try:
            bal = self.client.fetch_balance()
            return float(bal['total']['USDT'])
        except: return 0.0

    def get_real_positions(self) -> List[Dict]:
        try:
            raw = self.client.fetch_positions()
            positions = []
            for p in raw:
                amt = float(p.get('contracts', p['info'].get('positionAmt', 0)))
                if amt != 0:
                    positions.append({
                        'symbol': p['symbol'],
                        'side': 'LONG' if amt > 0 else 'SHORT',
                        'amount': abs(amt),
                        'entry': float(p['entryPrice']),
                        'pnl': float(p['unrealizedPnl']),
                        'mark_price': float(p.get('markPrice', 0))
                    })
            return positions
        except: return []

    def create_market_order(self, symbol: str, side: str, amount: float):
        # side: 'buy' or 'sell'
        return self.client.create_order(symbol, 'market', side, amount)

# -----------------------------------------------------------------------------
# 4. 風控與狀態管理 (Risk & Position)
# -----------------------------------------------------------------------------

class RiskManager:
    """計算倉位大小、追蹤止損邏輯"""
    def __init__(self, risk_pct: float, trailing_stop_pct: float):
        self.risk_pct = risk_pct
        self.trailing_stop_pct = trailing_stop_pct

    def calculate_size(self, balance: float, price: float) -> float:
        # Simple percentage of balance for this demo
        # In prod, should use stop loss distance
        value = balance * (self.risk_pct / 100)
        return value / price

    def check_trailing_stop(self, position: Dict, current_price: float) -> bool:
        """檢查是否觸發移動止損"""
        if position['side'] == 'LONG':
            # Update High Water Mark
            if current_price > position.get('high_mark', -1):
                position['high_mark'] = current_price
            
            # Check Drawdown from High
            threshold = position['high_mark'] * (1 - self.trailing_stop_pct / 100)
            return current_price < threshold
        
        elif position['side'] == 'SHORT':
            # Update Low Water Mark
            if current_price < position.get('low_mark', 99999999):
                position['low_mark'] = current_price
            
            # Check Drawdown from Low (Price rising)
            threshold = position['low_mark'] * (1 + self.trailing_stop_pct / 100)
            return current_price > threshold
            
        return False

class PositionTracker:
    """管理持倉狀態 (兼容模擬與實盤數據結構)"""
    def __init__(self):
        # {symbol: {side, amount, entry, pnl, pnl_pct, high_mark, low_mark}}
        self.positions = {}
        self.sim_balance = 0.0

    def init_sim_balance(self, balance: float):
        self.sim_balance = balance

    def update_sim_pnl(self, symbol: str, current_price: float):
        if symbol in self.positions:
            pos = self.positions[symbol]
            if pos['side'] == 'LONG':
                pos['pnl'] = (current_price - pos['entry']) * pos['amount']
            else:
                pos['pnl'] = (pos['entry'] - current_price) * pos['amount']
            
            invested = pos['entry'] * pos['amount']
            pos['pnl_pct'] = (pos['pnl'] / invested * 100) if invested > 0 else 0

    def open_sim_position(self, symbol: str, side: str, price: float, amount: float):
        fee = price * amount * 0.0005 # 0.05% fee
        self.sim_balance -= fee
        
        self.positions[symbol] = {
            'side': side,
            'amount': amount,
            'entry': price,
            'pnl': 0.0,
            'pnl_pct': 0.0,
            'high_mark': price,
            'low_mark': price
        }

    def close_sim_position(self, symbol: str, price: float):
        if symbol in self.positions:
            pos = self.positions[symbol]
            fee = price * pos['amount'] * 0.0005
            self.sim_balance += (pos['pnl'] - fee)
            del self.positions[symbol]
            return pos['pnl']
        return 0.0

# -----------------------------------------------------------------------------
# 5. 主引擎 (BotEngine)
# -----------------------------------------------------------------------------

class BotEngine:
    """核心控制器：協調 AI, Exchange, GUI"""
    def __init__(self, config_manager: ConfigManager, gui_callbacks: Dict):
        self.cfg_mgr = config_manager
        self.cbs = gui_callbacks
        self.running = False
        
        # Components
        self.adapter = None
        self.notifier = None
        self.news_agent = None
        self.brain = None
        self.risk_mgr = None
        self.tracker = None
        
        # State
        self.equity_peak = 0.0
        self.start_equity = 0.0
        self.last_report_date = datetime.now().strftime("%Y-%m-%d")

    def initialize(self):
        cfg = self.cfg_mgr.data
        
        # Init Subsystems
        self.adapter = ExchangeAdapter(cfg)
        self.notifier = TelegramNotifier(cfg['tg_token'], cfg['tg_chat'])
        self.news_agent = NewsAgent(cfg['cryptopanic_key'])
        self.brain = AIBrain(cfg['gemini_key'])
        self.risk_mgr = RiskManager(cfg['risk_pct'], cfg['trailing_stop'])
        self.tracker = PositionTracker()
        
        if cfg['is_sim']:
            self.tracker.init_sim_balance(float(cfg['sim_initial_balance']))
            
        if self.adapter.connect():
            self.log("✅ 交易所連線成功")
            mode = "🧪 模擬模式" if cfg['is_sim'] else "🔥 實盤模式"
            self.notifier.send(f"🤖 機器人啟動 | {mode} | 追蹤止損: {cfg['trailing_stop']}%")
            return True
        else:
            self.log("❌ 交易所連線失敗")
            return False

    def log(self, msg: str):
        self.cbs['log'](msg)

    def start(self):
        self.running = True
        cfg = self.cfg_mgr.data
        
        # Get Active Symbols
        try:
            tickers = self.adapter.client.fetch_tickers()
            valid = {k: v for k, v in tickers.items() if '/USDT' in k}
            sorted_t = sorted(valid.items(), key=lambda x: float(x[1]['quoteVolume']), reverse=True)
            active_symbols = [x[0] for x in sorted_t[:cfg['max_symbols']]]
        except:
            active_symbols = ['BTC/USDT', 'ETH/USDT']
            
        self.log(f"👀 監控目標: {', '.join(active_symbols)}")
        
        # Initial Balance Sync
        self._sync_equity()
        self.start_equity = self._get_total_equity()
        self.equity_peak = self.start_equity

        # Start Streams
        self.adapter.start_stream(active_symbols, self._on_price, self._on_candle)
        
        # Start Main Loop Thread
        threading.Thread(target=self._main_loop, daemon=True).start()

    def stop(self):
        self.running = False
        if self.adapter:
            self.adapter.stop_stream()
        self.log("🛑 系統已停止")

    def _main_loop(self):
        """主循環: UI更新與每日報告"""
        while self.running:
            try:
                # 1. Update Equity & Drawdown
                current_eq = self._get_total_equity()
                if current_eq > self.equity_peak: self.equity_peak = current_eq
                dd = (self.equity_peak - current_eq) / self.equity_peak * 100 if self.equity_peak > 0 else 0
                
                # 2. Daily Report
                today = datetime.now().strftime("%Y-%m-%d")
                if today != self.last_report_date:
                    self._send_daily_report(current_eq)
                    self.last_report_date = today

                # 3. Update GUI
                self.cbs['update_ui']({
                    'equity': current_eq,
                    'drawdown': dd
                })
                
                pos_list = []
                for sym, pos in self.tracker.positions.items():
                    pos_list.append((
                        sym, pos['side'], 
                        f"{pos['amount']:.4f}", 
                        f"{pos['entry']:.2f}", 
                        f"{pos['pnl']:.2f} ({pos['pnl_pct']:.1f}%)"
                    ))
                self.cbs['update_pos'](pos_list)

                # 4. Check Hard Drawdown Stop
                if dd > self.cfg_mgr.data['max_drawdown']:
                    self.log(f"🚨 觸發最大回撤 ({dd:.2f}%)，停止交易！")
                    self.notifier.send(f"🚨 警報: 帳戶回撤過大，機器人已暫停。")
                    self.stop()
                    break

            except Exception as e:
                logging.error(f"Loop Error: {e}")
            
            time.sleep(1)

    def _sync_equity(self):
        """同步真實帳戶餘額 (僅實盤)"""
        if not self.cfg_mgr.data['is_sim']:
            bal = self.adapter.get_real_balance()
            # 實盤需要從 API 獲取倉位並更新到 tracker
            real_pos = self.adapter.get_real_positions()
            self.tracker.positions = {} # Reset
            for p in real_pos:
                # Map real pos to internal structure
                self.tracker.positions[p['symbol']] = {
                    'side': p['side'], 'amount': p['amount'], 'entry': p['entry'],
                    'pnl': p['pnl'], 'pnl_pct': 0, # Calculated later
                    'high_mark': p['entry'], 'low_mark': p['entry'] # Reset marks on restart
                }

    def _get_total_equity(self) -> float:
        if self.cfg_mgr.data['is_sim']:
            pnl = sum(p['pnl'] for p in self.tracker.positions.values())
            return self.tracker.sim_balance + pnl
        else:
            # For real mode, approximation based on balance + unrealized
            return self.adapter.get_real_balance() + sum(p['pnl'] for p in self.tracker.positions.values())

    def _send_daily_report(self, current_eq):
        pnl = current_eq - self.start_equity
        pct = (pnl / self.start_equity * 100) if self.start_equity > 0 else 0
        msg = f"📅 [日報] {self.last_report_date}\n權益: {current_eq:.2f}\n損益: {pnl:.2f} ({pct:.2f}%)"
        self.log(msg)
        self.notifier.send(msg)

    # --- Callbacks ---

    def _on_price(self, symbol: str, price: float):
        """WS 價格更新 -> 更新 PnL 與 檢查止損"""
        # 1. Update Sim PnL
        if self.cfg_mgr.data['is_sim']:
            self.tracker.update_sim_pnl(symbol, price)
        
        # 2. Check Trailing Stop
        pos = self.tracker.positions.get(symbol)
        if pos:
            if self.risk_mgr.check_trailing_stop(pos, price):
                self.log(f"📉 [止損] {symbol} 觸發追蹤止損")
                self._execute_close(symbol, price, "Trailing Stop")

    def _on_candle(self, symbol: str, close_price: float):
        """WS K線收盤 -> 觸發 AI 分析"""
        threading.Thread(target=self._run_analysis, args=(symbol, close_price)).start()

    def _run_analysis(self, symbol: str, price: float):
        try:
            # 1. Fetch Data
            ohlcv = self.adapter.fetch_ohlcv(symbol)
            techs = TechnicalAnalyzer.calculate(ohlcv)
            news = self.news_agent.get_market_sentiment()
            pos = self.tracker.positions.get(symbol)
            is_sim = self.cfg_mgr.data['is_sim']
            
            # 2. AI Decide
            decision = self.brain.get_trading_decision(symbol, price, techs, pos, is_sim, news)
            
            if decision['confidence'] > 60:
                self.log(f"🧠 {symbol}: {decision['action']} ({decision['confidence']}%)")
            
            # 3. Execute
            if decision['confidence'] >= 70:
                self._process_decision(symbol, price, decision, pos)
                
        except Exception as e:
            logging.error(f"Analysis Error {symbol}: {e}")

    def _process_decision(self, symbol: str, price: float, decision: Dict, pos: Dict):
        action = decision['action']
        reason = decision.get('reason', '')
        
        if action == 'OPEN_LONG' and not pos:
            self.notifier.send(f"🚀 AI 做多 {symbol}\n理由: {reason}")
            self._execute_open(symbol, 'LONG', price)
            
        elif action == 'OPEN_SHORT' and not pos:
            self.notifier.send(f"📉 AI 做空 {symbol}\n理由: {reason}")
            self._execute_open(symbol, 'SHORT', price)
            
        elif action == 'CLOSE' and pos:
            self.notifier.send(f"💰 AI 平倉 {symbol}\n理由: {reason}")
            self._execute_close(symbol, price, "AI Signal")

    def _execute_open(self, symbol: str, side: str, price: float):
        amount = self.risk_mgr.calculate_size(self._get_total_equity(), price)
        is_sim = self.cfg_mgr.data['is_sim']
        
        if is_sim:
            self.tracker.open_sim_position(symbol, side, price, amount)
            self.log(f"🧪 [Sim] 開倉 {side} {symbol} x{amount:.4f}")
        else:
            # Real Order
            try:
                order_side = 'buy' if side == 'LONG' else 'sell'
                precision_amt = self.adapter.client.amount_to_precision(symbol, amount)
                self.adapter.create_market_order(symbol, order_side, precision_amt)
                self.log(f"⚡ [Real] 市價單 {side} {symbol}")
                # Real positions synced in next loop
            except Exception as e:
                self.log(f"下單失敗: {e}")

    def _execute_close(self, symbol: str, price: float, reason: str):
        is_sim = self.cfg_mgr.data['is_sim']
        pos = self.tracker.positions.get(symbol)
        if not pos: return

        if is_sim:
            pnl = self.tracker.close_sim_position(symbol, price)
            self.log(f"🧪 [Sim] 平倉 {symbol} | PnL: {pnl:.2f} | {reason}")
        else:
            try:
                side = 'buy' if pos['side'] == 'SHORT' else 'sell'
                self.adapter.create_market_order(symbol, side, pos['amount'])
                self.log(f"⚡ [Real] 平倉 {symbol} | {reason}")
            except Exception as e:
                self.log(f"平倉失敗: {e}")

# -----------------------------------------------------------------------------
# 6. GUI 使用者介面 (Tkinter)
# -----------------------------------------------------------------------------

class TradingBotApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("AI Binance Bot v7.0 (Modular)")
        self.geometry("1100x900")
        self.protocol("WM_DELETE_WINDOW", self.on_close)
        
        self.cfg_mgr = ConfigManager()
        self.bot = None
        self.vars = {}
        
        self._init_vars()
        self._build_layout()
        self._load_config_to_ui()

    def _init_vars(self):
        keys = ["binance_key", "binance_secret", "gemini_key", "cryptopanic_key", 
                "tg_token", "tg_chat", "risk_pct", "max_drawdown", "trailing_stop", 
                "max_symbols", "sim_initial_balance", "is_sim", "is_testnet"]
        for k in keys:
            val = self.cfg_mgr.data.get(k)
            if isinstance(val, bool): self.vars[k] = tk.BooleanVar(value=val)
            elif isinstance(val, (int, float)): self.vars[k] = tk.DoubleVar(value=val)
            else: self.vars[k] = tk.StringVar(value=str(val))

    def _build_layout(self):
        style = ttk.Style()
        style.theme_use('clam')
        
        main_frame = ttk.Frame(self, padding=10)
        main_frame.pack(fill='both', expand=True)

        # 1. Top Panel (Config)
        cfg_frame = ttk.LabelFrame(main_frame, text="⚙️ 系統參數配置", padding=10)
        cfg_frame.pack(fill='x', pady=5)
        
        # Grid Layout for Config
        entries = [
            ("Binance API Key", "binance_key", True), ("Binance Secret", "binance_secret", True),
            ("Gemini API Key", "gemini_key", True), ("CryptoPanic Key", "cryptopanic_key", True),
            ("TG Token", "tg_token", False), ("TG Chat ID", "tg_chat", False)
        ]
        
        for i, (lbl, key, is_pass) in enumerate(entries):
            r, c = divmod(i, 2)
            f = ttk.Frame(cfg_frame)
            f.grid(row=r, column=c, sticky='w', padx=10, pady=2)
            ttk.Label(f, text=lbl+":", width=15).pack(side='left')
            ttk.Entry(f, textvariable=self.vars[key], show='*' if is_pass else '', width=30).pack(side='left')

        # Numeric Settings
        nums = [
            ("風險 %", "risk_pct"), ("最大回撤 %", "max_drawdown"), 
            ("追蹤止損 %", "trailing_stop"), ("監控幣種數", "max_symbols"),
            ("模擬資金", "sim_initial_balance")
        ]
        num_f = ttk.Frame(cfg_frame)
        num_f.grid(row=3, column=0, columnspan=2, sticky='w', padx=10, pady=5)
        for lbl, key in nums:
            ttk.Label(num_f, text=lbl).pack(side='left', padx=(0,2))
            ttk.Entry(num_f, textvariable=self.vars[key], width=8).pack(side='left', padx=(0,10))

        # Checkboxes
        chk_f = ttk.Frame(cfg_frame)
        chk_f.grid(row=4, column=0, columnspan=2, sticky='w', padx=10)
        ttk.Checkbutton(chk_f, text="啟用模擬模式 (Paper Trading)", variable=self.vars['is_sim']).pack(side='left', padx=10)
        ttk.Checkbutton(chk_f, text="Binance Testnet", variable=self.vars['is_testnet']).pack(side='left')
        
        ttk.Button(cfg_frame, text="💾 保存設定", command=self.save_config).grid(row=4, column=1, sticky='e')

        # 2. Dashboard Panel
        dash_frame = ttk.LabelFrame(main_frame, text="📊 實時戰情室", padding=10)
        dash_frame.pack(fill='x', pady=5)
        
        self.lbl_equity = ttk.Label(dash_frame, text="$---", font=("Arial", 24, "bold"), foreground="#2980b9")
        self.lbl_equity.pack(side='left', padx=20)
        
        self.lbl_dd = ttk.Label(dash_frame, text="DD: 0.0%", font=("Arial", 12), foreground="red")
        self.lbl_dd.pack(side='left', padx=20)
        
        self.btn_start = ttk.Button(dash_frame, text="▶ 啟動機器人", command=self.toggle_bot)
        self.btn_start.pack(side='right', padx=10, fill='y')

        # 3. Positions Table
        pos_frame = ttk.LabelFrame(main_frame, text="📈 持倉監控", padding=10)
        pos_frame.pack(fill='x', pady=5)
        
        cols = ("Symbol", "Side", "Amount", "Entry", "PnL")
        self.tree = ttk.Treeview(pos_frame, columns=cols, show='headings', height=6)
        for c in cols:
            self.tree.heading(c, text=c)
            self.tree.column(c, anchor='center', width=120)
        self.tree.pack(fill='x')

        # 4. Logs
        log_frame = ttk.LabelFrame(main_frame, text="📝 系統日誌", padding=10)
        log_frame.pack(fill='both', expand=True, pady=5)
        
        self.txt_log = scrolledtext.ScrolledText(log_frame, height=10, state='disabled')
        self.txt_log.pack(fill='both', expand=True)
        
        # Setup Logger
        h = GuiLogHandler(self.txt_log)
        h.setFormatter(logging.Formatter('%(asctime)s %(message)s', '%H:%M:%S'))
        root_log = logging.getLogger()
        root_log.addHandler(h)
        root_log.setLevel(logging.INFO)

    def _load_config_to_ui(self):
        pass # Already linked via vars

    def save_config(self):
        new_data = {}
        for k, v in self.vars.items():
            new_data[k] = v.get()
        self.cfg_mgr.save(new_data)
        messagebox.showinfo("系統", "配置已保存！")

    def update_ui_stats(self, data):
        self.lbl_equity.config(text=f"\${data['equity']:.2f}")
        self.lbl_dd.config(text=f"回撤: {data['drawdown']:.2f}%")

    def update_positions(self, items):
        for i in self.tree.get_children(): self.tree.delete(i)
        for val in items: self.tree.insert('', 'end', values=val)

    def toggle_bot(self):
        if self.bot and self.bot.running:
            self.bot.stop()
            self.btn_start.config(text="▶ 啟動機器人")
        else:
            # Sync vars back to config manager before start
            self.save_config()
            self.bot = BotEngine(self.cfg_mgr, {
                'log': logging.info,
                'update_ui': self.update_ui_stats,
                'update_pos': self.update_positions
            })
            
            if self.bot.initialize():
                self.bot.start()
                self.btn_start.config(text="⏹ 停止機器人")

    def on_close(self):
        if self.bot: self.bot.stop()
        self.destroy()

if __name__ == "__main__":
    app = TradingBotApp()
    app.mainloop()
`;
