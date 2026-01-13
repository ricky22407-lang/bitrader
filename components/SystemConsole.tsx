
import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Cpu, AlertTriangle, MessageSquare, Search, Bug, XCircle, ArrowDown } from 'lucide-react';
import { LogEntry } from '../types';

interface SystemConsoleProps {
  logs: LogEntry[];
}

const SystemConsole: React.FC<SystemConsoleProps> = ({ logs }) => {
  const [filter, setFilter] = useState<'ALL' | 'AI' | 'ERROR'>('ALL');
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logic
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll, filter]);

  const filteredLogs = logs.filter(log => {
    if (filter === 'ALL') return true;
    if (filter === 'ERROR') return log.type === 'ERROR';
    if (filter === 'AI') return ['AI', 'COUNCIL', 'SCOUT'].includes(log.type);
    return true;
  });

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      // If user scrolls up, disable auto-scroll
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setAutoScroll(isAtBottom);
    }
  };

  return (
    <div className="bg-[#0f172a] border border-slate-700 rounded-xl overflow-hidden flex flex-col h-full shadow-2xl">
      {/* Console Header / Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-slate-300 font-mono text-sm">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span>SYSTEM_LOGS</span>
          </div>
          
          {/* Filters */}
          <div className="flex bg-slate-900 rounded-lg p-0.5 border border-slate-700">
            <button 
              onClick={() => setFilter('ALL')}
              className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${filter === 'ALL' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              ALL
            </button>
            <button 
              onClick={() => setFilter('AI')}
              className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all flex items-center gap-1 ${filter === 'AI' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Cpu className="w-3 h-3" /> BRAIN
            </button>
            <button 
              onClick={() => setFilter('ERROR')}
              className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all flex items-center gap-1 ${filter === 'ERROR' ? 'bg-rose-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Bug className="w-3 h-3" /> DEBUG
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
            {!autoScroll && (
                <button 
                    onClick={() => setAutoScroll(true)}
                    className="text-xs text-indigo-400 flex items-center gap-1 animate-pulse mr-4"
                >
                    <ArrowDown className="w-3 h-3" /> Resume Auto-scroll
                </button>
            )}
            <div className="text-[10px] text-slate-500 font-mono">
                v3.0.1-stable
            </div>
        </div>
      </div>

      {/* Logs Output Area */}
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs bg-[#0b0f19] custom-scrollbar"
      >
        {filteredLogs.length === 0 && (
          <div className="text-slate-600 text-center mt-10 italic">
            -- No logs available --
          </div>
        )}

        {filteredLogs.map((log) => (
          <div key={log.id} className="animate-fade-in hover:bg-white/5 p-1 rounded transition-colors group">
            <div className="flex gap-3">
              {/* Timestamp */}
              <span className="text-slate-500 shrink-0 select-none">
                [{new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })}]
              </span>

              {/* Log Content */}
              <div className="flex-1 break-words">
                
                {/* TYPE: ERROR */}
                {log.type === 'ERROR' && (
                  <div className="text-rose-400 flex items-start gap-2">
                    <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{log.message}</span>
                  </div>
                )}

                {/* TYPE: SCOUT (Gemini Flash Observations) */}
                {log.type === 'SCOUT' && (
                  <div className="text-blue-300">
                    <div className="flex items-center gap-2 font-bold mb-1">
                        <Search className="w-3 h-3" /> SCOUT REPORT
                    </div>
                    <span className="opacity-80">{log.message}</span>
                  </div>
                )}

                {/* TYPE: COUNCIL (The Debate) */}
                {log.type === 'COUNCIL' && (
                    <div className="bg-slate-800/30 border border-indigo-500/20 rounded p-3 mt-1">
                        <div className="flex items-center gap-2 text-indigo-400 font-bold mb-2 border-b border-indigo-500/20 pb-1">
                            <MessageSquare className="w-3 h-3" /> COUNCIL SESSION
                        </div>
                        
                        {/* The Decision Reason */}
                        <div className="mb-3 text-slate-200">
                           <span className="text-slate-400">CONCLUSION:</span> {log.message}
                        </div>

                        {/* The Debate Logs (If metadata exists) */}
                        {log.metadata?.debate && (
                            <div className="space-y-2 pl-2 border-l-2 border-indigo-500/10">
                                {log.metadata.debate.map((turn: any, i: number) => (
                                    <div key={i} className="flex flex-col gap-0.5">
                                        <span className={`font-bold text-[10px] uppercase ${
                                            turn.speaker.includes('Gemini') ? 'text-cyan-400' : 
                                            turn.speaker.includes('Grok') ? 'text-purple-400' : 
                                            turn.speaker.includes('News') ? 'text-orange-400' :
                                            'text-emerald-400'
                                        }`}>
                                            {turn.speaker}
                                        </span>
                                        <span className="text-slate-400 pl-2">{turn.message}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        {/* Confidence Score */}
                        {log.metadata?.confidence !== undefined && (
                            <div className="mt-2 text-[10px] text-indigo-300/50 text-right">
                                Confidence Score: {log.metadata.confidence}%
                            </div>
                        )}
                    </div>
                )}

                {/* TYPE: TRADE */}
                {log.type === 'TRADE' && (
                    <span className="text-emerald-400 font-bold">
                        {log.message}
                    </span>
                )}

                {/* TYPE: INFO (Standard) */}
                {log.type === 'INFO' && (
                    <span className="text-slate-300">
                        {log.message}
                    </span>
                )}
              </div>
            </div>
          </div>
        ))}
        {/* Invisible div to track bottom */}
        <div />
      </div>
    </div>
  );
};

export default SystemConsole;
