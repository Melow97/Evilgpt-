
import React, { useRef, useState, useEffect } from 'react';
import { CloseIcon, CheckIcon, ResetIcon } from './Icons';
import { AttachedFile } from '../types';

interface ImageEditorModalProps {
  file: AttachedFile;
  onClose: () => void;
  onSave: (editedFile: AttachedFile) => void;
}

const ImageEditorModal: React.FC<ImageEditorModalProps> = ({ file, onClose, onSave }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#ff0000');
  const [lineWidth, setLineWidth] = useState(5);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Initialize canvas with image
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const img = new Image();
    
    if (canvas && ctx && file.preview) {
      img.src = file.preview;
      img.onload = () => {
        // Set canvas size to match image natural size, but handle display via CSS
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);
        setImageLoaded(true);
      };
    }
  }, [file]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx?.beginPath(); // Reset path
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !imageLoaded) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // Calculate coordinates relative to canvas scaling
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX, clientY;
    if ('touches' in e) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = (e as React.MouseEvent).clientX;
        clientY = (e as React.MouseEvent).clientY;
    }

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.strokeStyle = color;

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handleSave = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL(file.file.type);
    
    // Convert DataURL to Blob to File
    fetch(dataUrl)
        .then(res => res.blob())
        .then(blob => {
            const newFile = new File([blob], file.file.name, { type: file.file.type });
            const updatedAttachedFile: AttachedFile = {
                ...file,
                file: newFile,
                preview: dataUrl
            };
            onSave(updatedAttachedFile);
        });
  };

  const handleReset = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      const img = new Image();
      if (canvas && ctx && file.preview) {
          img.src = file.preview;
          img.onload = () => {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0);
          }
      }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 z-[100] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl flex justify-between items-center mb-4 px-4">
        <h2 className="text-xl font-orbitron text-white">Edit Image</h2>
        <div className="flex space-x-2">
            <button onClick={handleReset} className="p-2 bg-gray-800 rounded-full hover:bg-gray-700 text-white" title="Reset">
                <ResetIcon />
            </button>
            <button onClick={onClose} className="p-2 bg-gray-800 rounded-full hover:bg-gray-700 text-white">
                <CloseIcon />
            </button>
        </div>
      </div>

      <div className="relative flex-grow w-full max-w-5xl flex items-center justify-center overflow-hidden bg-[#131314] border border-gray-800 rounded-lg" ref={containerRef}>
        <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseUp={stopDrawing}
            onMouseMove={draw}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchEnd={stopDrawing}
            onTouchMove={draw}
            className="max-w-full max-h-[70vh] object-contain cursor-crosshair touch-none"
        />
      </div>

      <div className="mt-4 w-full max-w-4xl bg-[#1C1C1E] p-4 rounded-xl flex flex-wrap items-center justify-between gap-4 border border-gray-700">
         <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
                <label className="text-xs text-gray-400">Color:</label>
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-8 rounded cursor-pointer bg-transparent border-none" />
            </div>
            <div className="flex items-center space-x-2">
                <label className="text-xs text-gray-400">Size:</label>
                <input type="range" min="1" max="20" value={lineWidth} onChange={(e) => setLineWidth(Number(e.target.value))} className="w-24 accent-purple-500" />
            </div>
         </div>
         <button onClick={handleSave} className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-full font-bold flex items-center">
            <CheckIcon className="mr-2" /> Save & Use
         </button>
      </div>
    </div>
  );
};

export default ImageEditorModal;
