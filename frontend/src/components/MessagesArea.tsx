import React, { useEffect, useState, useRef } from 'react';
import { Bot, User } from 'lucide-react';
import { Message } from '../types/chat';

interface MessagesAreaProps {
  messages: Message[];
  isLoading: boolean;
  animatingMessageId?: string | null;
  onAnimationDone?: () => void;
}

// Typewriter component for individual messages
// Uses time-based progression so it "catches up" after tab switches
const TypewriterText = ({
  text,
  speedMsPerChar = 10,
  onComplete
}: {
  text: string;
  speedMsPerChar?: number; // lower = faster
  onComplete?: () => void;
}) => {
  const [displayLength, setDisplayLength] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // Reset when text changes
    setDisplayLength(0);
    startRef.current = performance.now();

    const tick = () => {
      if (startRef.current == null) return;
      const elapsed = performance.now() - startRef.current;
      const nextLen = Math.floor(elapsed / speedMsPerChar);
      if (nextLen >= text.length) {
        setDisplayLength(text.length);
        onComplete?.();
        return; // stop without scheduling next frame
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
  const [messageTimestamps] = useState<Record<string, number>>({});

  // Auto-scroll to bottom
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
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-slate-50/30">
        <Bot className="h-16 w-16 text-blue-600 mb-4" />
        <h3 className="text-lg font-semibold text-slate-900 mb-1">Welcome to Summy AI</h3>
        <p className="text-slate-600 text-sm max-w-md">
          Select a document from the top menu to give me context, or start a general conversation
          below.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 bg-slate-50/30 scroll-smooth"
    >
      {messages.map((msg) => {
        const isAssistant = msg.role === 'assistant';
        // Animate only the current AI message indicated by the hook
        const shouldAnimate = isAssistant && animatingMessageId === msg.id && !animatedMessageIds.has(msg.id);

        return (
          <div
            key={msg.id}
            className={`flex gap-2 ${isAssistant ? 'justify-start' : 'justify-end'}`}
          >
            {isAssistant && (
              <div className="w-7 h-7 rounded-md bg-white border border-slate-200 flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
                <Bot className="h-4 w-4 text-blue-600" />
              </div>
            )}

            <div
              className={`
                max-w-[85%] sm:max-w-[75%] rounded-lg px-3 py-2 shadow-sm text-sm leading-relaxed
                ${
                  isAssistant
                    ? 'bg-white border border-slate-200 text-slate-800'
                    : 'bg-blue-600 text-white'
                }
              `}
            >
              {shouldAnimate ? (
                <TypewriterText
                  text={msg.content}
                  speedMsPerChar={10}
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
              <div className="w-7 h-7 rounded-md bg-blue-100 flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
                <User className="h-4 w-4 text-blue-600" />
              </div>
            )}
          </div>
        );
      })}

      {isLoading && (
        <div className="flex gap-2 justify-start animate-in fade-in duration-300">
          <div className="w-7 h-7 rounded-md bg-white border border-slate-200 flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
            <Bot className="h-4 w-4 text-blue-600" />
          </div>
          <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm flex items-center gap-1">
            <span className="text-xs font-medium text-slate-500 mr-1.5">
              Summy is thinking
            </span>
            <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
            <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
            <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" />
          </div>
        </div>
      )}
    </div>
  );
}
