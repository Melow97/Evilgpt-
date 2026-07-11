import React, { useState, useEffect, useRef } from 'react';
import { CloseIcon, FullscreenIcon } from './Icons';

interface CodeExecutionModalProps {
  onClose: () => void;
  code: {
    html: string;
    css: string;
    js: string;
  };
}

const CodeExecutionModal: React.FC<CodeExecutionModalProps> = ({ onClose, code }) => {
  const [srcDoc, setSrcDoc] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSrcDoc(`
      <html>
        <head>
          <style>${code.css}</style>
        </head>
        <body>${code.html}</body>
        <script>${code.js}</script>
      </html>
    `);
  }, [code]);

  const toggleFullscreen = () => {
    if (!modalRef.current) return;
    if (!document.fullscreenElement) {
        modalRef.current.requestFullscreen().catch(err => {
            alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        });
    } else {
        document.exitFullscreen();
    }
  };

  useEffect(() => {
      const handleFullscreenChange = () => {
          setIsFullscreen(!!document.fullscreenElement);
      };
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <div ref={modalRef} className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4 [&:not(:fullscreen)]:p-4 fullscreen:p-0">
      <div className="bg-[#1C1C1E] border border-gray-700 rounded-xl shadow-lg w-full h-full flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-700 flex-shrink-0">
          <h2 className="text-xl font-bold font-orbitron brand-gradient">Code Execution</h2>
          <div className="flex items-center space-x-2">
            <button onClick={toggleFullscreen} className="p-1 hover:bg-gray-700 rounded-full">
                <FullscreenIcon isFullscreen={isFullscreen} />
            </button>
            <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded-full"><CloseIcon /></button>
          </div>
        </div>
        
        {/* Output Pane */}
        <div className="flex-grow relative">
            <iframe
              srcDoc={srcDoc}
              title="output"
              sandbox="allow-scripts"
              frameBorder="0"
              width="100%"
              height="100%"
              className="bg-white"
            />
        </div>
      </div>
    </div>
  );
};

export default CodeExecutionModal;
