
export const FULL_SOURCE_CODE: Record<string, string> = {
  "index.tsx": `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,

  "metadata.json": `{
  "name": "WormGPT v2.0",
  "description": "An AI ChatBOT YOU KNOW",
  "requestFramePermissions": [
    "microphone"
  ]
}`,

  "index.html": `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>WormGPT ChatBot</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Roboto:wght@400;500&display=swap" rel="stylesheet">
    <style id="custom-fonts-style"></style>
    <style>
      :root {
        --color-bg-primary: #131314;
        --color-panel: #1C1C1E;
        --color-text-primary: #e5e7eb;
        --color-text-secondary: #9ca3af;
        --color-accent-primary: #C084FC;
        --color-accent-secondary: #9333EA;
        --color-bubble-user: #3b0764;
        --color-bubble-model: #222226;
        --color-border: #374151;
        --color-scrollbar-thumb: #333;
        --color-scrollbar-track: #1a1a1a;
        --bg-image-url: none;
      }
      body {
        font-family: 'Roboto', sans-serif;
        background-color: var(--color-bg-primary);
        color: var(--color-text-primary);
        background-image: var(--bg-image-url);
        background-size: cover;
        background-position: center;
        background-attachment: fixed;
      }
      .font-orbitron {
        font-family: 'Orbitron', sans-serif;
      }
      .brand-gradient {
        background: linear-gradient(to right, var(--color-accent-primary), var(--color-accent-secondary));
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }
      /* Custom scrollbar for a better look */
      ::-webkit-scrollbar {
        width: 8px;
      }
      ::-webkit-scrollbar-track {
        background: var(--color-scrollbar-track);
      }
      ::-webkit-scrollbar-thumb {
        background-color: var(--color-scrollbar-thumb);
        border-radius: 4px;
        border: 2px solid var(--color-scrollbar-track);
      }
    </style>
  <script type="importmap">
{
  "imports": {
    "react/": "https://aistudiocdn.com/react@^19.2.0/",
    "react": "https://aistudiocdn.com/react@^19.2.0",
    "@google/genai": "https://aistudiocdn.com/@google/genai@^1.27.0",
    "react-dom/": "https://aistudiocdn.com/react-dom@^19.2.0/",
    "react-markdown": "https://esm.sh/react-markdown@9?external=react",
    "remark-gfm": "https://esm.sh/remark-gfm@4",
    "pdfjs-dist": "https://esm.sh/pdfjs-dist@4.5.136",
    "jszip": "https://esm.sh/jszip@3.10.1"
  }
}
</script>
</head>
  <body class="text-gray-200">
    <div id="root"></div>
    <script type="module" src="/index.tsx"></script>
  </body>
</html>`,

  "types.ts": `
export enum Role {
  USER = 'user',
  MODEL = 'model',
}

export interface MessagePart {
    text?: string;
    inlineData?: {
        mimeType: string;
        data: string;
    };
}

export interface MultiResponse {
    id: string;
    model: string;
    parts: MessagePart[];
}

export interface MessageContext {
  timestamp: number;
  battery?: {
    level: string;
    charging: boolean;
  };
  network?: {
    type: string;
    downlink: number;
    rtt: number;
  };
  location?: {
    ip: string;
    city: string;
    region: string;
    country: string;
  };
}

export interface Message {
  role: Role;
  parts: MessagePart[];
  id: string; 
  multiResponses?: MultiResponse[];
  selectionMade?: boolean;
  context?: MessageContext;
}

export interface Conversation {
    id: string;
    name: string;
    messages: Message[];
    isLocked?: boolean;
}

export interface AttachedFile {
    id: string;
    file: File;
    type: 'image' | 'text' | 'pdf' | 'video' | 'other';
    preview?: string;
    content?: string;
}

export interface CustomFont {
    name: string;
    url: string;
}

export interface ThemeSettings {
  '--color-bg-primary': string;
  '--color-panel': string;
  '--color-text-primary': string;
  '--color-text-secondary': string;
  '--color-accent-primary': string;
  '--color-accent-secondary': string;
  '--color-bubble-user': string;
  '--color-bubble-model': string;
  '--color-border': string;
  '--color-scrollbar-thumb': string;
  '--color-scrollbar-track': string;
  '--bg-image-url': string;
  fontFamily: string;
  customFonts: CustomFont[];
  userAvatar: string | null;
  modelAvatar: string | null;
}`,

  "components/SourceCodeModal.tsx": `
import React from 'react';

// This component has been deprecated and disabled.
const SourceCodeModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    return null;
};

export default SourceCodeModal;`,

  "components/MessageInfoModal.tsx": `
import React from 'react';
import { Message, Role } from '../types';
import { CloseIcon, UserIcon, WormIcon } from './Icons';

interface MessageInfoModalProps {
  message: Message | null;
  onClose: () => void;
}

const MessageInfoModal: React.FC<MessageInfoModalProps> = ({ message, onClose }) => {
  if (!message || !message.context) {
    // We could show a "No info available" message, but for now, we just don't render the modal.
    return null;
  }

  const { context, role } = message;
  const date = new Date(context.timestamp);
  const formattedDate = date.toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  const formattedTime = date.toLocaleTimeString();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="border rounded-xl shadow-lg w-full max-w-sm p-6 flex flex-col gap-4"
        style={{ backgroundColor: 'var(--color-panel)', borderColor: 'var(--color-border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold flex items-center gap-2">
            {role === Role.MODEL ? <WormIcon /> : <UserIcon />}
            Message Info
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded-full"><CloseIcon /></button>
        </div>
        
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Timestamp</p>
          <p>{formattedDate}</p>
          <p>{formattedTime}</p>
        </div>

        {context.battery ? (
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Device Battery</p>
            <p>Level: {context.battery.level}</p>
            <p>Status: {context.battery.charging ? 'Charging' : 'Not Charging'}</p>
          </div>
        ) : (
             <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Device Battery</p>
                <p>Status not available.</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default MessageInfoModal;`
};
