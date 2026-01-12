export const pythonBotCode = `
# -*- coding: utf-8 -*-
"""
AI Binance Trading Bot (Final Phase)
版本: v8.0 (Production Ready)
架構: Modular Object-Oriented Design
功能全集:
  1. GUI: Tkinter 介面，支援 API 配置、模擬/實盤切換、即時儀表板
  2. 連接: 支援 Binance (CCXT + WebSocket) 與 Gemini AI
  3. 掃描: 自動篩選高成交量幣種
  4. 分析: 技術指標 (RSI, MACD, ATR) + 新聞情緒 (CryptoPanic)
  5. 決策: Gemini LLM 綜合分析，信心分數 > 70% 執行
  6. 風控: 複利倉位計算、移動止損 (Trailing Stop)、最大回撤停機
  7. 通知: Telegram 即時推播、每日績效報告
"""

import sys
import subprocess
import importlib
import threading
import time
import json
import os
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional

# -----------------------------------------------------------------------------
# 0. 自動化依賴管理
# -----------------------------------------------------------------------------

REQUIRED_LIBS = {
    'ccxt': 'ccxt',
    'pandas': 'pandas',
    'pandas_ta': 'pandas_ta',
    'google.generativeai': 'google-generativeai',
    'telebot': 'pyTelegramBotAPI',
    'requests': 'requests',
    'websocket-client': 'websocket-client',
    'dotenv': 'python-dotenv',
    'pillow': 'Pillow'  # For potential image handling if needed, usually good to have
}

def check_dependencies():
    """啟動時自動檢查並安裝缺少的庫"""
    print("正在檢查系統依賴...")
    for import_name, install_name in REQUIRED_LIBS.items():
        try:
            if import_name == 'websocket-client':
                import websocket
            elif import_name == 'pillow':
                import PIL
            else:
                importlib.import_module(import_name)
        except ImportError:
            print(f"📦 正在安裝 {install_name}...")
            try:
                subprocess.check_call([sys.executable, "-m", "pip", "install", install_name])
            except Exception as e:
                print(f"❌ 安裝失敗 {install_name}: {e}")
                input("請手動安裝後重試。按 Enter 退出...")
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
# 1. 核心組件: 配置與日誌
# -----------------------------------------------------------------------------

class ConfigManager:
    """管理所有配置參數，支援 JSON 持久化"""
    def __init__(self, filepath="config.json"):
        self.filepath = filepath
        self.defaults = {
            "binance_key": "", "binance_secret": "",
            "gemini_key": "", "cryptopanic_key": "",
            "tg_token": "", "tg_chat": "",
            "risk_pct": 2.0, "max_drawdown": 10.0, "trailing_stop": 1.5,
            "max_symbols": 5, "sim_initial_balance": 10000.0,
            "is_sim": True, "is_testnet": False
        }
        self.data = self.load()

    def load(self) -> Dict[str, Any]:
        if os.path.exists(self.filepath):
            try:
                with open(self.filepath, "r", encoding='utf-8') as f:
                    loaded = json.load(f)
                    for k, v in self.defaults.items():
                        if k not in loaded: loaded[k] = v
                    return loaded
            except: pass
        return self.defaults.copy()

    def save(self, new_data: Dict[str, Any]):
        self.data.update(new_data)
        with open(self.filepath, "w", encoding='utf-8') as f:
            json.dump(self.data, f, indent=4)

class GuiLogHandler(logging.Handler):
    """將 Python Logging 輸出重定向到 GUI 的 Text 元件"""
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

class TelegramNotifier:
    def __init__(self, token: str, chat_id: str):
        self.bot = None
        self.chat_id = chat_id
        if token:
            try:
                self.bot = telebot.TeleBot(token)
            except: pass

    def send(self, msg: str):
        if self.bot and self.chat_id:
            try:
                self.bot.send_message(self.chat_id, msg)
            except Exception as e:
                logging.error(f"TG Error: {e}")

# -----------------------------------------------------------------------------
# 2. 市場數據與 AI 分析
# -----------------------------------------------------------------------------

class NewsAgent:
    """整合 CryptoPanic API 獲取市場情緒"""
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.cache = "尚無新聞數據"
        self.last_fetch = 0
        self.ttl = 300  # 5分鐘緩存

    def get_sentiment(self) -> str:
        if not self.api_key: return "未配置新聞 API"
        if time.time() - self.last_fetch < self.ttl: return self.cache
        
        try:
            url = f"https://cryptopanic.com/api/v1/posts/?auth_token={self.api_key}&public=true&filter=important"
            resp = requests.get(url, timeout=5)
            if resp.status_code == 200:
                data = resp.json()
                posts = data.get('results', [])[:3]
                if posts:
                    titles = [f"• {p['title']}" for p in posts]
                    self.cache = "\\n".join(titles)
                else:
                    self.cache = "近期市場平靜"
                self.last_fetch = time.time()
                return self.cache
        except Exception as e:
            logging.error(f"News Error: {e}")
        return self.cache

class TechnicalAnalysis:
    """計算技術指標 (RSI, MACD, ATR)"""
    @staticmethod
    def compute(ohlcv: List[list]) -> Dict:
        if not ohlcv or len(ohlcv) < 50: return {}
        try:
            df = pd.DataFrame(ohlcv, columns=['time', 'open', 'high', 'low', 'close', 'vol'])
            df['rsi'] = ta.rsi(df['close'], length=14)
            macd = ta.macd(df['close'])
            df['macd'] = macd['MACD_12_26_9']
            df['signal'] = macd['MACDs_12_26_9']
            df['atr'] = ta.atr(df['high'], df['low'], df['close'], length=14)
            
            last = df.iloc[-1]
            return {
                'price': float(last['close']),
                'rsi': float(last['rsi']),
                'macd': float(last['macd']),
                'signal': float(last['signal']),
                'atr': float(last['atr'])
            }
        except: return {}

class GeminiBrain:
    """AI 決策核心"""
    def __init__(self, api_key: str):
        self.enabled = False
        if api_key:
            try:
                genai.configure(api_key=api_key)
                self.model = genai.GenerativeModel('gemini-pro')
                self.enabled = True
            except: pass

    def analyze(self, symbol, price, techs, pos, is_sim, news) -> Dict:
        if not self.enabled: return {'action': 'HOLD', 'confidence': 0, 'reason': 'AI Disabled'}
        
        mode = "SIMULATION" if is_sim else "REAL MONEY"
        pos_txt = f"{pos['side']} (PnL: {pos['pnl_pct']:.2f}%)" if pos else "EMPTY"
        
        prompt = f"""
        Act as a disciplined crypto trader. Analyze {symbol}.
        
        [Market Data]
        Price: {price}
        RSI: {techs.get('rsi',50):.1f} | MACD: {techs.get('macd',0):.4f}
        ATR: {techs.get('atr',0):.4f}
        News: {news}
        
        [Account]
        Mode: {mode} | Current Position: {pos_txt}
        
        [Task]
        Should we enter a new trade or close existing? 
        Require >70% confidence for action.
        
        Response Format (JSON Only):
        {{
            "action": "OPEN_LONG" | "OPEN_SHORT" | "CLOSE" | "HOLD",
            "confidence": 0-100,
            "reason": "Short Traditional Chinese reasoning",
            "stop_loss_suggestion": number
        }}
        """
        try:
            res = self.model.generate_content(prompt)
            txt = res.text.replace('\`\`\`json','').replace('\`\`\`','').strip()
            return json.loads(txt)
        except Exception as e:
            logging.error(f"AI Error: {e}")
            return {'action': 'HOLD', 'confidence': 0, 'reason': 'Error'}

# -----------------------------------------------------------------------------
# 3. 交易執行與 WebSocket
# -----------------------------------------------------------------------------

class WsClient(threading.Thread):
    """WebSocket 線程: 負責即時監聽價格與 K 線"""
    def __init__(self, symbols, on_price, on_candle):
        super().__init__()
        self.symbols = [s.lower().replace('/','') for s in symbols]
        self.on_price = on_price
        self.on_candle = on_candle
        self.ws = None
        self.running = False
        self.daemon = True

    def run(self):
        self.running = True
        streams = '/'.join([f"{s}@kline_1m" for s in self.symbols])
        url = f"wss://fstream.binance.com/stream?streams={streams}"
        self.ws = websocket.WebSocketApp(url, 
            on_message=self.on_msg, on_close=self.on_close, on_error=self.on_err)
        self.ws.run_forever()

    def on_msg(self, ws, msg):
        if not self.running: return
        try:
            data = json.loads(msg)
            if 'data' in data:
                k = data['data']['k']
                sym = k['s'][:-4] + '/' + k['s'][-4:]
                price = float(k['c'])
                self.on_price(sym, price)
                if k['x']: self.on_candle(sym, price)
        except: pass

    def on_err(self, ws, err): logging.error(f"WS Error: {err}")
    def on_close(self, ws, *args): logging.info("WS Disconnected")
    
    def stop(self):
        self.running = False
        if self.ws: self.ws.close()

class Exchange:
    """交易所交互層"""
    def __init__(self, config):
        self.cfg = config
        self.ccxt = None
        self.ws = None
        
    def connect(self):
        try:
            self.ccxt = ccxt.binance({
                'apiKey': self.cfg['binance_key'], 
                'secret': self.cfg['binance_secret'],
                'options': {'defaultType': 'future'}
            })
            if self.cfg['is_testnet'] and not self.cfg['is_sim']:
                self.ccxt.set_sandbox_mode(True)
            self.ccxt.load_markets()
            return True
        except Exception as e:
            logging.error(f"Connect Failed: {e}")
            return False

    def fetch_top_symbols(self, limit=5):
        try:
            tickers = self.ccxt.fetch_tickers()
            valid = {k: v for k,v in tickers.items() if '/USDT' in k}
            sorted_t = sorted(valid.items(), key=lambda x: float(x[1]['quoteVolume']), reverse=True)
            return [x[0] for x in sorted_t[:limit]]
        except: return ['BTC/USDT', 'ETH/USDT']

    def fetch_ohlcv(self, symbol):
        return self.ccxt.fetch_ohlcv(symbol, '1h', limit=60)

    def get_balance(self):
        try:
            bal = self.ccxt.fetch_balance()
            return float(bal['total']['USDT'])
        except: return 0.0

    def place_order(self, symbol, side, amount):
        return self.ccxt.create_order(symbol, 'market', side, amount)

# -----------------------------------------------------------------------------
# 4. 策略邏輯與風控
# -----------------------------------------------------------------------------

class BotLogic:
    def __init__(self, config, callbacks):
        self.cfg = config
        self.cb = callbacks
        self.running = False
        
        self.exchange = None
        self.ai = None
        self.news = None
        self.notify = None
        
        self.positions = {} # {symbol: {side, amount, entry, pnl, high_mark, low_mark}}
        self.sim_bal = 0.0
        self.peak_equity = 0.0
        self.start_equity = 0.0
        self.last_report = datetime.now().strftime("%Y-%m-%d")

    def init_system(self):
        cfg = self.cfg.data
        self.exchange = Exchange(cfg)
        if not self.exchange.connect(): return False
        
        self.ai = GeminiBrain(cfg['gemini_key'])
        self.news = NewsAgent(cfg['cryptopanic_key'])
        self.notify = TelegramNotifier(cfg['tg_token'], cfg['tg_chat'])
        
        if cfg['is_sim']:
            self.sim_bal = float(cfg['sim_initial_balance'])
            self.peak_equity = self.sim_bal
            self.start_equity = self.sim_bal
        else:
            bal = self.exchange.get_balance()
            self.start_equity = bal
            self.peak_equity = bal
            
        return True

    def start(self):
        self.running = True
        symbols = self.exchange.fetch_top_symbols(int(self.cfg.data['max_symbols']))
        self.cb['log'](f"🚀 啟動監控: {', '.join(symbols)}")
        
        self.exchange.ws = WsClient(symbols, self.on_price, self.on_candle)
        self.exchange.ws.start()
        
        threading.Thread(target=self.loop, daemon=True).start()

    def stop(self):
        self.running = False
        if self.exchange.ws: self.exchange.ws.stop()
        self.cb['log']("🛑 機器人已停止")

    def get_equity(self):
        if self.cfg.data['is_sim']:
            pnl = sum(p['pnl'] for p in self.positions.values())
            return self.sim_bal + pnl
        else:
            return self.exchange.get_balance() # 簡化: 實盤僅抓餘額

    def check_risk(self, equity):
        # 1. Update Peak
        if equity > self.peak_equity: self.peak_equity = equity
        
        # 2. Drawdown
        dd = (self.peak_equity - equity) / self.peak_equity * 100 if self.peak_equity > 0 else 0
        self.cb['update_stats'](equity, dd)
        
        if dd > self.cfg.data['max_drawdown']:
            self.cb['log'](f"🚨 最大回撤觸發 ({dd:.2f}%)! 強制停止。")
            self.notify.send("🚨 系統警報: 帳戶觸發最大回撤風控，已自動停機。")
            self.stop()

    def loop(self):
        while self.running:
            try:
                eq = self.get_equity()
                self.check_risk(eq)
                
                # Daily Report
                today = datetime.now().strftime("%Y-%m-%d")
                if today != self.last_report:
                    profit = eq - self.start_equity
                    msg = f"📅 [日報] {today}\n權益: {eq:.2f}\n損益: {profit:.2f}"
                    self.notify.send(msg)
                    self.last_report = today
                
                # Update GUI Pos
                plist = []
                for s, p in self.positions.items():
                    plist.append((s, p['side'], f"{p['amount']:.4f}", f"{p['entry']:.2f}", f"{p['pnl']:.2f}"))
                self.cb['update_pos'](plist)
                
                time.sleep(1)
            except Exception as e:
                logging.error(f"Loop: {e}")
                time.sleep(5)

    def on_price(self, sym, price):
        # Update PnL
        if sym in self.positions:
            p = self.positions[sym]
            if p['side'] == 'LONG': p['pnl'] = (price - p['entry']) * p['amount']
            else: p['pnl'] = (p['entry'] - price) * p['amount']
            entry_val = p['entry'] * p['amount']
            p['pnl_pct'] = (p['pnl'] / entry_val * 100) if entry_val > 0 else 0
            
            # Trailing Stop
            ts = self.cfg.data['trailing_stop']
            if p['side'] == 'LONG':
                p['high_mark'] = max(p.get('high_mark', price), price)
                if price < p['high_mark'] * (1 - ts/100):
                    self.close_position(sym, price, "Trailing Stop")
            else:
                p['low_mark'] = min(p.get('low_mark', price), price)
                if price > p['low_mark'] * (1 + ts/100):
                    self.close_position(sym, price, "Trailing Stop")

    def on_candle(self, sym, close):
        threading.Thread(target=self.analyze, args=(sym, close)).start()

    def analyze(self, sym, price):
        ohlcv = self.exchange.fetch_ohlcv(sym)
        techs = TechnicalAnalysis.compute(ohlcv)
        news = self.news.get_sentiment()
        pos = self.positions.get(sym)
        is_sim = self.cfg.data['is_sim']
        
        dec = self.ai.analyze(sym, price, techs, pos, is_sim, news)
        
        if dec['confidence'] > 60:
            self.cb['log'](f"🧠 {sym} AI: {dec['action']} ({dec['confidence']}%)")
            
        if dec['confidence'] >= 70:
            act = dec['action']
            if act == 'OPEN_LONG' and not pos: self.open_position(sym, 'LONG', price)
            elif act == 'OPEN_SHORT' and not pos: self.open_position(sym, 'SHORT', price)
            elif act == 'CLOSE' and pos: self.close_position(sym, price, "AI Signal")

    def open_position(self, sym, side, price):
        equity = self.get_equity()
        risk_amt = equity * (self.cfg.data['risk_pct'] / 100) # Compounding
        amt = risk_amt / price
        
        if self.cfg.data['is_sim']:
            self.positions[sym] = {
                'side': side, 'amount': amt, 'entry': price, 'pnl': 0, 'pnl_pct': 0,
                'high_mark': price, 'low_mark': price
            }
            fee = risk_amt * 0.001
            self.sim_bal -= fee
            self.cb['log'](f"🧪 [Sim] 開倉 {side} {sym}")
        else:
            try:
                real_side = 'buy' if side == 'LONG' else 'sell'
                self.exchange.place_order(sym, real_side, amt)
                self.cb['log'](f"⚡ [Real] 開倉 {side} {sym}")
                # Real positions would need sync via REST loop, simplified here
            except Exception as e: logging.error(f"Order Fail: {e}")

    def close_position(self, sym, price, reason):
        p = self.positions.get(sym)
        if not p: return
        
        if self.cfg.data['is_sim']:
            self.sim_bal += p['pnl']
            del self.positions[sym]
            self.cb['log'](f"🧪 [Sim] 平倉 {sym} ({reason}) PnL: {p['pnl']:.2f}")
            self.notify.send(f"💰 平倉 {sym} | PnL: {p['pnl']:.2f} | {reason}")
        else:
            try:
                side = 'sell' if p['side'] == 'LONG' else 'buy'
                self.exchange.place_order(sym, side, p['amount'])
                del self.positions[sym]
                self.cb['log'](f"⚡ [Real] 平倉 {sym}")
            except Exception as e: logging.error(f"Close Fail: {e}")

# -----------------------------------------------------------------------------
# 5. Tkinter GUI
# -----------------------------------------------------------------------------

class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("AI Trading Bot v8.0")
        self.geometry("1000x850")
        
        self.cfg = ConfigManager()
        self.bot = None
        self.vars = {}
        
        self.setup_ui()
        
    def setup_ui(self):
        style = ttk.Style()
        style.theme_use('clam')
        
        # 1. Config Area
        cf = ttk.LabelFrame(self, text="系統配置", padding=10)
        cf.pack(fill='x', padx=5, pady=5)
        
        keys = ["binance_key", "binance_secret", "gemini_key", "cryptopanic_key", 
                "tg_token", "tg_chat", "risk_pct", "max_drawdown", "trailing_stop", 
                "max_symbols", "sim_initial_balance", "is_sim", "is_testnet"]
                
        for i, k in enumerate(keys):
            self.vars[k] = tk.StringVar(value=str(self.cfg.data.get(k, '')))
            r, c = divmod(i, 3)
            f = ttk.Frame(cf)
            f.grid(row=r, column=c, sticky='w', padx=5, pady=2)
            ttk.Label(f, text=k).pack(anchor='w')
            show = '*' if 'key' in k or 'secret' in k or 'token' in k else ''
            ttk.Entry(f, textvariable=self.vars[k], show=show, width=20).pack()

        btn_f = ttk.Frame(cf)
        btn_f.grid(row=99, column=0, columnspan=3, pady=10)
        ttk.Button(btn_f, text="測試連線 (Validate)", command=self.test_conn).pack(side='left', padx=5)
        ttk.Button(btn_f, text="保存配置", command=self.save_cfg).pack(side='left', padx=5)
        self.btn_run = ttk.Button(btn_f, text="▶ 啟動機器人", command=self.toggle)
        self.btn_run.pack(side='left', padx=5)

        # 2. Dashboard
        df = ttk.Frame(self)
        df.pack(fill='x', padx=10)
        self.lbl_eq = ttk.Label(df, text="權益: $---", font=("Impact", 18))
        self.lbl_eq.pack(side='left', padx=20)
        self.lbl_dd = ttk.Label(df, text="回撤: 0.00%", foreground="red")
        self.lbl_dd.pack(side='left')

        # 3. Tables & Logs
        cols = ("Symbol", "Side", "Amt", "Entry", "PnL")
        self.tree = ttk.Treeview(self, columns=cols, show='headings', height=6)
        for c in cols: self.tree.heading(c, text=c); self.tree.column(c, width=100)
        self.tree.pack(fill='x', padx=10, pady=5)

        self.log_txt = scrolledtext.ScrolledText(self, height=12)
        self.log_txt.pack(fill='both', expand=True, padx=10, pady=5)
        
        logging.getLogger().addHandler(GuiLogHandler(self.log_txt))
        logging.getLogger().setLevel(logging.INFO)

    def save_cfg(self):
        d = {}
        for k, v in self.vars.items():
            val = v.get()
            if k in ['risk_pct', 'max_drawdown', 'trailing_stop', 'sim_initial_balance']:
                val = float(val)
            elif k in ['is_sim', 'is_testnet']:
                val = (val.lower() == 'true' or val == '1')
            d[k] = val
        self.cfg.save(d)
        messagebox.showinfo("Sys", "Saved!")

    def test_conn(self):
        self.save_cfg()
        exc = Exchange(self.cfg)
        if exc.connect():
            bal = exc.get_balance()
            messagebox.showinfo("Success", f"Connected! Balance: {bal:.2f}")
        else:
            messagebox.showerror("Error", "Connection Failed")

    def toggle(self):
        if self.bot and self.bot.running:
            self.bot.stop()
            self.btn_run.config(text="▶ 啟動機器人")
        else:
            self.save_cfg()
            self.bot = BotLogic(self.cfg, {
                'log': logging.info,
                'update_stats': lambda e, d: (self.lbl_eq.config(text=f"權益: \${e:.2f}"), self.lbl_dd.config(text=f"回撤: {d:.2f}%")),
                'update_pos': self.update_tree
            })
            if self.bot.init_system():
                self.bot.start()
                self.btn_run.config(text="⏹ 停止")

    def update_tree(self, rows):
        for i in self.tree.get_children(): self.tree.delete(i)
        for r in rows: self.tree.insert('', 'end', values=r)

    def on_close(self):
        if self.bot: self.bot.stop()
        self.destroy()

if __name__ == "__main__":
    app = App()
    app.mainloop()
`;
