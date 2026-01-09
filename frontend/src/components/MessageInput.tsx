import React, { useEffect, useState, useRef, KeyboardEvent } from 'react';
import { SendHorizontal, Loader2 } from 'lucide-react';

interface MessageInputProps {
  onSendMessage: (content: string) => void;
  isLoading: boolean;
  disabled: boolean;
  placeholder?: string;
}

export function MessageInput({
  onSendMessage,
  isLoading,
  disabled,
  placeholder
}: MessageInputProps) {
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        120
      )}px`;
    }
  }, [content]);

  const handleSubmit = () => {
    if (!content.trim() || isLoading || disabled) return;
    onSendMessage(content.trim());
    setContent('');
    // Reset height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="p-2 sm:p-3 border-t border-slate-200 bg-white">
      <div className="relative flex items-end gap-2 bg-white border border-slate-300 rounded-md p-1.5 transition-all">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isLoading}
          placeholder={
            disabled
              ? 'Select a document to start chatting...'
              : placeholder || 'Type your message...'
          }
          className="w-full bg-transparent border-none focus:ring-0 resize-none max-h-[120px] py-1.5 px-2 text-slate-900 placeholder:text-slate-400 disabled:opacity-50 text-sm"
          rows={1}
          maxLength={2000}
        />

        <div className="flex-shrink-0 pb-0.5 pr-0.5">
          <button
            onClick={handleSubmit}
            disabled={!content.trim() || isLoading || disabled}
            className="p-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            aria-label="Send message"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <SendHorizontal className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
      <div className="mt-1 text-right text-xs text-slate-400 px-1">
        {content.length}/2000
      </div>
    </div>
  );
}
