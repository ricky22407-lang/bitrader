import React, { useState } from 'react';
import { Copy, Check, FileCode, FileText, Download } from 'lucide-react';
import { GeneratedContent } from '../types';

interface CodeViewerProps {
  content: GeneratedContent | null;
  isGenerating: boolean;
}

const CodeViewer: React.FC<CodeViewerProps> = ({ content, isGenerating }) => {
  const [activeTab, setActiveTab] = useState<'code' | 'summary'>('code');
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!content) return;
    const textToCopy = activeTab === 'code' ? content.code : content.summary;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!content && !isGenerating) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-xl h-full flex flex-col items-center justify-center text-slate-500 min-h-[500px]">
        <FileCode className="w-16 h-16 mb-4 opacity-50" />
        <p className="text-lg font-medium">準備就緒 (Ready)</p>
        <p className="text-sm">請配置左側參數並點擊生成按鈕</p>
      </div>
    );
  }

  if (isGenerating) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-xl h-full flex flex-col items-center justify-center text-slate-400 min-h-[500px]">
        <div className="relative w-16 h-16 mb-4">
          <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
        </div>
        <p className="animate-pulse">正在諮詢 Gemini AI...</p>
        <p className="text-xs text-slate-600 mt-2">撰寫 Python 模組中...</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden flex flex-col h-full min-h-[500px] shadow-2xl">
      {/* Tabs Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveTab('code')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'code' 
                ? 'bg-blue-600/10 text-blue-400' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
            }`}
          >
            <FileCode className="w-4 h-4" />
            bot.py (原始碼)
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'summary' 
                ? 'bg-emerald-600/10 text-emerald-400' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
            }`}
          >
            <FileText className="w-4 h-4" />
            階段報告 (Summary)
          </button>
        </div>
        <div className="flex items-center gap-2">
           <button
            onClick={handleCopy}
            className="p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-700"
            title="複製內容"
          >
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto bg-[#0d1117] p-4">
        {activeTab === 'code' ? (
          <pre className="text-sm font-mono leading-relaxed text-slate-300">
            <code>{content?.code}</code>
          </pre>
        ) : (
          <div className="prose prose-invert max-w-none">
            <div className="whitespace-pre-wrap text-slate-300 leading-relaxed font-sans">
              {content?.summary}
            </div>
          </div>
        )}
      </div>
      
      {/* Footer Status */}
      <div className="px-4 py-2 bg-slate-800 border-t border-slate-700 flex justify-between items-center text-xs text-slate-500 font-mono">
        <span>Ln {activeTab === 'code' ? content?.code.split('\n').length : 'N/A'}, Col 1</span>
        <span>UTF-8</span>
      </div>
    </div>
  );
};

export default CodeViewer;