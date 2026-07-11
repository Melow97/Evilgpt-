
import React, { useState } from 'react';
import { CloseIcon, SocialIcon, SendIcon, SpinnerIcon } from './Icons';

interface SocialAnalysisModalProps {
  onClose: () => void;
  onSendToAI: (text: string) => void;
}

const SocialAnalysisModal: React.FC<SocialAnalysisModalProps> = ({ onClose, onSendToAI }) => {
  const [url, setUrl] = useState('');
  const [platform, setPlatform] = useState<'youtube' | 'tiktok' | 'instagram' | ''>('');
  const [selectedActions, setSelectedActions] = useState<string[]>(['stats']);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<string | null>(null);

  const apiKey = 'Ys4jhdtTBWszi7';

  const detectPlatform = (inputUrl: string) => {
      if (inputUrl.includes('youtube.com') || inputUrl.includes('youtu.be')) return 'youtube';
      if (inputUrl.includes('tiktok.com')) return 'tiktok';
      if (inputUrl.includes('instagram.com')) return 'instagram';
      return '';
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setUrl(val);
      setPlatform(detectPlatform(val));
  };

  const availableActions = {
      youtube: ['summarize', 'stats', 'comments', 'transcript'],
      tiktok: ['summarize', 'stats', 'comments', 'transcript', 'channel-stats'],
      instagram: ['stats', 'channel-stats'],
      '': []
  };

  const toggleAction = (action: string) => {
      setSelectedActions(prev => 
          prev.includes(action) ? prev.filter(a => a !== action) : [...prev, action]
      );
  };

  const executeAnalysis = async () => {
      if (!url || !platform) return;
      setIsLoading(true);
      setResults(null);
      
      let finalReport = `**Social Media Analysis Report**\nTarget: ${url}\nPlatform: ${platform.toUpperCase()}\n\n`;

      try {
          for (const action of selectedActions) {
              const apiUrl = `https://api.socialkit.dev/${platform}/${action}?access_key=${apiKey}&url=${encodeURIComponent(url)}`;
              
              finalReport += `### ${action.toUpperCase()}\n`;
              try {
                  const res = await fetch(apiUrl);
                  if (res.ok) {
                      const data = await res.json();
                      finalReport += `\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`\n\n`;
                  } else {
                      finalReport += `*Request failed with status: ${res.status}*\n\n`;
                  }
              } catch (err) {
                  finalReport += `*Error fetching data: ${err instanceof Error ? err.message : 'Unknown'}*\n\n`;
              }
          }
          setResults(finalReport);
      } catch (error) {
          setResults(`Critical Error: ${error instanceof Error ? error.message : 'Unknown'}`);
      } finally {
          setIsLoading(false);
      }
  };

  const sendToChat = () => {
      if (results) {
          onSendToAI(results);
          onClose();
      }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1C1C1E] border border-pink-500/30 rounded-xl shadow-[0_0_30px_rgba(236,72,153,0.1)] w-full max-w-3xl h-[85vh] flex flex-col font-mono relative overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-800 bg-[#131314] z-10">
          <div className="flex items-center space-x-2">
              <SocialIcon className="text-pink-500 w-6 h-6" />
              <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-500">Social Reconnaissance</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><CloseIcon /></button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-grow z-10">
            {/* Input Section */}
            <div className="space-y-2">
                <label className="text-xs text-gray-500 font-bold uppercase tracking-widest">Target URL</label>
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        value={url}
                        onChange={handleUrlChange}
                        placeholder="Paste YouTube, TikTok, or Instagram Link..."
                        className="flex-grow bg-black border border-gray-700 rounded-lg px-4 py-3 text-pink-400 focus:outline-none focus:border-pink-500 placeholder-gray-700 transition-colors"
                    />
                </div>
                {platform && (
                    <div className="text-xs text-green-400">
                        ✓ Detected Platform: <span className="font-bold">{platform.toUpperCase()}</span>
                    </div>
                )}
            </div>

            {/* Actions Selection */}
            {platform && (
                <div className="space-y-2">
                    <label className="text-xs text-gray-500 font-bold uppercase tracking-widest">Select Modules</label>
                    <div className="flex flex-wrap gap-2">
                        {availableActions[platform].map(action => (
                            <button
                                key={action}
                                onClick={() => toggleAction(action)}
                                className={`px-4 py-2 rounded-full text-xs font-bold border transition-all ${selectedActions.includes(action) ? 'bg-pink-900/30 border-pink-500 text-pink-400 shadow-[0_0_10px_rgba(236,72,153,0.3)]' : 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-500'}`}
                            >
                                {action.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Execute Button */}
            <button 
                onClick={executeAnalysis}
                disabled={isLoading || !url || !platform || selectedActions.length === 0}
                className="w-full py-4 bg-gradient-to-r from-pink-600 to-purple-600 rounded-lg font-bold text-white tracking-widest hover:from-pink-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
            >
                {isLoading ? <span className="flex items-center justify-center gap-2"><SpinnerIcon /> EXTRACTION IN PROGRESS...</span> : 'INITIATE ANALYSIS'}
            </button>

            {/* Results Area */}
            {results && (
                <div className="mt-4 p-4 bg-black border border-gray-800 rounded-lg">
                    <div className="flex justify-between items-center mb-2 border-b border-gray-800 pb-2">
                        <span className="text-xs text-gray-500">ANALYSIS OUTPUT</span>
                        <button onClick={sendToChat} className="text-xs flex items-center gap-1 text-green-400 hover:text-green-300">
                            <SendIcon className="w-3 h-3" /> SEND TO AI
                        </button>
                    </div>
                    <pre className="text-xs text-gray-300 whitespace-pre-wrap overflow-x-hidden font-mono max-h-64 overflow-y-auto custom-scrollbar">
                        {results}
                    </pre>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default SocialAnalysisModal;