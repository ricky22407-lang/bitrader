import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import ConfigPanel from './components/ConfigPanel';
import RealtimeChart from './components/RealtimeChart';
import SimulatedChart from './components/SimulatedChart';
import CodeViewer from './components/CodeViewer';
import { BotConfig, StrategyType, Ticker, LogEntry, GeneratedContent } from './types';
import { simulateTick, getAccountState } from './services/exchangeService';
import { analyzeMarket } from './services/geminiService';
import { pythonBotCode } from './utils/botTemplate';
import { Activity, Terminal } from 'lucide-react';

const initialConfig: BotConfig = {
  symbol: 'BTC/USDT',
  pairs: ['BTC/USDT', 'ETH/USDT'],
  timeframe: '1h',
  riskPercentage: 2,
  gridLevels: 5,
  strategy: StrategyType.MOMENTUM,
  isTestnet: true,
  enableTelegram: false,
  includeLogging: true,
  includeWebsockets: true,
};

const App: React.FC = () => {
  const [config, setConfig] = useState<BotConfig>(initialConfig);
  const [tickers, setTickers] = useState<Ticker[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Scroll logs to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Simulation Loop
  useEffect(() => {
    const interval = setInterval(async () => {
      const lastClose = tickers.length > 0 ? tickers[tickers.length - 1].close : 42000;
      const newTicker = simulateTick(lastClose);
      
      setTickers(prev => {
        const updated = [...prev, newTicker];
        if (updated.length > 100) return updated.slice(-100);
        return updated;
      });

      // AI Analysis Simulation
      if (Math.random() < 0.1) { // 10% chance per tick to analyze
         const decision = await analyzeMarket(
           [...tickers, newTicker], 
           config.strategy, 
           'NONE' // Simplified position tracking for demo
         );
         
         if (decision.action !== 'HOLD') {
            addLog('AI', `Signal: ${decision.action} | Conf: ${decision.confidence}% | ${decision.reasoning}`);
         }
      }

    }, 1000);

    return () => clearInterval(interval);
  }, [tickers, config.strategy]);

  const addLog = (type: LogEntry['type'], message: string) => {
    setLogs(prev => [...prev, {
      id: Math.random().toString(),
      timestamp: Date.now(),
      type,
      message
    }].slice(-50));
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    addLog('INFO', 'Initializing bot code generation...');

    // Simulate AI processing delay
    setTimeout(() => {
      // Customize the template based on current config
      // Note: We are using simple string replacement here for the demo. 
      // In a real scenario, this might be more complex or handled by the LLM completely.
      let customCode = pythonBotCode;
      
      // Update defaults in the Python code string
      customCode = customCode.replace(
        /"max_symbols": 5/, 
        `"max_symbols": ${config.pairs.length}`
      );
      
      customCode = customCode.replace(
        /"risk_pct": 2.0/, 
        `"risk_pct": ${config.riskPercentage}`
      );
      
      customCode = customCode.replace(
        /"is_testnet": False/, 
        `"is_testnet": ${config.isTestnet ? 'True' : 'False'}`
      );
      
      const summary = `
## 生成報告

**策略模型**: ${config.strategy}
**配置摘要**:
- 交易對: ${config.pairs.join(', ')}
- 風險設定: ${config.riskPercentage}% per trade
- 環境: ${config.isTestnet ? 'Testnet' : 'Mainnet'}

**下一步**:
1. 下載 \`bot.py\`
2. 安裝依賴 (自動處理)
3. 編輯 \`config.json\` 填入您的 API Key
4. 運行 \`python bot.py\`
      `;

      setGeneratedContent({
        code: customCode,
        summary: summary.trim()
      });
      
      setIsGenerating(false);
      addLog('INFO', 'Bot code generated successfully.');
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-200 flex flex-col font-sans selection:bg-blue-500/30">
      <Header />
      
      <main className="flex-1 p-6 grid grid-cols-12 gap-6 max-w-[1920px] mx-auto w-full">
        {/* Left Column: Configuration */}
        <div className="col-span-12 lg:col-span-3 h-[calc(100vh-8rem)] min-h-[600px]">
          <ConfigPanel 
            config={config} 
            setConfig={setConfig} 
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
          />
        </div>

        {/* Middle Column: Charts & Logs */}
        <div className="col-span-12 lg:col-span-6 flex flex-col gap-6 h-[calc(100vh-8rem)]">
          {/* Top: Realtime Chart */}
          <div className="flex-1 min-h-[300px]">
             <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-semibold text-white">即時市場數據 (Simulation)</span>
             </div>
             <RealtimeChart data={tickers} />
          </div>
          
          {/* Middle: Backtest/Sim Chart */}
          <div className="h-[200px] border border-slate-800 bg-slate-900/50 rounded-xl p-4">
             <SimulatedChart />
          </div>

          {/* Bottom: Terminal Logs */}
          <div className="h-[200px] border border-slate-800 bg-slate-950 rounded-xl p-4 font-mono text-xs overflow-hidden flex flex-col shadow-inner shadow-black/50">
            <div className="flex items-center gap-2 mb-2 text-slate-400 border-b border-slate-800 pb-2">
              <Terminal className="w-3 h-3" />
              <span>System Output</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
              {logs.map(log => (
                <div key={log.id} className="flex gap-2">
                  <span className="text-slate-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                  <span className={`font-bold ${
                    log.type === 'ERROR' ? 'text-red-500' : 
                    log.type === 'AI' ? 'text-purple-400' : 
                    log.type === 'TRADE' ? 'text-emerald-400' : 'text-blue-400'
                  }`}>
                    {log.type}
                  </span>
                  <span className="text-slate-300">{log.message}</span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>

        {/* Right Column: Code Viewer */}
        <div className="col-span-12 lg:col-span-3 h-[calc(100vh-8rem)]">
          <CodeViewer content={generatedContent} isGenerating={isGenerating} />
        </div>
      </main>
    </div>
  );
};

export default App;