import React, { useEffect, useState, useRef, KeyboardEvent } from "react";
import { SendHorizontal, Loader2, Sparkles } from "lucide-react";

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
  placeholder,
}: MessageInputProps) {
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        150
      )}px`;
    }
  }, [content]);

  const handleSubmit = () => {
    if (!content.trim() || isLoading || disabled) return;
    onSendMessage(content.trim());
    setContent("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="p-4 sm:p-5 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
      <div className="relative flex items-end gap-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus-within:border-indigo-400 dark:focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10 rounded-2xl p-2 transition-all shadow-inner">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isLoading}
          placeholder={
            disabled
              ? "Start a chat above..."
              : placeholder || "Send a message..."
          }
          className="w-full bg-transparent border-none focus:ring-0 resize-none max-h-[150px] py-2.5 px-3 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 disabled:opacity-50 text-sm leading-relaxed"
          rows={1}
          maxLength={2000}
        />

        <div className="flex-shrink-0 pb-1 pr-1">
          <button
            onClick={handleSubmit}
            disabled={!content.trim() || isLoading || disabled}
            className={`
               p-2.5 rounded-xl transition-all duration-200 flex items-center justify-center
               ${!content.trim() || isLoading || disabled
                  ? "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                  : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-200 dark:shadow-none hover:scale-105"
               }
            `}
            aria-label="Send message"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <SendHorizontal className="h-5 w-5 ml-0.5" />
            )}
          </button>
        </div>
      </div>
      <div className="mt-2 flex justify-between px-2 text-xs text-slate-400 dark:text-slate-500">
        <div className="flex items-center gap-1">
           <Sparkles className="h-3 w-3" />
           <span>Powered by Gemini</span>
        </div>
        <span>{content.length}/2000</span>
      </div>
    </div>
  );
}