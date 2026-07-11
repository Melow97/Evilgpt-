
// Fix: Adhered to Gemini API guidelines by removing hardcoded API key and API key checks. The API key is now sourced from process.env.API_KEY.
import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import { AttachedFile } from '../types';
import { CloseIcon, DownloadIcon, SendIcon, SpinnerIcon, PaintBrushIcon } from './Icons';

interface ImageGeneratorModalProps {
  onClose: () => void;
  onSend: (file: AttachedFile) => void;
}

const ImageGeneratorModal: React.FC<ImageGeneratorModalProps> = ({ onClose, onSend }) => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
        setError("Please enter a prompt.");
        return;
    }
    setIsLoading(true);
    setError(null);
    setGeneratedImage(null);

    try {
        const storedKey = localStorage.getItem('GEMINI_API_KEY') || import.meta.env.VITE_GEMINI_API_KEY || '';
        const ai = new GoogleGenAI({ apiKey: storedKey });
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
              numberOfImages: 1,
              outputMimeType: 'image/png',
              aspectRatio: '1:1',
            },
        });
        const base64ImageBytes = response.generatedImages[0].image.imageBytes;
        const imageUrl = `data:image/png;base64,${base64ImageBytes}`;
        setGeneratedImage(imageUrl);
    } catch (err) {
        console.error("Image generation failed:", err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred during image generation.');
    } finally {
        setIsLoading(false);
    }
  };

  const handleSendToChat = () => {
    if (!generatedImage) return;
    
    fetch(generatedImage)
      .then(res => res.blob())
      .then(blob => {
        const file = new File([blob], `${prompt.slice(0, 20)}.png`, { type: 'image/png' });
        onSend({ file, type: 'image', preview: generatedImage });
        onClose();
      });
  };

  const handleDownload = () => {
      if (!generatedImage) return;
      const link = document.createElement('a');
      link.href = generatedImage;
      link.download = `wormgpt-generated-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-40 flex items-center justify-center backdrop-blur-sm">
      <div className="bg-[#0f0f11] border-2 border-red-500/50 rounded-2xl shadow-[0_0_50px_rgba(239,68,68,0.3)] w-full max-w-2xl p-8 flex flex-col max-h-[90vh] relative overflow-hidden">
        {/* Cyberpunk decorative elements */}
        <div className="absolute top-0 left-0 w-24 h-24 bg-red-600/20 blur-3xl -translate-x-10 -translate-y-10"></div>
        <div className="absolute bottom-0 right-0 w-32 h-32 bg-orange-600/20 blur-3xl translate-x-10 translate-y-10"></div>
        
        <div className="flex justify-between items-center mb-6 relative z-10">
          <h2 className="text-3xl font-bold font-orbitron text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-orange-400 to-red-500 animate-gradient-x flex items-center">
            <PaintBrushIcon className="mr-3 w-8 h-8 text-red-400" />
            Neural Canvas
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full transition-colors text-gray-400 hover:text-white border border-transparent hover:border-gray-600"><CloseIcon /></button>
        </div>
        
        <div className="flex-grow overflow-y-auto pr-2 relative z-10 custom-scrollbar">
            <div className="flex flex-col space-y-4 mb-6">
                <label className="text-xs font-bold text-red-400 uppercase tracking-widest">Image Prompt</label>
                <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-red-600 to-orange-600 rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-500"></div>
                    <div className="relative flex">
                        <input
                            type="text"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Describe your vision (e.g., 'Cyberpunk city with neon rain')"
                            className="flex-grow bg-[#131314] rounded-l-lg p-4 text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-0 font-mono text-sm border-r-0"
                            disabled={isLoading}
                        />
                        <button 
                            onClick={handleGenerate} 
                            disabled={isLoading || !prompt.trim()}
                            className="px-6 py-2 bg-gradient-to-r from-red-700 to-red-900 text-white font-bold tracking-wider hover:from-red-600 hover:to-red-800 disabled:from-gray-800 disabled:to-gray-900 disabled:text-gray-500 disabled:cursor-not-allowed rounded-r-lg transition-all"
                        >
                            {isLoading ? <SpinnerIcon className="w-6 h-6" /> : 'GENERATE'}
                        </button>
                    </div>
                </div>
            </div>
            
            {error && (
                <div className="p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-red-200 text-center text-sm mb-4">
                    {error}
                </div>
            )}

            <div className={`w-full aspect-square bg-[#0a0a0c] rounded-xl flex items-center justify-center border-2 border-dashed border-gray-800 relative overflow-hidden group ${generatedImage ? 'border-red-500/50 border-solid shadow-[0_0_20px_rgba(239,68,68,0.15)]' : ''}`}>
                {isLoading && (
                    <div className="flex flex-col items-center">
                        <SpinnerIcon className="w-16 h-16 text-red-500 mb-4 animate-spin"/>
                        <p className="text-red-400 font-mono text-xs animate-pulse">RENDERING PIXELS...</p>
                    </div>
                )}
                {generatedImage && !isLoading && (
                    <>
                        <img src={generatedImage} alt="Generated by AI" className="w-full h-full object-contain rounded-lg transition-transform duration-700 group-hover:scale-105" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-6">
                            <p className="text-white font-orbitron text-sm">GENERATION COMPLETE</p>
                        </div>
                    </>
                )}
                {!generatedImage && !isLoading && (
                     <div className="text-center opacity-30">
                         <PaintBrushIcon className="w-16 h-16 mx-auto mb-2 text-gray-500" />
                         <p className="text-gray-500 font-orbitron">AWAITING INPUT</p>
                     </div>
                )}
            </div>
        </div>
        
        {generatedImage && !isLoading && (
            <div className="flex justify-between items-center mt-6 pt-6 border-t border-gray-800 relative z-10">
                 <button onClick={handleDownload} className="flex items-center px-6 py-3 bg-gray-800 rounded-lg hover:bg-gray-700 text-gray-300 font-medium transition-all hover:text-white border border-gray-700 hover:border-gray-500">
                    <DownloadIcon className="w-5 h-5" /> <span className="ml-2">Save to Disk</span>
                </button>
                <button onClick={handleSendToChat} className="flex items-center px-6 py-3 bg-gradient-to-r from-red-600 to-orange-600 rounded-lg hover:from-red-500 hover:to-orange-500 text-white font-bold shadow-lg transition-all transform hover:translate-y-[-2px]">
                   <SendIcon className="w-5 h-5" /> <span className="ml-2">Send to Chat</span>
                </button>
            </div>
        )}
      </div>
    </div>
  );
};

export default ImageGeneratorModal;