import React, { useState } from 'react';
import Header from './components/Header';
import ConfigPanel from './components/ConfigPanel';
import CodeViewer from './components/CodeViewer';
import SimulatedChart from './components/SimulatedChart';
import { BotConfig, StrategyType, RiskLevel, GeneratedContent } from './types';
import { generateBotStructure } from './services/geminiService';
import { AlertCircle, ShieldAlert } from 'lucide-react';

const DEMO_CODE = `import ccxt
import os
import time
import json
import logging
import random
import signal
import sys
import requests
from datetime import datetime, timedelta
import backtrader as bt
import pandas as pd
import google.generativeai as genai
from dotenv import load_dotenv

# 載入環境變數
load_dotenv()

# --- 1. 集中化配置 (Centralized Config) ---
class Config:
    # API Keys
    BINANCE_API_KEY = os.getenv('BINANCE_API_KEY')
    BINANCE_SECRET = os.getenv('BINANCE_SECRET')
    GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
    TELEGRAM_TOKEN = os.getenv('TELEGRAM_TOKEN')
    TELEGRAM_CHAT_ID = os.getenv('TELEGRAM_CHAT_ID')

    # 交易參數
    SYMBOLS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT']
    TIMEFRAME = '1h'
    GRID_LEVELS = 5            # 網格層數
    GRID_SPACING_PCT = 0.01    # 網格間距 (1%)
    RISK_PER_TRADE = 0.05      # 單筆倉位風險
    MAX_DRAWDOWN = 0.10        # 最大回撤熔斷 (10%)
    TRAILING_STOP_PCT = 0.02   # 移動停損 (2%)
    AUTO_COMPOUND = True       # 自動複利

    # 系統參數
    BACKTEST_MODE = True
    LOG_LEVEL = logging.INFO

# --- 2. 繁體中文日誌與通知系統 ---
logging.basicConfig(
    level=Config.LOG_LEVEL,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)

class Notifier:
    """整合日誌與 Telegram 通知的通知器"""
    @staticmethod
    def send(message, level=logging.INFO):
        # 1. 寫入本地日誌
        if level == logging.ERROR:
            logging.error(message)
        else:
            logging.info(message)

        # 2. 發送 Telegram (若有設定)
        if Config.TELEGRAM_TOKEN and Config.TELEGRAM_CHAT_ID:
            try:
                # 實際應用建議使用非同步呼叫
                # requests.get(f"https://api.telegram.org/bot{Config.TELEGRAM_TOKEN}/sendMessage?chat_id={Config.TELEGRAM_CHAT_ID}&text={message}")
                pass
            except Exception as e:
                logging.error(f"Telegram 發送失敗: {e}")

# ... (完整代碼包含 AI 引擎, RiskManager, Backtrader 策略等)
# 點擊 "生成 Python 機器人代碼" 以獲取完整版本
`;

const DEMO_SUMMARY = `歡迎使用 AI 幣安機器人鍛造場 (AI Crypto Bot Forge)。
請在左側配置您的交易策略參數，AI 將為您生成全功能的 Python 交易機器人。
包含：AI 決策、網格交易、風險控管、Backtrader 回測架構與 Telegram 通知。`;

const DEMO_CONTENT: GeneratedContent = {
  code: DEMO_CODE,
  summary: DEMO_SUMMARY
};

const App: React.FC = () => {
  const [config, setConfig] = useState<BotConfig>({
    exchanges: ['Binance'],
    pairs: ['BTC/USDT', 'ETH/USDT'],
    strategy: StrategyType.MOMENTUM,
    riskLevel: RiskLevel.MEDIUM,
    includeLogging: true,
    includeWebsockets: true,
    enableTelegram: false,
    gridLevels: 5
  });

  // Initialize with DEMO_CONTENT to show the result immediately
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(DEMO_CONTENT);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const content = await generateBotStructure(config);
      setGeneratedContent(content);
    } catch (err) {
      setError("代碼生成失敗。請檢查您的 API 金鑰並重試。");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-blue-500/30 font-sans">
      <Header />
      
      {/* Safety Banner */}
      <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2">
        <div className="container mx-auto flex items-center justify-center gap-2 text-xs md:text-sm text-amber-400">
           <ShieldAlert className="w-4 h-4" />
           <p>安全警告：本工具生成的代碼僅供學習與回測使用。在連接真實資金前，請務必先於 Binance Testnet 進行充分測試。開發者不對交易損失負責。</p>
        </div>
      </div>
      
      <main className="container mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 text-red-400">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          
          {/* Left Column: Config & Chart */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="flex-shrink-0">
               <ConfigPanel 
                config={config} 
                setConfig={setConfig} 
                onGenerate={handleGenerate}
                isGenerating={isGenerating}
              />
            </div>
            
            {/* Visual Flair: Simulated Chart */}
            <div className="h-[400px] bg-slate-900 border border-slate-800 rounded-xl p-4 hidden lg:block shadow-lg">
               <SimulatedChart />
            </div>
          </div>

          {/* Right Column: Code Output */}
          <div className="lg:col-span-8 h-full min-h-[600px]">
            <CodeViewer 
              content={generatedContent} 
              isGenerating={isGenerating} 
            />
          </div>
        </div>
      </main>

       <footer className="py-6 text-center text-slate-600 text-sm">
        <p>&copy; {new Date().getFullYear()} AI 幣安機器人鍛造場 (AI Crypto Bot Forge). Version 1.0.0 (Stable).</p>
      </footer>
    </div>
  );
};

export default App;