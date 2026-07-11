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

export default MessageInfoModal;
