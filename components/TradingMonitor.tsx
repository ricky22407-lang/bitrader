
import React, { useState, useMemo } from 'react';
import { History, Crosshair, BarChart2, Briefcase } from 'lucide-react';
import { Portfolio, LogEntry, AnalysisReport, Position } from '../types';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface TradingMonitorProps {
  portfolio: Portfolio;
  logs: LogEntry[];
  reports: AnalysisReport[];
}

const TradingMonitor: React.FC<TradingMonitorProps> = ({ portfolio, logs, reports }) => {
  const [activeTab, setActiveTab] = useState<'positions' | 'analytics' | 'history'>('positions');

  const metrics = useMemo(() => {
     const closedTrades = portfolio.tradeHistory.filter(t => t.pnl !== undefined);
     const wins = closedTrades.filter(t => t.pnl! > 0);
     const losses = closedTrades.filter(t => t.pnl! <= 0);
     
     const grossWin = wins.reduce((acc, t) => acc + (t.pnl || 0), 0);
     const grossLoss = Math.abs(losses.reduce((acc, t) => acc + (t.pnl || 0), 0));
     const profitFactor = grossLoss === 0 ? grossWin : grossWin / grossLoss;
     const winRate = closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0;
     
     let peak = 0;
     let maxDrawdown = 0;
     (portfolio.equityHistory || []).forEach(pt => {
        if (pt.equity > peak) peak = pt.equity;
        const dd = (peak - pt.equity) / peak * 100;
        if (dd > maxDrawdown) maxDrawdown = dd;
     });

     return {
         profitFactor: profitFactor.toFixed(2),
         winRate: winRate.toFixed(1),
         maxDrawdown: maxDrawdown.toFixed(2),
         totalTrades: closedTrades.length
     };
  }, [portfolio.tradeHistory, portfolio.equityHistory]);

  const chartData = useMemo(() => {
      return (portfolio.equityHistory || []).map(snap => ({
          time: new Date(snap.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          equity: Math.floor(snap.equity),
      }));
  }, [portfolio.equityHistory]);

  const renderPositionCard = (pos: Position, type: 'SPOT' | 'FUTURES') => (
     <div key={pos.id} className="bg-slate-800/40 border border-slate-700 rounded-lg p-3 space-y-2 relative overflow-hidden">
        {type === 'FUTURES' && (
            <div className={`absolute top-0 right-0 px-2 py-0.5 text-[9px] font-bold ${pos.side === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                {pos.side} {pos.leverage}x
            </div>
        )}
        <div className="flex justify-between items-center">
           <span className="font-bold text-white">{pos.symbol}</span>
           <div className="text-right">
             <div className={`font-mono font-bold text-sm ${pos.unrealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
               {pos.unrealizedPnL >= 0 ? '+' : ''}{pos.unrealizedPnL.toFixed(2)}
             </div>
             <div className={`text-[10px] ${pos.pnlPercentage >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
               {pos.pnlPercentage.toFixed(2)}%
             </div>
           </div>
        </div>
        
        <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-400">
            <div>Entry: <span className="text-slate-200">${pos.entryPrice.toFixed(2)}</span></div>
            <div>Mark: <span className="text-slate-200">${pos.currentPrice.toFixed(2)}</span></div>
            {pos.liquidationPrice && (
                <div className="col-span-2 text-rose-400 flex items-center gap-1">
                   <span>⚠️ Liq:</span> <span>${pos.liquidationPrice.toFixed(2)}</span>
                </div>
            )}
        </div>
     </div>
  );

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden flex flex-col h-full shadow-2xl">
      <div className="flex border-b border-slate-700 bg-slate-800/50">
        <button onClick={() => setActiveTab('positions')} className={`flex-1 py-3 text-xs font-bold border-b-2 ${activeTab === 'positions' ? 'border-emerald-500 text-white' : 'border-transparent text-slate-400'}`}>POSITIONS</button>
        <button onClick={() => setActiveTab('analytics')} className={`flex-1 py-3 text-xs font-bold border-b-2 ${activeTab === 'analytics' ? 'border-purple-500 text-white' : 'border-transparent text-slate-400'}`}>STATS</button>
        <button onClick={() => setActiveTab('history')} className={`flex-1 py-3 text-xs font-bold border-b-2 ${activeTab === 'history' ? 'border-blue-500 text-white' : 'border-transparent text-slate-400'}`}>LOGS</button>
      </div>

      <div className="flex-1 overflow-auto bg-[#0b0f19] p-4 custom-scrollbar">
        
        {activeTab === 'positions' && (
          <div className="space-y-6">
             {/* Spot Section */}
             <div>
                <h4 className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-2">
                    <Briefcase className="w-3 h-3" /> SPOT HOLDINGS
                </h4>
                <div className="space-y-2">
                    {portfolio.spotPositions.length === 0 ? <p className="text-[10px] text-slate-600 italic">No Spot positions.</p> : 
                     portfolio.spotPositions.map(p => renderPositionCard(p, 'SPOT'))}
                </div>
             </div>

             {/* Futures Section */}
             <div>
                <h4 className="text-xs font-bold text-indigo-400 mb-2 flex items-center gap-2">
                    <Crosshair className="w-3 h-3" /> FUTURES (ACTIVE)
                </h4>
                <div className="space-y-2">
                    {portfolio.futuresPositions.length === 0 ? <p className="text-[10px] text-slate-600 italic">No Futures positions.</p> : 
                     portfolio.futuresPositions.map(p => renderPositionCard(p, 'FUTURES'))}
                </div>
             </div>
          </div>
        )}

        {activeTab === 'analytics' && (
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                    <div className="bg-slate-800 p-2 rounded border border-slate-700">
                        <div className="text-[10px] text-slate-500">Profit Factor</div>
                        <div className="text-lg font-bold text-white">{metrics.profitFactor}</div>
                    </div>
                    <div className="bg-slate-800 p-2 rounded border border-slate-700">
                        <div className="text-[10px] text-slate-500">Drawdown</div>
                        <div className="text-lg font-bold text-rose-400">{metrics.maxDrawdown}%</div>
                    </div>
                </div>
                <div className="h-40 w-full bg-slate-800/20 rounded border border-slate-700 p-1">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                            <defs><linearGradient id="cEq" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#818cf8" stopOpacity={0.3}/><stop offset="95%" stopColor="#818cf8" stopOpacity={0}/></linearGradient></defs>
                            <Area type="monotone" dataKey="equity" stroke="#818cf8" fill="url(#cEq)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        )}

        {activeTab === 'history' && (
             <div className="space-y-2">
                 {portfolio.tradeHistory.map((trade) => (
                   <div key={trade.id} className="flex justify-between items-center text-[10px] p-2 hover:bg-slate-800 rounded border border-transparent hover:border-slate-700">
                     <span className="text-slate-500 w-12">{new Date(trade.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
                     <span className={`font-bold w-10 ${trade.side.includes('BUY') ? 'text-emerald-400' : 'text-rose-400'}`}>{trade.side}</span>
                     <span className="text-white w-16">{trade.symbol}</span>
                     <span className="text-slate-400 flex-1 text-right">{trade.pnl ? `$${trade.pnl.toFixed(2)}` : ''}</span>
                   </div>
                 ))}
             </div>
        )}
      </div>
    </div>
  );
};

export default TradingMonitor;
