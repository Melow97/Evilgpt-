
import React, { useState, useEffect } from 'react';
import { CloseIcon, SendIcon, BugIcon, HideIcon, ShowIcon } from './Icons';

interface CodeExecutorModalProps {
  onClose: () => void;
  onSend: (code: string) => void;
}

const CodeExecutorModal: React.FC<CodeExecutorModalProps> = ({ onClose, onSend }) => {
  const [html, setHtml] = useState('<h1>Hello, WormGPT!</h1>');
  const [css, setCss] = useState('body { background: #333; color: white; font-family: sans-serif; text-align: center; padding-top: 2rem; }');
  const [js, setJs] = useState('console.log("JavaScript executed!");');
  const [srcDoc, setSrcDoc] = useState('');
  const [isDebuggerVisible, setDebuggerVisible] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSrcDoc(`
        <html>
          <head>
            <style>${css}</style>
          </head>
          <body>${html}</body>
          <script>${js}</script>
        </html>
      `);
    }, 250);
    return () => clearTimeout(timeout);
  }, [html, css, js]);

  const handleSendToChat = () => {
    const formattedCode = `
Here is the code I'm working on:

**HTML:**
\`\`\`html
${html}
\`\`\`

**CSS:**
\`\`\`css
${css}
\`\`\`

**JavaScript:**
\`\`\`javascript
${js}
\`\`\`
`;
    onSend(formattedCode);
  };
  
  const handleDebugRequest = () => {
      const debugPrompt = `Please debug the following code and provide a corrected version. Explain the errors you found.

**HTML:**
\`\`\`html
${html}
\`\`\`

**CSS:**
\`\`\`css
${css}
\`\`\`

**JavaScript:**
\`\`\`javascript
${js}
\`\`\`
`;
    onSend(debugPrompt);
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 z-40 flex items-center justify-center p-4">
      <div className="bg-[#1C1C1E] border border-gray-700 rounded-xl shadow-lg w-full max-w-6xl h-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-700 flex-shrink-0">
          <h2 className="text-2xl font-bold font-orbitron brand-gradient">Code Executor</h2>
          <div className="flex items-center space-x-2">
            <button onClick={handleSendToChat} className="flex items-center px-4 py-2 bg-red-600 rounded-md hover:bg-red-700">
              <SendIcon /> <span className="ml-2 hidden sm:inline">Send to Chat</span>
            </button>
            <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded-full"><CloseIcon /></button>
          </div>
        </div>
        
        {/* Main Content */}
        <div className="flex-grow flex flex-col md:flex-row min-h-0">
          {/* Code Editors */}
          <div className="flex-1 flex flex-col p-2 space-y-2 overflow-y-auto">
            <EditorPane language="HTML" value={html} onChange={setHtml} />
            <EditorPane language="CSS" value={css} onChange={setCss} />
            <EditorPane language="JavaScript" value={js} onChange={setJs} />
          </div>
          
          {/* Output Pane */}
          <div className="flex-1 flex flex-col border-t-2 md:border-t-0 md:border-l-2 border-gray-700 relative">
            <div className="bg-gray-800 p-2 text-sm text-gray-400 font-semibold">Live Preview</div>
            <iframe
              srcDoc={srcDoc}
              title="output"
              sandbox="allow-scripts"
              frameBorder="0"
              width="100%"
              height="100%"
              className="bg-white"
            />
            {isDebuggerVisible ? (
                <div className="absolute top-14 right-4 flex flex-col items-center group">
                    <button onClick={handleDebugRequest} className="p-3 bg-red-600 rounded-full hover:bg-red-700 shadow-lg text-white transform hover:scale-110 transition-transform">
                        <BugIcon />
                    </button>
                    <span className="mt-2 text-xs text-white bg-black bg-opacity-70 px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">Ask AI to Debug</span>
                    <button onClick={() => setDebuggerVisible(false)} className="mt-2 p-1 bg-gray-800 rounded-full hover:bg-gray-700 opacity-0 group-hover:opacity-100 transition-opacity">
                         <HideIcon className="w-4 h-4" />
                    </button>
                </div>
            ) : (
                <button onClick={() => setDebuggerVisible(true)} className="absolute top-14 right-4 p-2 bg-gray-800 rounded-full hover:bg-gray-700 shadow-lg" title="Show Debugger">
                    <ShowIcon className="w-5 h-5" />
                </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const EditorPane = ({ language, value, onChange }: { language: string, value: string, onChange: (val: string) => void }) => (
    <div className="flex flex-col bg-gray-900 rounded-lg flex-grow h-1/3">
        <label className="bg-gray-800 text-gray-400 text-sm px-3 py-1 rounded-t-lg">{language}</label>
        <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full flex-grow bg-transparent text-white p-2 font-mono text-sm resize-none focus:outline-none focus:ring-1 focus:ring-red-600 rounded-b-lg"
        />
    </div>
)

export default CodeExecutorModal;