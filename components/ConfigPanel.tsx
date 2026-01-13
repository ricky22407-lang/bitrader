
import React, { useState } from 'react';
import { BotConfig } from '../types';
import { Power, Gauge, ShieldAlert, Activity, Skull, Crosshair, RefreshCw, MousePointerClick, Zap } from 'lucide-react';
import { setTradingMode } from '../services/exchangeService';

interface ConfigPanelProps {
  config: BotConfig;
  setConfig: React.Dispatch<React.SetStateAction<BotConfig>>;
  isRunning: boolean;
  onToggle: () => void;
  onPanic: () => void;
  onManualTrade: (side: 'BUY' | 'SELL', amountPct: number) => void;
  onForceScan: () => void;
  portfolioValue: number;
}

const ConfigPanel: React.FC<ConfigPanelProps> = ({ 
  config, setConfig, isRunning, onToggle, onPanic, onManualTrade, onForceScan, portfolioValue 
}) => {
  
  const [manualLoading, setManualLoading] = useState(false);

  const handleInputChange = (key: keyof BotConfig, value: any) => {
    if (isRunning) return; 
    setConfig(prev => ({ ...prev, [key]: value }));
    if (key === 'tradingMode') {
      setTradingMode(value);
    }
  };

  const handleManualAction = (side: 'BUY' | 'SELL', pct: number) => {
    setManualLoading(true);
    onManualTrade(side, pct);
    setTimeout(() => setManualLoading(false), 1000);
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 flex flex-col gap-6 h-full overflow-y-auto custom-scrollbar">
      {/* Title */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-700">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Gauge className="w-5 h-5 text-indigo-400" />
          Command Center
        </h2>
        <div className={`px-2 py-0.5 rounded text-xs font-mono border ${isRunning ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-slate-700 border-slate-600 text-slate-400'}`}>
          {isRunning ? 'AUTO-PILOT ON' : 'MANUAL / STANDBY'}
        </div>
      </div>

      {/* Main Auto-Pilot Control */}
      <div className="space-y-3">
        <button
            onClick={onToggle}
            className={`w-full py-4 px-4 rounded-xl font-bold text-white transition-all shadow-xl flex items-center justify-center gap-3 border
            ${isRunning 
                ? 'bg-emerald-600 border-emerald-500 hover:bg-emerald-500 shadow-emerald-500/20' 
                : 'bg-slate-700 border-slate-600 hover:bg-slate-600 text-slate-300'
            }`}
        >
            <Power className="w-6 h-6" />
            {isRunning ? "SYSTEM ARMED" : "ENGAGE AUTO-PILOT"}
        </button>

        {/* Force Scan Button (Only when running) */}
        {isRunning && (
             <button
                onClick={onForceScan}
                className="w-full py-2 px-4 rounded-lg text-xs font-bold text-indigo-200 bg-indigo-900/40 border border-indigo-500/30 hover:bg-indigo-900/60 transition-all flex items-center justify-center gap-2"
             >
                <RefreshCw className="w-3 h-3" />
                FORCE AI ANALYSIS NOW
             </button>
        )}
      </div>

      {/* TACTICAL OVERRIDE */}
      <div className="bg-slate-900/60 rounded-xl border border-slate-700 p-4 space-y-3">
         <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
            <Crosshair className="w-3 h-3 text-amber-400" /> Tactical Override
         </div>
         
         <div className="grid grid-cols-2 gap-3">
             <div className="space-y-2">
                 <button 
                    disabled={manualLoading}
                    onClick={() => handleManualAction('BUY', 0.25)}
                    className="w-full py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded transition-all flex items-center justify-center gap-1"
                 >
                    BUY 25%
                 </button>
                 <button 
                    disabled={manualLoading}
                    onClick={() => handleManualAction('BUY', 0.5)}
                    className="w-full py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded transition-all flex items-center justify-center gap-1"
                 >
                    <MousePointerClick className="w-3 h-3" /> BUY 50%
                 </button>
             </div>
             
             <div className="space-y-2">
                 <button 
                    disabled={manualLoading}
                    onClick={() => handleManualAction('SELL', 0.5)}
                    className="w-full py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-bold rounded transition-all flex items-center justify-center gap-1"
                 >
                    SELL 50%
                 </button>
                 <button 
                    disabled={manualLoading}
                    onClick={() => handleManualAction('SELL', 1.0)}
                    className="w-full py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-bold rounded transition-all flex items-center justify-center gap-1"
                 >
                    <MousePointerClick className="w-3 h-3" /> SELL ALL
                 </button>
             </div>
         </div>
      </div>

      {/* Emergency Kill Switch */}
      {isRunning && (
          <button
            onClick={onPanic}
            className="w-full py-3 px-4 rounded-xl font-bold text-white transition-all shadow-xl flex items-center justify-center gap-2 border bg-rose-900/80 border-rose-600 hover:bg-rose-800 animate-pulse"
          >
            <Skull className="w-5 h-5 text-rose-200" />
            PANIC: LIQUIDATE & STOP
          </button>
      )}

      <div className="h-px bg-slate-700 my-2"></div>

      {/* Configuration Settings */}
      <div className="space-y-6">
        
        {/* TRADING MODE SELECTOR */}
        <div className={`space-y-2 ${isRunning ? 'opacity-50 pointer-events-none' : ''}`}>
           <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
             <Zap className="w-4 h-4 text-amber-400" /> Execution Mode
           </label>
           <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-700">
             <button
               onClick={() => handleInputChange('tradingMode', 'SIMULATION')}
               className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${config.tradingMode === 'SIMULATION' ? 'bg-slate-600 text-white' : 'text-slate-500'}`}
             >
               SIMULATION
             </button>
             <button
               onClick={() => handleInputChange('tradingMode', 'REAL_MONEY')}
               className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${config.tradingMode === 'REAL_MONEY' ? 'bg-rose-600 text-white shadow-lg shadow-rose-900/50' : 'text-slate-500'}`}
             >
               REAL MONEY
             </button>
           </div>
        </div>

        {/* Smart Pulse Indicator */}
        <div className={`space-y-2 ${isRunning ? 'opacity-80' : ''}`}>
           <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
             <Activity className="w-4 h-4 text-emerald-400" /> Smart Pulse (Auto)
           </label>
           <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700 text-xs text-slate-400">
               {isRunning ? (
                   <span className="flex items-center gap-2">
                       <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                       AI adapts scan rate based on market volatility (ATR).
                   </span>
               ) : (
                   "System adjusts heartbeat (30s - 5m) automatically."
               )}
           </div>
        </div>

        {/* Risk Level */}
        <div className={`space-y-2 ${isRunning ? 'opacity-50 pointer-events-none' : ''}`}>
          <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" /> Risk Protocol
          </label>
          <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-700 mb-2">
            {['LOW', 'MEDIUM', 'HIGH'].map((level) => (
              <button
                key={level}
                onClick={() => handleInputChange('riskLevel', level)}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                  config.riskLevel === level 
                    ? level === 'HIGH' ? 'bg-red-500 text-white' : level === 'MEDIUM' ? 'bg-amber-500 text-white' : 'bg-blue-500 text-white'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default ConfigPanel;
