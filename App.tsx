import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Play, Square, Activity, ShieldAlert, Cpu, Settings, Wallet, Download } from 'lucide-react';
import Header from './components/Header';
import RealtimeChart from './components/RealtimeChart';
import { BotConfig, StrategyType, Ticker, LogEntry, Position, Order, AccountState } from './types';
import * as Exchange from './services/exchangeService';
import * as AI from './services/geminiService';
import { pythonBotCode } from './utils/botTemplate';

const App: React.FC = () => {
  // --- App State ---
  const [isConnected, setIsConnected] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [config, setConfig] = useState<BotConfig>({
    binanceApiKey: '',
    binanceSecretKey: '',
    geminiApiKey: '',
    symbol: 'BTC/USDT',
    pairs: ['BTC/USDT'],
    timeframe: '1m',
    riskPercentage: 5,
    gridLevels: 5,
    strategy: StrategyType.MOMENTUM,
    isTestnet: true,
    enableTelegram: false,
    includeLogging: true,
    includeWebsockets: false
  });

  // --- Trading State ---
  const [tickers, setTickers] = useState<Ticker[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [account, setAccount] = useState<AccountState>({ balance: 0, equity: 0, dailyPnL: 0, winRate: 0 });
  const [position, setPosition] = useState<Position>({ symbol: '', amount: 0, entryPrice: 0, unrealizedPnL: 0, side: 'NONE' });
  const [orders, setOrders] = useState<Order[]>([]);

  // --- Refs for Loop ---
  const intervalRef = useRef<number | null>(null);
  const lastAiCheck = useRef<number>(0);
  const isProcessing = useRef(false);

  // --- Helper Methods ---
  const addLog = (type: LogEntry['type'], message: string) => {
    setLogs(prev => [{
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      type,
      message
    }, ...prev.slice(0, 49)]); // Keep last 50 logs
  };

  const handleDownloadCode = () => {
    const blob = new Blob([pythonBotCode], { type: 'text/x-python;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ai_crypto_bot.py';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addLog('INFO', '已下載 Python 機器人完整原始碼 (ai_crypto_bot.py)');
  };

  // --- Bot Loop (The Backend Logic) ---
  const botLoop = async () => {
    if (isProcessing.current) return;
    isProcessing.current = true;

    try {
      // 1. Fetch Market Data (Simulated)
      const lastTicker = tickers.length > 0 ? tickers[tickers.length - 1] : { close: 42000, time: Date.now()/1000 } as Ticker;
      const newTicker = Exchange.simulateTick(lastTicker.close);
      
      setTickers(prev => {
        const updated = [...prev, newTicker];
        return updated.slice(-200); // Keep last 200 candles for chart
      });

      // 2. Check Orders & Update Account
      const filled = Exchange.checkOrders();
      if (filled.length > 0) {
        filled.forEach(o => addLog('TRADE', `${o.side} 訂單成交: ${o.amount} @ ${o.price.toFixed(2)}`));
      }
      
      setAccount(Exchange.getAccountState());
      setPosition(Exchange.getPosition());
      setOrders(Exchange.getOpenOrders());

      // 3. AI Decision (Every 5 seconds to save tokens)
      const now = Date.now();
      if (now - lastAiCheck.current > 5000 && isRunning) {
        lastAiCheck.current = now;
        addLog('INFO', 'AI 正在分析市場結構...');
        
        // Pass the API Key from config to the service
        const decision = await AI.analyzeMarket(config.geminiApiKey, tickers, config.strategy, position.side);
        
        if (decision.confidence > 70) {
          addLog('AI', `Gemini 建議: ${decision.action} (${decision.confidence}%) - ${decision.reasoning}`);
          
          // Auto-Trade Logic
          if (decision.action === 'BUY' && position.side === 'NONE') {
            Exchange.placeOrder({
              symbol: config.symbol,
              side: 'BUY',
              type: 'MARKET',
              price: 0,
              amount: 0.1 // Fixed size for demo
            });
          } else if (decision.action === 'SELL' && position.side === 'LONG') {
            Exchange.placeOrder({
              symbol: config.symbol,
              side: 'SELL',
              type: 'MARKET',
              price: 0,
              amount: position.amount
            });
          }
        }
      }

    } catch (e) {
      console.error(e);
    } finally {
      isProcessing.current = false;
    }
  };

  // --- Effects ---
  useEffect(() => {
    if (isConnected) {
      intervalRef.current = window.setInterval(botLoop, 1000); // 1s loop
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isConnected, isRunning, tickers]); // Dependencies ensure fresh state in closure

  // --- UI Handlers ---
  const handleConnect = () => {
    setIsConnected(true);
    addLog('INFO', '已連線至仿真交易所 (Mock Exchange)');
    addLog('INFO', 'Gemini AI 模組載入完成');
    // Init some data
    const initialData = [];
    let price = 42000;
    const now = Math.floor(Date.now() / 1000);
    for(let i = 100; i > 0; i--) {
        price = price * (1 + (Math.random() - 0.5) * 0.002);
        initialData.push({
            time: now - i,
            open: price,
            high: price + 10,
            low: price - 10,
            close: price,
            volume: Math.random() * 10
        });
    }
    setTickers(initialData);
  };

  const toggleBot = () => {
    if (isRunning) {
        setIsRunning(false);
        addLog('WARNING', '機器人已手動暫停');
    } else {
        setIsRunning(true);
        addLog('INFO', '機器人啟動交易循環...');
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <div className="flex justify-center mb-6">
            <div className="p-3 bg-blue-600/20 rounded-xl">
              <Terminal className="w-10 h-10 text-blue-500" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center text-white mb-2">Bitrader AI 儀表板</h1>
          <p className="text-center text-slate-400 text-sm mb-8">
            連接您的 Binance 帳戶與 Gemini 3 Pro 進行即時自動化交易。
          </p>
          
          <div className="space-y-4">
             <div>
               <label className="text-xs text-slate-400 mb-1 block">Binance API Key (僅供模擬可留空)</label>
               <input 
                 type="password" 
                 className="w-full bg-slate-950 border border-slate-800 rounded px-4 py-2 text-slate-200 outline-none focus:border-blue-500"
                 value={config.binanceApiKey}
                 onChange={(e) => setConfig({...config, binanceApiKey: e.target.value})}
               />
             </div>
             <div>
               <label className="text-xs text-slate-400 mb-1 block">Gemini API Key (建議填寫以啟用 AI)</label>
               <input 
                 type="password" 
                 className="w-full bg-slate-950 border border-slate-800 rounded px-4 py-2 text-slate-200 outline-none focus:border-blue-500"
                 value={config.geminiApiKey}
                 onChange={(e) => setConfig({...config, geminiApiKey: e.target.value})}
                 placeholder="sk-..."
               />
             </div>
             <button 
                onClick={handleConnect}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-lg transition-all"
             >
               啟動仿真交易系統
             </button>
             <p className="text-xs text-center text-slate-500 mt-4">
               <ShieldAlert className="w-3 h-3 inline mr-1" />
               本系統目前運行於「模擬環境」以確保資金安全。
             </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-200">
      <Header />
      
      <main className="container mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Col: Market & Chart */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Chart Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg">
             <div className="flex justify-between items-center mb-4">
               <div className="flex items-center gap-3">
                 <h2 className="text-lg font-bold text-white flex items-center gap-2">
                   <Activity className="w-5 h-5 text-blue-400" /> BTC/USDT
                 </h2>
                 <span className="text-2xl font-mono text-emerald-400">${tickers.length > 0 ? tickers[tickers.length-1].close.toFixed(2) : '---'}</span>
               </div>
               <div className="flex gap-2">
                 <span className={`px-2 py-1 rounded text-xs font-mono border ${isRunning ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                    {isRunning ? 'RUNNING' : 'STOPPED'}
                 </span>
               </div>
             </div>
             <RealtimeChart data={tickers} />
          </div>

          {/* Active Orders / Positions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-slate-400 mb-3">當前持倉 (Positions)</h3>
              {position.amount > 0 ? (
                <div className="space-y-2">
                   <div className="flex justify-between text-sm">
                      <span className="text-slate-500">方向</span>
                      <span className="text-green-400 font-bold">{position.side}</span>
                   </div>
                   <div className="flex justify-between text-sm">
                      <span className="text-slate-500">數量</span>
                      <span className="font-mono">{position.amount.toFixed(4)} BTC</span>
                   </div>
                   <div className="flex justify-between text-sm">
                      <span className="text-slate-500">未實現損益</span>
                      <span className={`font-mono ${position.unrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {position.unrealizedPnL >= 0 ? '+' : ''}{position.unrealizedPnL.toFixed(2)} USDT
                      </span>
                   </div>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-600 text-sm">無持倉</div>
              )}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-slate-400 mb-3">掛單監控 (Open Orders)</h3>
              <div className="space-y-2 max-h-[120px] overflow-y-auto">
                 {orders.length === 0 && <div className="text-center py-8 text-slate-600 text-sm">無掛單</div>}
                 {orders.map(o => (
                   <div key={o.id} className="flex justify-between items-center text-xs bg-slate-950 p-2 rounded border border-slate-800">
                     <span className={o.side === 'BUY' ? 'text-green-400' : 'text-red-400'}>{o.side}</span>
                     <span className="font-mono">{o.amount} @ {o.price.toFixed(2)}</span>
                     <button className="text-slate-500 hover:text-white" onClick={() => Exchange.cancelOrder(o.id)}>取消</button>
                   </div>
                 ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Controls & Logs */}
        <div className="lg:col-span-4 flex flex-col gap-6">
           
           {/* Account Summary */}
           <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-xl p-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                 <Wallet className="w-24 h-24 text-white" />
              </div>
              <h3 className="text-slate-400 text-xs uppercase tracking-wider mb-1">總資產權益 (Equity)</h3>
              <div className="text-3xl font-bold text-white font-mono mb-4">
                ${account.equity.toFixed(2)}
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <div className="text-xs text-slate-500">今日損益 (Daily PnL)</div>
                    <div className={`font-mono ${account.dailyPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                       {account.dailyPnL >= 0 ? '+' : ''}{account.dailyPnL.toFixed(2)}
                    </div>
                 </div>
                 <div>
                    <div className="text-xs text-slate-500">勝率 (Win Rate)</div>
                    <div className="text-blue-400 font-mono">{account.winRate.toFixed(1)}%</div>
                 </div>
              </div>
           </div>

           {/* Controls */}
           <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h3 className="flex items-center gap-2 text-white font-semibold mb-4">
                <Settings className="w-4 h-4" /> 機器人控制台
              </h3>
              
              <div className="space-y-4 mb-6">
                <div>
                   <label className="text-xs text-slate-400 block mb-1">交易策略</label>
                   <select 
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-slate-200 outline-none"
                    value={config.strategy}
                    onChange={(e) => setConfig({...config, strategy: e.target.value as StrategyType})}
                   >
                     {Object.values(StrategyType).map(s => <option key={s} value={s}>{s}</option>)}
                   </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <button className="bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-600/50 py-2 rounded text-sm transition-colors" onClick={() => Exchange.placeOrder({symbol: config.symbol, side: 'BUY', type: 'MARKET', amount: 0.1, price: 0})}>
                     手動買入
                  </button>
                  <button className="bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/50 py-2 rounded text-sm transition-colors" onClick={() => Exchange.placeOrder({symbol: config.symbol, side: 'SELL', type: 'MARKET', amount: 0.1, price: 0})}>
                     手動賣出
                  </button>
                </div>
                <button 
                  onClick={handleDownloadCode}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 py-2 rounded text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" /> 下載 Python 原始碼
                </button>
              </div>

              <button
                onClick={toggleBot}
                className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${
                    isRunning 
                    ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-500/20' 
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20'
                }`}
              >
                {isRunning ? (
                    <><Square className="w-4 h-4 fill-current" /> 暫停自動交易</>
                ) : (
                    <><Play className="w-4 h-4 fill-current" /> 啟動 AI 託管</>
                )}
              </button>
           </div>

           {/* Logs */}
           <div className="bg-[#050911] border border-slate-800 rounded-xl flex flex-col flex-1 min-h-[200px] overflow-hidden">
             <div className="bg-slate-900/50 px-4 py-2 border-b border-slate-800 flex justify-between items-center">
               <span className="text-xs text-slate-400 flex items-center gap-2">
                 <Cpu className="w-3 h-3" /> 系統日誌
               </span>
               <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
             </div>
             <div className="p-4 overflow-y-auto flex-1 font-mono text-xs space-y-2 h-[300px]">
               {logs.length === 0 && <span className="text-slate-700">等待系統事件...</span>}
               {logs.map(log => (
                 <div key={log.id} className="flex gap-2">
                   <span className="text-slate-600">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                   <span className={`
                     ${log.type === 'INFO' ? 'text-slate-300' : ''}
                     ${log.type === 'TRADE' ? 'text-amber-400' : ''}
                     ${log.type === 'AI' ? 'text-purple-400' : ''}
                     ${log.type === 'WARNING' ? 'text-red-400' : ''}
                   `}>
                     {log.type === 'AI' && '🤖 '}{log.message}
                   </span>
                 </div>
               ))}
             </div>
           </div>

        </div>

      </main>
    </div>
  );
};

export default App;
