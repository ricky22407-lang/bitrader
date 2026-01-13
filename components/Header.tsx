
import React from 'react';
import { Bot, Volume2, VolumeX, Settings } from 'lucide-react';

interface HeaderProps {
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenSettings: () => void;
}

const Header: React.FC<HeaderProps> = ({ isMuted, onToggleMute, onOpenSettings }) => {
  const isEnvConfigured = !!process.env.API_KEY;

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg shadow-lg ${isEnvConfigured ? 'bg-indigo-600 shadow-indigo-500/20' : 'bg-slate-700'}`}>
          <Bot className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            AI Trader <span className="text-indigo-400 font-light">| Autonomous Agent</span>
          </h1>
          <p className="text-xs text-slate-400 font-mono">
            Net ID: G-PRO-2.0-LIVE
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-950 border border-slate-800 hidden sm:flex">
           <div className={`w-2 h-2 rounded-full ${isEnvConfigured ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></div>
           <span className="text-xs font-mono text-slate-300">
             {isEnvConfigured ? 'ENV KEYS LOADED' : 'MISSING KEYS'}
           </span>
        </div>
        
        <div className="flex items-center gap-2">
             <button 
              onClick={onOpenSettings}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors border border-slate-700"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            <button 
              onClick={onToggleMute}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors border border-slate-700"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
