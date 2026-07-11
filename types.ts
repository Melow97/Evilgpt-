
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
    isp?: string;
    org?: string;
    timezone?: string;
    coords?: {
        latitude: number;
        longitude: number;
        accuracy: number;
    };
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
    type: 'image' | 'text' | 'pdf' | 'video' | 'zip' | 'other';
    preview?: string;
    content?: string;
    extractedParts?: MessagePart[];
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
}