import React from 'react';
import { BotConfig, StrategyType } from '../types';
import { Settings, Sliders, Activity, MessageSquare, Layers, Coins } from 'lucide-react';

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

  const handleInputChange = (key: keyof BotConfig, value: string | number | boolean) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handlePairsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pairs = e.target.value.split(',').map(p => p.trim()).filter(p => p.length > 0);
    setConfig(prev => ({ ...prev, pairs }));
  };

  const toggleFeature = (key: keyof Pick<BotConfig, 'includeLogging' | 'includeWebsockets' | 'enableTelegram' | 'isTestnet'>) => {
    setConfig(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 flex flex-col gap-6 h-full overflow-y-auto">
      <div className="flex items-center gap-2 pb-4 border-b border-slate-700">
        <Settings className="w-5 h-5 text-blue-400" />
        <h2 className="text-lg font-semibold text-white">機器人參數設定</h2>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded text-xs text-blue-200/80 leading-relaxed">
        <p>配置下方的交易策略與參數，點擊「生成」按鈕即可獲得完整的 Python 交易機器人原始碼。API 金鑰請在本地運行的 config.json 中設定。</p>
      </div>

      {/* Pairs Input */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
          <Coins className="w-4 h-4" /> 交易對 (Symbols)
        </label>
        <input 
          type="text" 
          value={config.pairs.join(', ')}
          onChange={handlePairsChange}
          placeholder="BTC/USDT, ETH/USDT"
          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-sm text-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
        />
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

      {/* Risk Percentage */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
          <Sliders className="w-4 h-4" /> 單筆風險 (Risk Per Trade)
        </label>
        <div className="flex items-center gap-3">
            <input 
              type="range" 
              min="1" 
              max="20" 
              value={config.riskPercentage} 
              onChange={(e) => handleInputChange('riskPercentage', parseInt(e.target.value))}
              className="flex-1 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <span className="text-slate-200 font-mono w-10 text-center">{config.riskPercentage}%</span>
        </div>
      </div>

      {/* Grid Levels */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
          <Layers className="w-4 h-4" /> 網格層數 (Grid Levels)
        </label>
        <div className="flex items-center gap-3">
            <input 
              type="range" 
              min="3" 
              max="20" 
              value={config.gridLevels} 
              onChange={(e) => handleInputChange('gridLevels', parseInt(e.target.value))}
              className="flex-1 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <span className="text-slate-200 font-mono w-10 text-center">{config.gridLevels}</span>
        </div>
      </div>

      {/* Toggles */}
      <div className="space-y-4 pt-2 border-t border-slate-700">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-300">啟用詳細日誌 (Logs)</span>
          <button 
            onClick={() => toggleFeature('includeLogging')}
            className={`w-10 h-5 rounded-full transition-colors relative ${config.includeLogging ? 'bg-blue-600' : 'bg-slate-600'}`}
          >
            <span className={`absolute top-1 left-1 bg-white w-3 h-3 rounded-full transition-transform ${config.includeLogging ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-300">啟用 WebSocket 串流</span>
          <button 
            onClick={() => toggleFeature('includeWebsockets')}
            className={`w-10 h-5 rounded-full transition-colors relative ${config.includeWebsockets ? 'bg-blue-600' : 'bg-slate-600'}`}
          >
            <span className={`absolute top-1 left-1 bg-white w-3 h-3 rounded-full transition-transform ${config.includeWebsockets ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-300 flex items-center gap-2">
             <MessageSquare className="w-3 h-3" /> Telegram 通知
          </span>
          <button 
            onClick={() => toggleFeature('enableTelegram')}
            className={`w-10 h-5 rounded-full transition-colors relative ${config.enableTelegram ? 'bg-blue-600' : 'bg-slate-600'}`}
          >
            <span className={`absolute top-1 left-1 bg-white w-3 h-3 rounded-full transition-transform ${config.enableTelegram ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>
         <div className="flex items-center justify-between">
          <span className="text-sm text-slate-300">Testnet 模式</span>
          <button 
            onClick={() => toggleFeature('isTestnet')}
            className={`w-10 h-5 rounded-full transition-colors relative ${config.isTestnet ? 'bg-yellow-600' : 'bg-slate-600'}`}
          >
            <span className={`absolute top-1 left-1 bg-white w-3 h-3 rounded-full transition-transform ${config.isTestnet ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>

      <div className="mt-auto pt-4 pb-2">
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