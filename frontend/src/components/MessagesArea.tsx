import React, { useEffect, useState, useRef } from 'react';
import { Bot, User, Sparkles } from 'lucide-react';
import { Message } from '../types/chat';

interface MessagesAreaProps {
  messages: Message[];
  isLoading: boolean;
  animatingMessageId?: string | null;
  onAnimationDone?: () => void;
}

const TypewriterText = ({
  text,
  speedMsPerChar = 10,
  onComplete
}: {
  text: string;
  speedMsPerChar?: number;
  onComplete?: () => void;
}) => {
  const [displayLength, setDisplayLength] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    setDisplayLength(0);
    startRef.current = performance.now();

    const tick = () => {
      if (startRef.current == null) return;
      const elapsed = performance.now() - startRef.current;
      const nextLen = Math.floor(elapsed / speedMsPerChar);
      if (nextLen >= text.length) {
        setDisplayLength(text.length);
        onComplete?.();
        return;
      }
      setDisplayLength(nextLen);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      startRef.current = null;
    };
  }, [text, speedMsPerChar, onComplete]);

  return <div className="whitespace-pre-wrap">{text.slice(0, displayLength)}</div>;
};

export function MessagesArea({ messages, isLoading, animatingMessageId, onAnimationDone }: MessagesAreaProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [animatedMessageIds, setAnimatedMessageIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleAnimationComplete = (id: string) => {
    setAnimatedMessageIds((prev) => new Set(prev).add(id));
  };

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/50 dark:bg-slate-900/30">
        <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-full shadow-lg flex items-center justify-center mb-6 animate-pulse-soft">
          <Sparkles className="h-10 w-10 text-indigo-500" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Summy AI Ready</h3>
        <p className="text-slate-600 dark:text-slate-400 text-sm max-w-sm leading-relaxed">
          I've analyzed your documents. Ask me anything about them, or just say hello!
        </p>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-50/50 dark:bg-slate-900/30 scroll-smooth"
    >
      {messages.map((msg) => {
        const isAssistant = msg.role === 'assistant';
        const shouldAnimate = isAssistant && animatingMessageId === msg.id && !animatedMessageIds.has(msg.id);

        return (
          <div
            key={msg.id}
            className={`flex gap-4 ${isAssistant ? 'justify-start' : 'justify-end'}`}
          >
            {isAssistant && (
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-indigo-600/20 mt-1">
                <Bot className="h-5 w-5 text-white" />
              </div>
            )}

            <div
              className={`
                max-w-[85%] sm:max-w-[75%] rounded-2xl px-5 py-3.5 shadow-sm text-sm leading-relaxed
                ${
                  isAssistant
                    ? 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-none'
                    : 'bg-indigo-600 text-white rounded-tr-none'
                }
              `}
            >
              {shouldAnimate ? (
                <TypewriterText
                  text={msg.content}
                  speedMsPerChar={8}
                  onComplete={() => {
                    handleAnimationComplete(msg.id);
                    onAnimationDone?.();
                  }}
                />
              ) : (
                <div className="whitespace-pre-wrap">{msg.content}</div>
              )}
            </div>

            {!isAssistant && (
              <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0 mt-1">
                <User className="h-5 w-5 text-slate-500 dark:text-slate-400" />
              </div>
            )}
          </div>
        );
      })}

      {isLoading && (
        <div className="flex gap-4 justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-indigo-600/20 mt-1">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm flex items-center gap-1.5">
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500 mr-1">
              Processing
            </span>
            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" />
          </div>
        </div>
      )}
    </div>
  );
}