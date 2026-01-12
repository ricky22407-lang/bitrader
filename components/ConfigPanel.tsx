import React from 'react';
import { BotConfig, StrategyType, RiskLevel } from '../types';
import { Settings, Sliders, Activity } from 'lucide-react';

interface ConfigPanelProps {
  config: BotConfig;
  setConfig: React.Dispatch<React.SetStateAction<BotConfig>>;
  onGenerate: () => void;
  isGenerating: boolean;
}

const ConfigPanel: React.FC<ConfigPanelProps> = ({ config, setConfig, onGenerate, isGenerating }) => {
  
  const handleStrategyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setConfig(prev => ({ ...prev, strategy: e.target.value as StrategyType }));
  };

  const handleRiskChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setConfig(prev => ({ ...prev, riskLevel: e.target.value as RiskLevel }));
  };

  const toggleFeature = (key: keyof Pick<BotConfig, 'includeLogging' | 'includeWebsockets'>) => {
    setConfig(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 flex flex-col gap-6 h-full">
      <div className="flex items-center gap-2 pb-4 border-b border-slate-700">
        <Settings className="w-5 h-5 text-blue-400" />
        <h2 className="text-lg font-semibold text-white">機器人參數設定</h2>
      </div>

      {/* Strategy Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
          <Activity className="w-4 h-4" /> 交易策略 (Strategy)
        </label>
        <select 
          value={config.strategy}
          onChange={handleStrategyChange}
          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-sm text-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
        >
          {Object.values(StrategyType).map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Risk Level */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
          <Sliders className="w-4 h-4" /> 風險管理 (Risk)
        </label>
        <select 
          value={config.riskLevel}
          onChange={handleRiskChange}
          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-sm text-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
        >
          {Object.values(RiskLevel).map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {/* Toggles */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-300">啟用詳細日誌 (Detailed Logs)</span>
          <button 
            onClick={() => toggleFeature('includeLogging')}
            className={`w-12 h-6 rounded-full transition-colors relative ${config.includeLogging ? 'bg-blue-600' : 'bg-slate-600'}`}
          >
            <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${config.includeLogging ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-300">啟用 WebSocket 串流</span>
          <button 
            onClick={() => toggleFeature('includeWebsockets')}
            className={`w-12 h-6 rounded-full transition-colors relative ${config.includeWebsockets ? 'bg-blue-600' : 'bg-slate-600'}`}
          >
            <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${config.includeWebsockets ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>

      <div className="mt-auto">
        <button
          onClick={onGenerate}
          disabled={isGenerating}
          className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-all shadow-lg 
            ${isGenerating 
              ? 'bg-slate-700 cursor-not-allowed opacity-75' 
              : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/25 active:scale-95'
            }`}
        >
          {isGenerating ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              AI 生成中...
            </span>
          ) : (
            "生成 Python 機器人代碼"
          )}
        </button>
      </div>
    </div>
  );
};

export default ConfigPanel;