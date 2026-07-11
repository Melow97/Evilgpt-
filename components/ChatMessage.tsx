
import React, { useState, useEffect, useRef, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message, Role, MultiResponse } from '../types';
import { WormIcon, UserIcon, CopyIcon, MoreOptionsIcon, CheckIcon, DeleteIcon, EditIcon, ContinueIcon, ExecuteIcon, RegenerateIcon, CloseIcon, InfoIcon, MicIcon, PencilOffIcon, ExternalLinkIcon } from './Icons';

interface ChatMessageProps {
  message: Message;
  isLoading?: boolean;
  isLastMessage: boolean;
  isEditing: boolean;
  editMode?: 'restart' | 'no-restart';
  userAvatar?: string | null;
  modelAvatar?: string | null;
  onDelete: (messageId: string) => void;
  onStartEdit: (messageId: string, mode: 'restart' | 'no-restart') => void;
  onSaveEdit: (messageId: string, newText: string) => void;
  onCancelEdit: () => void;
  onContinue: () => void;
  onRegenerate: (messageId: string) => void;
  onImageClick: (src: string) => void;
  onExecute: (message: Message) => void;
  onSelectBestResponse: (messageId: string, responseId: string) => void;
  onShowInfo: (messageId: string) => void;
  onSpeak: (text: string) => void;
}

