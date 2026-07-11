
import React, { useState, KeyboardEvent, useRef, useEffect, forwardRef } from 'react';
import { PlusIcon, MicIcon, SendIcon, FileTextIcon, CloseIcon, PDFIcon, ImageIcon, VideoIcon, PaintBrushIcon, GlobeIcon, SocialIcon, ZipIcon } from './Icons';
import { MessagePart, AttachedFile } from '../types';
import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';

// Set worker source for pdf.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.5.136/build/pdf.worker.mjs';


interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  attachedFiles: AttachedFile[];
  setAttachedFiles: (files: AttachedFile[] | ((prev: AttachedFile[]) => AttachedFile[])) => void;
  onSendMessage: (parts: MessagePart[]) => void;
  isLoading: boolean;
  onOpenImageGenerator: () => void;
  onEditImage: (file: AttachedFile) => void;
  onOpenScraper: () => void;
  onOpenDstat: () => void;
  onOpenSocial: () => void;
}

const ChatInput = forwardRef<HTMLTextAreaElement, ChatInputProps>(({ input, setInput, attachedFiles, setAttachedFiles, onSendMessage, isLoading, onOpenImageGenerator, onEditImage, onOpenScraper, onOpenDstat, onOpenSocial }, ref) => {
  const [isListening, setIsListening] = useState(false);
  const [isMenuOpen, setMenuOpen] = useState(false);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const anyFileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';
      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(prev => prev ? `${prev} ${transcript}` : transcript);
        setIsListening(false);
      };
      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
      };
    }
  }, [setInput]);

  // Close menu if clicked outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  const handleSubmit = () => {
    const textPart = input.trim() ? [{ text: input.trim() }] : [];
    
    // Use flatMap to handle files that might produce multiple parts (like Zips)
    const fileParts: MessagePart[] = attachedFiles
        .filter(f => f.type !== 'video') // video is handled separately in App.tsx
        .flatMap(attachedFile => {
            if (attachedFile.type === 'zip' && attachedFile.extractedParts) {
                return attachedFile.extractedParts;
            }
            if (attachedFile.type === 'image' && attachedFile.preview) {
                return [{ inlineData: { mimeType: attachedFile.file.type, data: attachedFile.preview.split(',')[1] } }];
            } else if (attachedFile.type === 'zip' && attachedFile.content) {
                // Fallback for zips without extracted parts
                return [{ text: attachedFile.content }];
            } else if (attachedFile.content) {
                // Wrap content in hidden tags for UI hiding
                return [{ text: `:::HIDDEN_FILE_CONTENT:::\n[FILE: ${attachedFile.file.name}]\n${attachedFile.content}\n:::END_HIDDEN_FILE_CONTENT:::` }];
            }
            return [];
        });

    const parts = [...fileParts, ...textPart];

    if ((input.trim() || attachedFiles.length > 0) && !isLoading) {
      onSendMessage(parts);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Check if IME composition is active (to prevent sending while selecting characters)
    if (event.nativeEvent.isComposing) return;

    // MODIFIED: Shift+Enter sends, Enter adds new line
    if (event.key === 'Enter' && event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    // Helper for resizing
    const processImage = (file: File): Promise<{preview: string, file: File}> => {
        return new Promise((resolve) => {
             const reader = new FileReader();
             reader.onload = (e) => {
                 const img = new Image();
                 img.onload = () => {
                     const canvas = document.createElement('canvas');
                     const MAX_SIZE = 800; // Reduce max size to prevent memory crashes with multiple images
                     let width = img.width;
                     let height = img.height;
                     
                     if (width > height) {
                         if (width > MAX_SIZE) {
                             height *= MAX_SIZE / width;
                             width = MAX_SIZE;
                         }
                     } else {
                         if (height > MAX_SIZE) {
                             width *= MAX_SIZE / height;
                             height = MAX_SIZE;
                         }
                     }
                     canvas.width = width;
                     canvas.height = height;
                     const ctx = canvas.getContext('2d');
                     ctx?.drawImage(img, 0, 0, width, height);
                     
                     // Force convert to JPEG 70% quality to save massive space
                     const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                     fetch(dataUrl).then(res => res.blob()).then(blob => {
                         resolve({ preview: dataUrl, file: new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), { type: 'image/jpeg' }) });
                     });
                 };
                 img.src = e.target?.result as string;
             };
             reader.readAsDataURL(file);
        });
    };

    for (const file of Array.from(files)) {
        const currentFile = file as File;
        const id = `${currentFile.name}-${Date.now()}`;
        const reader = new FileReader();

        if (currentFile.type.startsWith('image/')) {
            try {
                // Compress image before setting state
                const { preview, file: compressedFile } = await processImage(currentFile);
                setAttachedFiles(prev => [...prev, { id, file: compressedFile, type: 'image', preview }]);
            } catch (e) {
                console.error("Image processing failed", e);
            }
        } else if (currentFile.type.startsWith('video/')) {
            const videoUrl = URL.createObjectURL(currentFile);
            setAttachedFiles(prev => [...prev, { id, file: currentFile, type: 'video', preview: videoUrl }]);
        } else if (currentFile.name.endsWith('.zip') || currentFile.type.includes('zip') || currentFile.type === 'application/x-zip-compressed') {
            try {
                const zip = await JSZip.loadAsync(currentFile);
                
                // We will build extracted parts: 1 Text Summary (Hidden) + N Image parts
                const extractedParts: MessagePart[] = [];
                let textSummary = `:::HIDDEN_FILE_CONTENT:::\n[ARCHIVE: ${currentFile.name}]\nSTRUCTURE:\n`;
                
                const entries: {path: string, entry: any}[] = [];
                zip.forEach((path, entry) => entries.push({ path, entry }));
                
                // Add structure to summary
                entries.forEach(e => textSummary += `- ${e.path}${e.entry.dir ? '/' : ''}\n`);
                
                textSummary += `\nCONTENTS:\n`;
                
                // Process entries
                for (const { path, entry } of entries) {
                    if (entry.dir) continue;
                    
                    const lowerPath = path.toLowerCase();
                    const isImage = /\.(png|jpg|jpeg|gif|webp|bmp)$/i.test(lowerPath);
                    const isText = /\.(txt|md|js|jsx|ts|tsx|json|html|css|scss|py|java|c|cpp|h|sh|xml|yaml|yml|sql|env|ini|conf|rb|go|rs|php|pl|lua|vue|svelte|astro|gitignore|lock|json5)$/i.test(lowerPath);

                    if (isImage) {
                         // Extract image
                         const base64 = await entry.async('base64');
                         let mimeType = 'image/png';
                         if(lowerPath.endsWith('jpg') || lowerPath.endsWith('jpeg')) mimeType = 'image/jpeg';
                         if(lowerPath.endsWith('gif')) mimeType = 'image/gif';
                         if(lowerPath.endsWith('webp')) mimeType = 'image/webp';
                         
                         extractedParts.push({
                             inlineData: { mimeType, data: base64 }
                         });
                         // Add note to text summary so AI knows which image is which
                         textSummary += `\n[File: ${path} is attached as an image part]\n`;
                    } else if (isText) {
                        try {
                            const text = await entry.async('string');
                            textSummary += `\n--- START FILE: ${path} ---\n${text}\n--- END FILE: ${path} ---\n`;
                        } catch (err) {
                            textSummary += `\n--- FILE: ${path} [Error reading text content] ---\n`;
                        }
                    }
                }
                textSummary += `:::END_HIDDEN_FILE_CONTENT:::`;
                
                // Add the text summary as the first part
                extractedParts.unshift({ text: textSummary });

                setAttachedFiles(prev => [...prev, { 
                    id, 
                    file: currentFile, 
                    type: 'zip', 
                    content: textSummary, 
                    extractedParts: extractedParts
                }]);
            } catch (e) {
                console.error("Zip read error", e);
                setAttachedFiles(prev => [...prev, { id, file: currentFile, type: 'other', content: `[Failed to read zip file content: ${e}]` }]);
            }
        } else if (currentFile.type === 'application/pdf') {
            reader.onload = async (e) => {
                if (!e.target?.result) return;
                try {
                    const data = new Uint8Array(e.target.result as ArrayBuffer);
                    const pdf = await pdfjsLib.getDocument(data).promise;
                    let content = '';
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();
                        content += textContent.items.map(item => (item as any).str).join(' ');
                        content += '\n\n';
                    }
                    setAttachedFiles(prev => [...prev, { id, file: currentFile, type: 'pdf', content }]);
                } catch (error) {
                    console.error('Error parsing PDF:', error);
                    alert('Failed to read PDF file.');
                }
            };
            reader.readAsArrayBuffer(currentFile);
        } else if (currentFile.type.startsWith('text/') || currentFile.name.match(/\.(md|js|py|html|css|json|ts|tsx|txt)$/)) {
            reader.onloadend = () => {
                setAttachedFiles(prev => [...prev, { id, file: currentFile, type: 'text', content: reader.result as string }]);
            };
            reader.readAsText(currentFile);
        } else {
             setAttachedFiles(prev => [...prev, {
                id,
                file: currentFile,
                type: 'other',
                content: `[User has attached a file named "${currentFile.name}" of type "${currentFile.type}" and size ${currentFile.size} bytes. The file content is not displayed.]`
            }]);
        }
    }
    if(event.target) event.target.value = ''; 
  };

  const removeFile = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setAttachedFiles(prev => prev.filter(f => f.id !== id));
  };

  const isSendButtonDisabled = isLoading || (!input.trim() && attachedFiles.length === 0);
  const sendButtonStyle: React.CSSProperties = {
    backgroundColor: !isSendButtonDisabled ? 'var(--color-accent-secondary)' : undefined,
  };

  return (
    <div className="rounded-xl p-2 flex flex-col focus-within:ring-2 focus-within:ring-red-500 transition-shadow" style={{backgroundColor: 'var(--color-panel)'}}>
        {attachedFiles.length > 0 && (
            <div className="p-2 flex flex-wrap gap-2 border-b border-gray-700 mb-2">
                {attachedFiles.map(file => (
                    <div 
                        key={file.id} 
                        className={`relative w-16 h-16 bg-gray-900 rounded-md group ${file.type === 'image' ? 'cursor-pointer hover:ring-2 ring-red-500' : ''}`}
                        onClick={() => file.type === 'image' && onEditImage(file)}
                        title={file.type === 'image' ? "Click to Edit" : ""}
                    >
                        {file.type === 'image' && file.preview ? (
                            <img src={file.preview} alt="preview" className="w-full h-full object-cover rounded-md"/>
                        ) : file.type === 'video' && file.preview ? (
                            <div className="w-full h-full flex flex-col items-center justify-center text-center relative">
                                <video src={file.preview} className="w-full h-full object-cover rounded-md" />
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                    <VideoIcon className="w-6 h-6 text-white"/>
                                </div>
                            </div>
                        ) : file.type === 'pdf' ? (
                            <div className="w-full h-full flex flex-col items-center justify-center text-center p-1">
                                <PDFIcon className="h-6 w-6 text-red-500" />
                            </div>
                        ) : file.type === 'zip' ? (
                            <div className="w-full h-full flex flex-col items-center justify-center text-center p-1">
                                <ZipIcon className="h-6 w-6 text-yellow-500" />
                            </div>
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-center p-1">
                                <FileTextIcon className="w-6 h-6" />
                            </div>
                        )}
                        <button onClick={(e) => removeFile(file.id, e)} className="absolute -top-1.5 -right-1.5 bg-gray-800 rounded-full p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <CloseIcon className="h-3 w-3"/>
                        </button>
                        {file.type === 'image' && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity rounded-md pointer-events-none">
                                <PaintBrushIcon className="w-4 h-4 text-white drop-shadow-lg" />
                            </div>
                        )}
                    </div>
                ))}
            </div>
        )}
        <div className="flex items-end space-x-1.5">
            <div ref={menuRef} className="relative">
                <button 
                    onClick={() => setMenuOpen(!isMenuOpen)} 
                    disabled={isLoading}
                    className="p-2 hover:bg-gray-700 rounded-full flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed text-gray-400 hover:text-white">
                    <PlusIcon />
                </button>
                {isMenuOpen && (
                    <div className="absolute bottom-full mb-2 w-56 border rounded-md shadow-lg py-1 left-0 z-50" style={{backgroundColor: 'var(--color-panel)', borderColor: 'var(--color-border)'}}>
                         <button 
                            onClick={() => { onOpenImageGenerator(); setMenuOpen(false); }}
                            className="flex items-center w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-gray-700"
                        >
                           <PaintBrushIcon className="mr-2 w-4 h-4" /> Generate Image
                        </button>
                         <button 
                            onClick={() => { onOpenSocial(); setMenuOpen(false); }}
                            className="flex items-center w-full text-left px-3 py-2 text-xs text-pink-500 hover:bg-gray-700"
                        >
                           <SocialIcon className="mr-2 w-4 h-4" /> Social Media Analysis
                        </button>
                         <button 
                            onClick={() => { onOpenScraper(); setMenuOpen(false); }}
                            className="flex items-center w-full text-left px-3 py-2 text-xs text-blue-400 hover:bg-gray-700"
                        >
                           <GlobeIcon className="mr-2 w-4 h-4" /> Website Scraper
                        </button>
                         <button 
                            onClick={() => { imageInputRef.current?.click(); setMenuOpen(false); }}
                            className="flex items-center w-full text-left px-3 py-2 text-xs text-gray-200 hover:bg-gray-700 border-t border-gray-700"
                        >
                           <ImageIcon className="mr-2 w-4 h-4" /> Upload Image(s)
                        </button>
                         <button 
                            onClick={() => { videoInputRef.current?.click(); setMenuOpen(false); }}
                            className="flex items-center w-full text-left px-3 py-2 text-xs text-gray-200 hover:bg-gray-700"
                        >
                           <VideoIcon className="mr-2 w-4 h-4" /> Upload Video(s)
                        </button>
                        <button 
                            onClick={() => { pdfInputRef.current?.click(); setMenuOpen(false); }}
                            className="flex items-center w-full text-left px-3 py-2 text-xs text-gray-200 hover:bg-gray-700"
                        >
                            <PDFIcon className="mr-2 w-4 h-4 text-red-500" /> Upload PDF(s)
                        </button>
                        <button 
                            onClick={() => { fileInputRef.current?.click(); setMenuOpen(false); }}
                            className="flex items-center w-full text-left px-3 py-2 text-xs text-gray-200 hover:bg-gray-700"
                        >
                            <FileTextIcon className="mr-2 w-4 h-4" /> Text/Code File(s)
                        </button>
                        <button 
                            onClick={() => { anyFileInputRef.current?.click(); setMenuOpen(false); }}
                            className="flex items-center w-full text-left px-3 py-2 text-xs text-gray-200 hover:bg-gray-700 border-t border-gray-700"
                        >
                           <PlusIcon className="mr-2 w-4 h-4" /> Upload Any File(s)
                        </button>
                    </div>
                )}
            </div>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="text/*,.md,.js,.py,.html,.css,.json,.ts,.tsx" multiple />
            <input type="file" ref={pdfInputRef} onChange={handleFileChange} className="hidden" accept="application/pdf" multiple />
            <input type="file" ref={imageInputRef} onChange={handleFileChange} accept="image/*" className="hidden" multiple />
            <input type="file" ref={videoInputRef} onChange={handleFileChange} accept="video/*" className="hidden" multiple />
            <input type="file" ref={anyFileInputRef} onChange={handleFileChange} className="hidden" multiple />
            <textarea
                ref={ref}
                value={input}
                onChange={(e) => {
                    setInput(e.target.value);
                    // Auto-resize textarea
                    e.target.style.height = 'auto';
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
                }}
                onKeyDown={handleKeyDown}
                placeholder={"Ask WormGPT... (Enter for new line, Shift+Enter to send)"}
                className="flex-grow bg-transparent border-0 outline-none focus:ring-0 text-gray-200 placeholder-gray-500 resize-none max-h-48 p-2 text-sm"
                rows={1}
                style={{ minHeight: '38px', overflowY: 'auto' }}
            />
            <button 
                onClick={toggleListening} 
                disabled={isLoading}
                className={`p-2 hover:bg-gray-700 rounded-full flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${isListening ? 'text-red-500' : 'text-gray-400'}`}>
                <MicIcon />
            </button>
            <button
                onClick={handleSubmit}
                disabled={isSendButtonDisabled}
                className="p-2 rounded-full disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                aria-label="Send message"
                style={sendButtonStyle}
            >
                <SendIcon />
            </button>
        </div>
    </div>
  );
});

export default ChatInput;
