import React from 'react';
import { Terminal, Cpu, AlertCircle } from 'lucide-react';

const Header: React.FC = () => {
  const apiKey = import.meta.env?.VITE_GEMINI_API_KEY;
  const isPreview = !apiKey;

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg shadow-lg ${isPreview ? 'bg-amber-600 shadow-amber-500/20' : 'bg-blue-600 shadow-blue-500/20'}`}>
          <Terminal className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">AI 幣安機器人鍛造場</h1>
          <p className="text-xs text-slate-400">
            {isPreview ? '核心驅動：模擬訊號 (Preview Mode)' : '核心驅動：Gemini 2.0 Flash (繁中版)'}
          </p>
        </div>
      </div>
      
      <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${
        isPreview 
          ? 'bg-amber-950/30 border-amber-800/50' 
          : 'bg-slate-800 border-slate-700'
      }`}>
        {isPreview ? (
          <>
             <AlertCircle className="w-4 h-4 text-amber-400" />
             <span className="text-xs font-mono text-amber-400">預覽模式 (MOCK)</span>
          </>
        ) : (
          <>
            <Cpu className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-mono text-emerald-400">系統連線中 (ONLINE)</span>
          </>
        )}
      </div>
    </header>
  );
};

export default Header;