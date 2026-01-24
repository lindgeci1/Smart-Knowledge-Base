import { useEffect } from "react";
import { MessageSquare, Bot, X } from "lucide-react";
import { useChatState } from "../hooks/useChatState";
import { ChatSidebar } from "./ChatSidebar";
import { ChatHeader } from "./ChatHeader";
import { MessagesArea } from "./MessagesArea";
import { MessageInput } from "./MessageInput";

export function ChatInterface() {
  const {
    conversations,
    activeConversationId,
    currentMessages,
    selectedDocument,
    isDocumentLocked,
    availableDocuments,
    isLoading,
    isSidebarOpen,
    isChatOpen,
    animatingMessageId,
    toggleChat,
    toggleSidebar,
    createNewChat,
    selectConversation,
    deleteConversation,
    selectDocument,
    sendMessage,
    finishAnimation,
    refreshConversations,
  } = useChatState();

  useEffect(() => {
    if (isChatOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isChatOpen]);

  if (!isChatOpen) {
    return (
      <button
        onClick={toggleChat}
        className="fixed bottom-6 right-6 p-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/40 transition-all transform hover:scale-105 z-50 group"
        aria-label="Open chat"
      >
        <MessageSquare className="h-6 w-6 group-hover:animate-pulse" />
        <span className="absolute right-full mr-4 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl">
          Chat with Summy
        </span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-6xl h-[85vh] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row border border-slate-200 dark:border-slate-700 ring-1 ring-black/5">
        {/* Sidebar */}
        <ChatSidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={selectConversation}
          onDeleteConversation={deleteConversation}
          onNewChat={createNewChat}
          onRefreshConversations={refreshConversations}
          isOpen={isSidebarOpen}
          onCloseMobile={toggleSidebar}
        />

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-white dark:bg-slate-800 relative transition-colors">
          <ChatHeader
            onToggleSidebar={toggleSidebar}
            onClose={toggleChat}
            selectedDocument={selectedDocument}
            availableDocuments={availableDocuments}
            onSelectDocument={selectDocument}
            isDocumentLocked={isDocumentLocked}
            isChatActive={!!activeConversationId}
          />

          {activeConversationId ? (
            <>
              <MessagesArea
                messages={currentMessages}
                isLoading={isLoading}
                animatingMessageId={animatingMessageId}
                onAnimationDone={finishAnimation}
              />
              <MessageInput
                onSendMessage={sendMessage}
                isLoading={isLoading}
                disabled={false}
                placeholder={
                  selectedDocument
                    ? "Ask about this document..."
                    : "Ask AI anything..."
                }
              />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/50 dark:bg-slate-900/50">
              <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mb-6 shadow-sm ring-1 ring-indigo-100 dark:ring-indigo-800 animate-in zoom-in duration-300">
                <Bot className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
                How can I help you today?
              </h2>
              <p className="text-slate-500 dark:text-slate-400 max-w-md mb-8 text-base leading-relaxed">
                I can summarize your documents, answer questions, or chat about any topic.
                Select a mode below to get started.
              </p>
              
              <div className="grid gap-4 w-full max-w-md">
                <button
                  onClick={createNewChat}
                  className="flex items-center gap-4 p-4 text-left bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 hover:shadow-md rounded-xl transition-all group"
                >
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg group-hover:scale-110 transition-transform">
                     <Bot className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">General Chat</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Search across all your knowledge base</div>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}