const CodeBlock = ({ node, inline, className, children, ...props }: any) => {
    const [copied, setCopied] = useState(false);
    const match = /language-(\w+)/.exec(className || '');
    const codeText = String(children).replace(/\n$/, '');

    const handleCopy = () => {
        navigator.clipboard.writeText(codeText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return !inline && match ? (
        <div className="bg-black rounded-lg my-2 relative max-w-full overflow-hidden border border-gray-700">
            <div className="flex justify-between items-center px-4 py-2 bg-gray-800 rounded-t-lg sticky top-0 z-10 w-full border-b border-gray-700">
                <span className="text-gray-400 text-xs font-mono">{match[1]}</span>
                <button onClick={handleCopy} className="flex items-center text-xs text-gray-400 hover:text-white bg-gray-700 px-2 py-1 rounded">
                    {copied ? <CheckIcon className="w-3 h-3 mr-1" /> : <CopyIcon className="w-3 h-3 mr-1" />}
                    {copied ? 'Copied' : 'Copy'}
                </button>
            </div>
            <div className="relative">
                <pre className="p-4 overflow-auto max-h-96 text-sm custom-scrollbar">
                    <code className={className} {...props}>
                        {children}
                    </code>
                </pre>
            </div>
        </div>
    ) : (
        <code className="bg-gray-700 rounded px-1 py-0.5 text-sm break-words font-mono text-red-300" {...props}>
            {children}
        </code>
    );
};

const LinkRenderer = (props: any) => {
    const { href, children } = props;
    const [copied, setCopied] = useState(false);

    const handleCopy = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        navigator.clipboard.writeText(href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <span className="inline-flex items-center space-x-1 align-middle">
            <a 
                href={href} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-blue-400 hover:text-blue-300 underline break-all"
                onClick={(e) => e.stopPropagation()} 
            >
                {children}
            </a>
            <button 
                onClick={handleCopy} 
                className="p-0.5 text-gray-400 hover:text-white bg-gray-800 rounded transition-colors"
                title="Copy Link"
            >
                {copied ? <CheckIcon className="w-3 h-3 text-green-400" /> : <CopyIcon className="w-3 h-3" />}
            </button>
        </span>
    );
};

const SingleMessageContent: React.FC<{ parts: Message['parts'], onImageClick: (src: string) => void, isLoading?: boolean }> = ({ parts, onImageClick, isLoading }) => {
    const blinkingCursor = isLoading ? (
        <span className="inline-block w-0.5 h-5 animate-pulse ml-1" style={{backgroundColor: 'var(--color-text-primary)'}}></span>
    ) : null;
  
    const content = parts.map((part, index) => {
        if (part.text) {
            // Remove the hidden system context AND hidden file content before rendering
            let cleanText = part.text.replace(/:::SYSTEM_CONTEXT:::[\s\S]*?:::END_SYSTEM_CONTEXT:::/g, '');
            // Replace zip/file content with a placeholder
            cleanText = cleanText.replace(/:::HIDDEN_FILE_CONTENT:::[\s\S]*?:::END_HIDDEN_FILE_CONTENT:::/g, '📁 *[File Content Attached & Sent to AI]*');
            
            // SPECIFIC FIX: Remove legacy system override blocks if they aren't properly tagged
            cleanText = cleanText.replace(/\[SYSTEM_OVERRIDE_ACTIVE\][\s\S]*?(\n\n|$)/g, '');

            if (!cleanText.trim() && !isLoading) return null; // Don't render empty blocks

            return (
                <ReactMarkdown
                    key={index}
                    remarkPlugins={[remarkGfm]}
                    components={{ 
                        code: CodeBlock,
                        a: LinkRenderer 
                    }}
                    className="prose prose-invert prose-sm max-w-none break-words overflow-x-auto"
                >
                    {cleanText}
                </ReactMarkdown>
            );
        }
        if (part.inlineData) {
            const src = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            return (
                <button key={index} onClick={() => onImageClick(src)} className="block cursor-pointer hover:opacity-90 transition-opacity">
                    <img src={src} alt="uploaded content" className="max-w-xs rounded-lg mt-2 border border-gray-700 shadow-md"/>
                </button>
            );
        }
        return null;
    });

    return (
        <>
            <div className="flex flex-col min-w-0 overflow-hidden space-y-2">
              {content}
            </div>
            {isLoading && parts.every(p => !p.text && !p.inlineData) && blinkingCursor}
            {parts.some(p => p.text) && isLoading && blinkingCursor}
        </>
    )
}

const ChatMessage: React.FC<ChatMessageProps> = ({ 
    message, 
    isLoading = false, 
    isLastMessage,
    isEditing,
    editMode = 'restart',
    userAvatar,
    modelAvatar,
    onDelete, 
    onStartEdit,
    onSaveEdit,
    onCancelEdit,
    onContinue, 
    onRegenerate,
    onImageClick, 
    onExecute,
    onSelectBestResponse,
    onShowInfo,
    onSpeak
}) => {
  const isModel = message.role === Role.MODEL;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
              setMenuOpen(false);
          }
      };
      if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);
  
  // Helper to get raw text but strip context for editing so user doesn't see it
  const getTextContent = () => {
    return message.parts
      .map(p => p.text || '')
      .join('\n')
      .replace(/:::SYSTEM_CONTEXT:::[\s\S]*?:::END_SYSTEM_CONTEXT:::/g, '')
      .replace(/:::HIDDEN_FILE_CONTENT:::[\s\S]*?:::END_HIDDEN_FILE_CONTENT:::/g, '')
      .replace(/\[SYSTEM_OVERRIDE_ACTIVE\][\s\S]*?(\n\n|$)/g, '')
      .trim(); // Trim to remove leading/trailing whitespace including newlines
  };
  
  const [editedText, setEditedText] = useState(getTextContent());
  const editInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setEditedText(getTextContent());
  }, [message]);

  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.style.height = 'auto';
      editInputRef.current.style.height = `${editInputRef.current.scrollHeight}px`;
    }
  }, [isEditing]);

  const hasExecutableCode = isModel && /```html|```css|```javascript|```js/.test(getTextContent());

  // === NEW CHECK ===
  // Check if the message has ANY visible content after stripping hidden tags
  // If it doesn't, return null to hide the bubble completely.
  const visibleContent = message.parts.map(p => {
      if (p.inlineData) return 'IMAGE';
      if (p.text) {
          let text = p.text.replace(/:::SYSTEM_CONTEXT:::[\s\S]*?:::END_SYSTEM_CONTEXT:::/g, '');
          text = text.replace(/:::HIDDEN_FILE_CONTENT:::[\s\S]*?:::END_HIDDEN_FILE_CONTENT:::/g, 'FILE_ATTACHMENT'); // Keep marker for file
          text = text.replace(/\[SYSTEM_OVERRIDE_ACTIVE\][\s\S]*?(\n\n|$)/g, ''); // Legacy strip
          return text.trim();
      }
      return '';
  }).join('');

  if (!visibleContent.trim() && !isLoading) {
      return null;
  }
  // =================

  const handleCopy = () => {
      let textToCopy = getTextContent();
      if (message.multiResponses) {
          textToCopy = message.multiResponses.map(r => 
              `--- Response from ${r.model} ---\n${r.parts.map(p => p.text).join('\n')}`
          ).join('\n\n');
      }
      navigator.clipboard.writeText(textToCopy);
      setMenuOpen(false);
  };
  
  const handleDelete = () => { onDelete(message.id); setMenuOpen(false); };
  const handleModifyRestart = () => { onStartEdit(message.id, 'restart'); setMenuOpen(false); };
  const handleModifyNoRestart = () => { onStartEdit(message.id, 'no-restart'); setMenuOpen(false); };
  const handleSave = () => { onSaveEdit(message.id, editedText); }
  const handleContinue = () => { onContinue(); setMenuOpen(false); }
  const handleExecute = () => { onExecute(message); setMenuOpen(false); }
  const handleRegenerate = () => { onRegenerate(message.id); setMenuOpen(false); }
  const handleShowInfo = () => { onShowInfo(message.id); setMenuOpen(false); };
  const handleSpeak = () => { onSpeak(getTextContent()); setMenuOpen(false); };

  // Render Avatar Logic
  const renderAvatar = () => {
      if (isModel) {
          if (modelAvatar) {
              return <img src={modelAvatar} alt="AI" className="w-8 h-8 rounded-full object-cover shadow-lg" />;
          }
          return (
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg" style={{backgroundColor: 'var(--color-accent-secondary)'}}>
                  <WormIcon className="w-5 h-5 text-white" />
              </div>
          );
      } else {
          if (userAvatar) {
              return <img src={userAvatar} alt="User" className="w-8 h-8 rounded-full object-cover shadow-lg" />;
          }
          return (
               <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg bg-gray-600">
                  <UserIcon className="w-5 h-5 text-gray-300" />
               </div>
          );
      }
  };

  if (isEditing) {
    return (
        <div className="flex w-full justify-start">
            <div className="group flex items-start gap-3 w-full">
                {renderAvatar()}
                <div className="relative w-full max-w-2xl flex flex-col gap-2">
                    <textarea
                        ref={editInputRef}
                        value={editedText}
                        onChange={(e) => {
                            setEditedText(e.target.value)
                            e.target.style.height = 'auto';
                            e.target.style.height = `${e.target.scrollHeight}px`;
                        }}
                        className="w-full text-gray-200 p-3 rounded-lg focus:outline-none focus:ring-2 resize-none rounded-tl-none"
                        style={{backgroundColor: 'var(--color-bubble-user)'}}
                    />
                    <div className="flex items-center justify-end gap-2">
                        <button onClick={onCancelEdit} className="px-3 py-1 bg-gray-700 rounded-md text-sm hover:bg-gray-600">Cancel</button>
                        <button onClick={handleSave} className="px-3 py-1 rounded-md text-sm text-white" style={{backgroundColor: 'var(--color-accent-secondary)'}}>
                            {editMode === 'restart' ? 'Save & Submit' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
  }

  // Multi-response rendering
  if (isModel && message.multiResponses && message.multiResponses.length > 0) {
      return (
        <div className="flex w-full justify-start">
            <div className="group flex items-start gap-3 w-full">
                {renderAvatar()}
                <div className="flex flex-col gap-3 w-full max-w-2xl">
                    {message.multiResponses.map(response => (
                        <div key={response.id} className="relative px-4 py-3 rounded-lg rounded-tl-none break-words min-w-0 max-w-full overflow-hidden shadow-md" style={{backgroundColor: 'var(--color-bubble-model)'}}>
                            <div className="text-xs font-bold mb-2 pb-1 border-b" style={{borderColor: 'var(--color-border)', color: 'var(--color-accent-primary)'}}>{response.model}</div>
                            <SingleMessageContent parts={response.parts} onImageClick={onImageClick} isLoading={isLoading} />
                             {!message.selectionMade && isLastMessage && (
                                <button
                                    onClick={() => onSelectBestResponse(message.id, response.id)}
                                    className="absolute -bottom-3 right-3 text-xs flex items-center px-2 py-1 border rounded-full hover:bg-gray-700 transition-colors"
                                    style={{backgroundColor: 'var(--color-panel)', borderColor: 'var(--color-border)'}}
                                >
                                    <CheckIcon className="w-3 h-3 mr-1" /> Select
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
      );
  }

  // Standard single message rendering
  return (
    <div className="flex w-full justify-start flex-col gap-1">
      <div className="group flex items-start gap-3 w-full max-w-2xl">
        {renderAvatar()}
        
        {/* Chat Bubble */}
        <div className="relative min-w-0 px-4 py-3 rounded-lg rounded-tl-none break-words w-full overflow-visible shadow-md pr-8" style={{backgroundColor: isModel ? 'var(--color-bubble-model)' : 'var(--color-bubble-user)'}}>
            <SingleMessageContent parts={message.parts} onImageClick={onImageClick} isLoading={isLoading && isLastMessage} />
            
            {/* Three Dots Menu - Inside Bubble Top Right */}
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity" ref={menuRef}>
                <button onClick={() => setMenuOpen(!menuOpen)} className="p-1 hover:bg-black/20 rounded-full text-gray-300 hover:text-white">
                    <MoreOptionsIcon className="w-4 h-4" />
                </button>
                {menuOpen && (
                    <div className="absolute z-20 top-full right-0 mt-1 w-40 border rounded-md shadow-2xl py-1 overflow-hidden" style={{backgroundColor: 'var(--color-panel)', borderColor: 'var(--color-border)'}}>
                        <button onClick={handleSpeak} className="flex items-center w-full text-left px-3 py-2 text-xs hover:bg-gray-700 transition-colors text-white"><MicIcon className="mr-2 w-3 h-3"/> Voice Again</button>
                        <button onClick={handleShowInfo} className="flex items-center w-full text-left px-3 py-2 text-xs hover:bg-gray-700 transition-colors text-white"><InfoIcon className="mr-2 w-3 h-3"/> Info</button>
                        <button onClick={handleCopy} className="flex items-center w-full text-left px-3 py-2 text-xs hover:bg-gray-700 transition-colors text-white"><CopyIcon className="mr-2 w-3 h-3"/> Copy</button>
                        <button onClick={handleDelete} className="flex items-center w-full text-left px-3 py-2 text-xs hover:bg-gray-700 transition-colors text-red-400"><DeleteIcon className="mr-2 w-3 h-3"/> Delete</button>
                        {isModel ? (
                        <>
                            {isLastMessage && <button onClick={handleContinue} className="flex items-center w-full text-left px-3 py-2 text-xs hover:bg-gray-700 transition-colors text-white"><ContinueIcon className="mr-2 w-3 h-3"/> Continue</button>}
                            <button onClick={handleRegenerate} className="flex items-center w-full text-left px-3 py-2 text-xs hover:bg-gray-700 transition-colors text-white"><RegenerateIcon className="mr-2 w-3 h-3"/> Regenerate</button>
                            {hasExecutableCode && (
                                <button onClick={handleExecute} className="flex items-center w-full text-left px-3 py-2 text-xs hover:bg-gray-700 transition-colors text-red-400"><ExecuteIcon className="mr-2 w-3 h-3"/> Execute</button>
                            )}
                        </>
                        ) : (
                        <>
                            <button onClick={handleModifyRestart} className="flex items-center w-full text-left px-3 py-2 text-xs hover:bg-gray-700 transition-colors text-white"><EditIcon className="mr-2 w-3 h-3"/> Modify</button>
                            <button onClick={handleModifyNoRestart} className="flex items-center w-full text-left px-3 py-2 text-xs hover:bg-gray-700 transition-colors text-gray-400"><PencilOffIcon className="mr-2 w-3 h-3"/> Modify (No Restart)</button>
                        </>
                        )}
                    </div>
                )}
            </div>
        </div>
      </div>
      
      {/* Quick Actions below bubble for last message */}
      {isLastMessage && isModel && !isLoading && (
          <div className="pl-14 flex items-center space-x-3 opacity-80 hover:opacity-100 transition-opacity mt-1">
              <button 
                  onClick={() => onRegenerate(message.id)}
                  className="flex items-center text-xs text-gray-500 hover:text-white transition-colors bg-gray-800/50 hover:bg-gray-700 px-3 py-1.5 rounded-full border border-gray-700/50"
                  title="Regenerate this response"
              >
                  <RegenerateIcon className="w-3 h-3 mr-1.5" /> Regenerate
              </button>
          </div>
      )}
    </div>
  );
};

// Use memo to optimize performance for long chat lists
export default memo(ChatMessage, (prevProps, nextProps) => {
    // Return true if updates are NOT needed
    return (
        prevProps.isLoading === nextProps.isLoading &&
        prevProps.isLastMessage === nextProps.isLastMessage &&
        prevProps.isEditing === nextProps.isEditing &&
        prevProps.editMode === nextProps.editMode && // Add editMode to memo comparison
        prevProps.userAvatar === nextProps.userAvatar &&
        prevProps.modelAvatar === nextProps.modelAvatar &&
        prevProps.message.id === nextProps.message.id &&
        prevProps.message.parts === nextProps.message.parts
    );
});
