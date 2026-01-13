
import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import ConfigPanel from './components/ConfigPanel';
import RealtimeChart from './components/RealtimeChart';
import TradingMonitor from './components/TradingMonitor';
import SystemConsole from './components/SystemConsole'; 
import SettingsModal from './components/SettingsModal';
import { BotConfig, LogEntry, Portfolio, Trade, UserSettings } from './types';
import { loadPortfolioState, getPortfolio, executeOrder, liquidateAllPositions, setTradingMode } from './services/exchangeService';
import { saveToDB, loadFromDB } from './services/db';

// Custom Hooks
import { useAudio } from './hooks/useAudio';
import { useMarketStream } from './hooks/useMarketStream';
import { useAutoPilot } from './hooks/useAutoPilot';
import { Zap, Eye } from 'lucide-react';

const initialConfig: BotConfig = {
  symbol: 'BTCUSDT', 
  initialBudget: 10000,
  riskLevel: 'MEDIUM',
  minPulse: 30000,  
  maxPulse: 300000, 
  autoStart: false,
  tradingMode: 'SIMULATION'
};

const initialUserSettings: UserSettings = {
    binanceApiKey: '',
    binanceSecretKey: '',
    telegramBotToken: '',
    telegramChatId: ''
};

const App: React.FC = () => {
  // --- UI State ---
  const [config, setConfig] = useState<BotConfig>(initialConfig);
  const [userSettings, setUserSettings] = useState<UserSettings>(initialUserSettings);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [portfolio, setPortfolio] = useState<Portfolio>(getPortfolio());
  
  // The Symbol currently displayed on Chart and being focused by Council
  const [activeSymbol, setActiveSymbol] = useState<string>('BTCUSDT');

  // --- Hooks ---
  const { speak, isMuted, toggleMute } = useAudio();

  // Helper: Centralized Logging
  const addLog = useCallback(async (type: LogEntry['type'], message: string, metadata?: any) => {
    const entry: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      type,
      message,
      metadata
    };
    setLogs(prev => [...prev, entry].slice(-200)); 
    try {
      await saveToDB('logs', entry);
    } catch (e) {
      console.warn("Log save failed:", e);
    }
  }, []);

  // Helper: Portfolio Refresh
  const refreshPortfolio = useCallback(() => {
    setPortfolio(getPortfolio());
  }, []);

  // Helper: Trigger Handler
  const handleTriggerHit = useCallback((trade: Trade) => {
     const msg = `Trigger Hit: ${trade.reason} at ${trade.price.toFixed(2)}`;
     addLog('TRADE', msg);
     speak(msg);
     refreshPortfolio();
  }, [addLog, speak, refreshPortfolio]);

  // Helper: Stream Error Handler (Stable Reference)
  const handleStreamError = useCallback((err: string) => {
    if (!err.includes("Interrupted")) {
        addLog('ERROR', err);
    }
  }, [addLog]);

  // --- Core Logic Hooks ---
  
  // 1. Market Stream
  const { activeTickers, marketMap, watchedSymbols } = useMarketStream(
      isRunning, 
      activeSymbol,
      handleTriggerHit, 
      handleStreamError
  );

  // 2. Auto Pilot
  const { reports, currentStrategy, nextCouncilTime, forceScan, isEngineActive, currentPulse } = useAutoPilot({
    isRunning,
    config,
    userSettings,
    marketMap,
    activeSymbol,
    setActiveSymbol,
    portfolio,
    onLog: addLog,
    onSpeak: speak,
    refreshPortfolio
  });

  // --- Initialization ---
  useEffect(() => {
    const initSystem = async () => {
      const savedPortfolio = await loadPortfolioState();
      setPortfolio(savedPortfolio);
      
      const savedLogs = await loadFromDB('logs');
      if (savedLogs && savedLogs.length > 0) {
        setLogs(savedLogs.sort((a: LogEntry, b: LogEntry) => a.timestamp - b.timestamp).slice(-100));
      }

      // Load User Settings
      const savedSettings = await loadFromDB('settings', 'config');
      
      // Merge saved settings with ENV variables (ENV takes priority if saved is empty)
      const envSettings = {
          binanceApiKey: process.env.VITE_BINANCE_API_KEY || '',
          binanceSecretKey: process.env.VITE_BINANCE_SECRET_KEY || '',
          telegramBotToken: process.env.VITE_TELEGRAM_BOT_TOKEN || '',
          telegramChatId: process.env.VITE_TELEGRAM_CHAT_ID || ''
      };

      if (savedSettings) {
          // If DB exists, use it, but fill in missing holes from ENV
          const mergedSettings = {
              ...savedSettings,
              binanceApiKey: savedSettings.binanceApiKey || envSettings.binanceApiKey,
              binanceSecretKey: savedSettings.binanceSecretKey || envSettings.binanceSecretKey,
              telegramBotToken: savedSettings.telegramBotToken || envSettings.telegramBotToken,
              telegramChatId: savedSettings.telegramChatId || envSettings.telegramChatId
          };
          setUserSettings(mergedSettings);
      } else {
          // If no DB, use ENV completely
          setUserSettings(envSettings);
          // Only save to DB if we actually have something from ENV
          if (envSettings.binanceApiKey || envSettings.telegramBotToken) {
              saveToDB('settings', { id: 'config', ...envSettings });
          }
      }
    };
    initSystem();
  }, []);

  // --- Handlers ---
  const handleSaveSettings = async (newSettings: UserSettings) => {
      setUserSettings(newSettings);
      await saveToDB('settings', { id: 'config', ...newSettings });
      addLog('INFO', "Settings updated and saved.");
  };

  const handleToggle = () => {
    if (!process.env.API_KEY) {
        alert("Missing process.env.API_KEY");
        return;
    }

    setIsRunning(!isRunning);
    if (!isRunning) {
        speak("System Armed. Global Scanner Active.");
        addLog('INFO', `🔥 SYSTEM ARMED. Scanning ${watchedSymbols.length} top assets.`);
    } else {
        speak("System Disarmed.");
        addLog('INFO', '🛑 SYSTEM DISARMED. Auto-trading stopped.');
    }
  };

  const handlePanic = async () => {
      if (!window.confirm("🚨 EMERGENCY KILL SWITCH: Liquidate ALL positions and Stop?")) return;
      
      setIsRunning(false);
      addLog('ERROR', "🚨 PANIC BUTTON ACTIVATED. INITIATING LIQUIDATION...");
      speak("Emergency Protocol Activated. Liquidating.");
      
      try {
          const count = await liquidateAllPositions("EMERGENCY KILL SWITCH");
          refreshPortfolio();
          addLog('INFO', `✅ EMERGENCY COMPLETE. ${count} positions liquidated.`);
          speak("Liquidation Complete.");
      } catch (e) {
          addLog('ERROR', `Liquidation Failed: ${e}`);
      }
  };

  const handleManualTrade = async (side: 'BUY' | 'SELL', amountPct: number) => {
    try {
        const reason = "Manual Override";
        addLog('INFO', `👨‍✈️ Manual ${side} ${activeSymbol} (${amountPct * 100}%)...`);
        
        const currentPrice = activeTickers[activeTickers.length - 1]?.close || 0;
        const sl = side === 'BUY' ? currentPrice * 0.95 : undefined;
        const trailing = side === 'BUY' ? 1.5 : undefined;

        const trade = await executeOrder(
            side, amountPct, activeSymbol, reason, sl, undefined, "Manual Command", trailing
        );

        if (trade) {
            speak(`Manual ${side} Confirmed.`);
            addLog('TRADE', `${side} Executed at ${trade.price.toFixed(2)}.`);
            refreshPortfolio();
        } else {
            speak("Trade failed.");
            addLog('ERROR', `Manual ${side} Failed.`);
        }
    } catch (e: any) {
        if (e.message === 'CORS_BLOCK') {
            alert("To trade manually with REAL MONEY, please install the 'Allow CORS' browser extension.");
        }
        addLog('ERROR', `Manual Trade Exception: ${e.message}`);
    }
  };

  const handleForceScan = () => {
      if (!isRunning) return alert("Please arm the system first.");
      speak("Forcing Global Scan.");
      addLog('INFO', "⚡ COMMAND OVERRIDE: Forcing Global Analysis...");
      forceScan();
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-200 flex flex-col font-sans selection:bg-indigo-500/30">
      <Header 
        isMuted={isMuted}
        onToggleMute={toggleMute}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={userSettings}
        onSave={handleSaveSettings}
      />

      {/* Status Bar */}
      {isRunning && (
        <div className={`px-6 py-1 text-center border-b border-opacity-50 transition-colors duration-500 ${isEngineActive ? 'bg-indigo-900/30 border-indigo-500/30' : 'bg-amber-900/30 border-amber-500/30'}`}>
            <p className="text-[10px] font-mono flex justify-center gap-3 items-center">
                <span className={`flex items-center gap-1 ${isEngineActive ? 'text-indigo-300' : 'text-amber-300'}`}>
                    <Zap className={`w-3 h-3 ${isEngineActive ? 'animate-pulse' : ''}`} fill="currentColor" />
                    {isEngineActive ? "INSOMNIA ENGINE: ACTIVE" : "ENGINE WARMING UP..."}
                </span>
                <span className="opacity-50">|</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                    ❤️ PULSE: {Math.round(currentPulse / 1000)}s
                </span>
                <span className="opacity-50">|</span>
                <span className="text-blue-400 flex items-center gap-1">
                    <Eye className="w-3 h-3" /> WATCHING: {watchedSymbols.length} ASSETS
                </span>
            </p>
        </div>
      )}
      
      {/* Scrollable Main Content */}
      <main className="flex-1 p-6 flex flex-col gap-6 max-w-[1920px] mx-auto w-full pb-20">
        
        {/* ROW 1: DASHBOARD (Config | Chart | Monitor) */}
        {/* Use a responsive grid but enforce min-heights for spaciousness */}
        <div className="grid grid-cols-12 gap-6 min-h-[750px] lg:h-[80vh]">
             
             {/* Left: Config */}
            <div className="col-span-12 lg:col-span-3 h-full overflow-hidden flex flex-col">
                <ConfigPanel 
                    config={config} 
                    setConfig={setConfig} 
                    isRunning={isRunning}
                    onToggle={handleToggle}
                    onPanic={handlePanic}
                    onManualTrade={handleManualTrade}
                    onForceScan={handleForceScan}
                    portfolioValue={portfolio.equity}
                />
            </div>

            {/* Center: Chart */}
            <div className="col-span-12 lg:col-span-6 h-full flex flex-col min-h-[500px]">
                 <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden relative shadow-lg flex flex-col">
                    <div className="absolute top-4 left-4 z-10 flex items-center gap-3">
                        <div className="bg-slate-800/80 backdrop-blur px-3 py-1 rounded text-sm font-bold text-white border border-slate-600">
                        {activeSymbol}
                        </div>
                        <div className={`px-2 py-1 rounded text-xs font-mono font-bold ${activeTickers.length > 0 && activeTickers[activeTickers.length-1].close > activeTickers[activeTickers.length-2]?.close ? 'text-emerald-400' : 'text-rose-400'}`}>
                        ${activeTickers.length > 0 ? activeTickers[activeTickers.length-1].close.toFixed(4) : '---'}
                        </div>
                        {isRunning && (
                        <div className="bg-indigo-600/20 text-indigo-300 px-2 py-1 rounded text-xs border border-indigo-500/30 animate-pulse flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></span>
                            {currentStrategy}
                        </div>
                        )}
                    </div>
                    
                    {isRunning && nextCouncilTime > Date.now() && (
                        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
                            <div className="text-[10px] text-slate-500 font-mono bg-slate-900/80 px-2 py-1 rounded border border-slate-700">
                                Next Scan: {Math.ceil((nextCouncilTime - Date.now()) / 1000)}s
                            </div>
                        </div>
                    )}

                    <RealtimeChart data={activeTickers} portfolio={portfolio} />
                </div>
            </div>

            {/* Right: Monitor */}
            <div className="col-span-12 lg:col-span-3 h-full overflow-hidden flex flex-col">
                <TradingMonitor portfolio={portfolio} logs={logs} reports={reports} />
            </div>
        </div>

        {/* ROW 2: CONSOLE (Long & Tall) */}
        <div className="w-full h-[600px] flex-shrink-0">
            <SystemConsole logs={logs} />
        </div>

      </main>
    </div>
  );
};

export default App;
