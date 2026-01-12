import React from 'react';
import { Terminal, Cpu } from 'lucide-react';

const Header: React.FC = () => {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-500/20">
          <Terminal className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">AI 幣安機器人鍛造場</h1>
          <p className="text-xs text-slate-400">核心驅動：Gemini 3 Pro (繁中版)</p>
        </div>
      </div>
      <div className="flex items-center gap-2 px-3 py-1 bg-slate-800 rounded-full border border-slate-700">
        <Cpu className="w-4 h-4 text-emerald-400" />
        <span className="text-xs font-mono text-emerald-400">系統連線中 (ONLINE)</span>
      </div>
    </header>
  );
};

export default Header;