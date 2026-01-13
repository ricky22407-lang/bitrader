import React, { useEffect, useState } from 'react';
import { X, Download, Copy, Check } from 'lucide-react';
import { BotConfig } from '../types';
import { generatePythonBot } from '../utils/botTemplate';

interface CodeViewerProps {
  config: BotConfig;
  isOpen: boolean;
  onClose: () => void;
}

const CodeViewer: React.FC<CodeViewerProps> = ({ config, isOpen, onClose }) => {
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCode(generatePythonBot(config));
    }
  }, [isOpen, config]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([code], {type: 'text/x-python'});
    element.href = URL.createObjectURL(file);
    element.download = "ai_council_bot.py";
    document.body.appendChild(element); // Required for this to work in FireFox
    element.click();
    document.body.removeChild(element);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-800/50">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-emerald-400">⚡</span> Python Bot Forge
            </h2>
            <p className="text-xs text-slate-400 font-mono mt-1">
              Generated based on your current configuration (Symbol: {config.symbol}, Risk: {config.riskLevel})
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Code Content */}
        <div className="flex-1 overflow-auto p-0 relative group bg-[#0d1117]">
          <pre className="p-6 text-sm font-mono text-slate-300 leading-relaxed tab-4">
            <code>{code}</code>
          </pre>
        </div>

        {/* Footer / Actions */}
        <div className="p-6 border-t border-slate-800 bg-slate-800/30 flex justify-end gap-4">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-all"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied' : 'Copy Code'}
          </button>
          
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-lg shadow-indigo-500/20 transition-all hover:scale-105"
          >
            <Download className="w-4 h-4" />
            Download .py
          </button>
        </div>
      </div>
    </div>
  );
};

export default CodeViewer;