import React, { useState, useEffect } from 'react';
import { CloseIcon, CheckIcon, ResetIcon, ShowIcon, HideIcon, ServerIcon } from './Icons';

interface SettingsModalProps {
  onClose: () => void;
  onSave: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, onSave }) => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [savedStatus, setSavedStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    const storedKey = localStorage.getItem('GEMINI_API_KEY') || '';
    setApiKey(storedKey);
  }, []);

  const handleSave = () => {
    try {
      localStorage.setItem('GEMINI_API_KEY', apiKey.trim());
      setSavedStatus('success');
      onSave();
      setTimeout(() => setSavedStatus('idle'), 3000);
    } catch (e) {
      setSavedStatus('error');
      setTimeout(() => setSavedStatus('idle'), 3000);
    }
  };

  const handleClear = () => {
    localStorage.removeItem('GEMINI_API_KEY');
    setApiKey('');
    setSavedStatus('success');
    onSave();
    setTimeout(() => setSavedStatus('idle'), 3000);
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-[#0f0f11] border border-red-500/30 rounded-xl shadow-[0_0_40px_rgba(239,68,68,0.2)] w-full max-w-md p-6 flex flex-col font-mono relative overflow-hidden">
        {/* Cyberpunk ambient highlight */}
        <div className="absolute top-0 left-0 w-20 h-20 bg-red-500/10 blur-2xl -translate-x-5 -translate-y-5"></div>
        
        {/* Header */}
        <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-3 relative z-10">
          <div className="flex items-center space-x-2">
            <ServerIcon className="text-red-500 w-5 h-5 animate-pulse" />
            <h2 className="text-lg font-bold text-red-500 font-orbitron tracking-wider">SYSTEM CONFIG</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-800 rounded-full transition-colors text-gray-500 hover:text-white">
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="space-y-5 relative z-10">
          <div>
            <label className="block text-xs font-bold text-red-400 uppercase tracking-widest mb-2">
              Gemini API Key
            </label>
            <div className="relative flex items-center bg-[#131314] border border-gray-800 rounded-lg overflow-hidden focus-within:border-red-500/50">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste Gemini API Key..."
                className="w-full bg-transparent px-4 py-3 text-sm text-gray-200 placeholder-gray-700 outline-none font-mono"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="p-3 text-gray-500 hover:text-gray-300 transition-colors"
                title={showKey ? "Hide API Key" : "Show API Key"}
              >
                {showKey ? <HideIcon className="w-4 h-4" /> : <ShowIcon className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-gray-500 mt-2 leading-relaxed">
              Your API key is stored locally in your browser's <span className="text-red-400 font-bold">localStorage</span> and never transmitted to external third-party servers. If empty, the system defaults to the integrated API key.
            </p>
          </div>

          {/* Status Message */}
          {savedStatus === 'success' && (
            <div className="p-2.5 bg-green-950/20 border border-green-500/30 text-green-400 text-xs text-center rounded">
              Config successfully saved and loaded!
            </div>
          )}
          {savedStatus === 'error' && (
            <div className="p-2.5 bg-red-950/20 border border-red-500/30 text-red-400 text-xs text-center rounded">
              Error storing credentials. Local storage quota exceeded or disabled.
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleClear}
              disabled={!apiKey}
              className="flex-1 py-2.5 bg-gray-900 border border-gray-800 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors text-xs font-bold"
            >
              CLEAR KEY
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-2.5 bg-gradient-to-r from-red-800 to-red-950 text-white hover:from-red-700 hover:to-red-900 border border-red-600/50 rounded-lg transition-all text-xs font-bold shadow-lg"
            >
              SAVE CONFIG
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
