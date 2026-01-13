
import React, { useState, useEffect } from 'react';
import { X, Key, Shield, Save, Eye, EyeOff, Send } from 'lucide-react';
import { UserSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onSave: (newSettings: UserSettings) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSave }) => {
  const [localSettings, setLocalSettings] = useState<UserSettings>(settings);
  const [showSecrets, setShowSecrets] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings, isOpen]);

  const handleChange = (key: keyof UserSettings, value: any) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-800/50">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Key className="w-5 h-5 text-indigo-400" />
            System Settings
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded-full text-slate-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
          
          {/* Binance Keys */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
               <Shield className="w-3 h-3 text-emerald-400" /> Binance API (Optional)
            </div>
            
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500">API Key</label>
              <div className="relative">
                <input 
                  type={showSecrets ? "text" : "password"}
                  value={localSettings.binanceApiKey || ''}
                  onChange={(e) => handleChange('binanceApiKey', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-3 pr-10 py-2 text-xs text-white focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                />
                <button 
                  onClick={() => setShowSecrets(!showSecrets)}
                  className="absolute right-3 top-2 text-slate-500 hover:text-slate-300"
                >
                  {showSecrets ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
              </div>
            </div>
            
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500">Secret Key</label>
              <input 
                type={showSecrets ? "text" : "password"}
                value={localSettings.binanceSecretKey || ''}
                onChange={(e) => handleChange('binanceSecretKey', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
              />
            </div>
          </div>

          <div className="h-px bg-slate-800" />

          {/* Telegram Settings */}
          <div className="space-y-4">
             <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
               <Send className="w-3 h-3 text-blue-400" /> Telegram Notifications
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500">Bot Token (from @BotFather)</label>
              <input 
                type="text"
                value={localSettings.telegramBotToken || ''}
                onChange={(e) => handleChange('telegramBotToken', e.target.value)}
                placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono"
              />
            </div>
             <div className="space-y-1">
              <label className="text-[10px] text-slate-500">Chat ID (from @userinfobot)</label>
              <input 
                type="text"
                value={localSettings.telegramChatId || ''}
                onChange={(e) => handleChange('telegramChatId', e.target.value)}
                placeholder="123456789"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono"
              />
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-800/30 flex justify-end">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-lg shadow-indigo-500/20 transition-all hover:scale-105 text-sm"
          >
            <Save className="w-4 h-4" />
            Save Configuration
          </button>
        </div>

      </div>
    </div>
  );
};

export default SettingsModal;
