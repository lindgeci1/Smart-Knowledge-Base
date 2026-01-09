import { MessageSquare, Bot } from "lucide-react";
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

  if (!isChatOpen) {
    return (
      <button
        onClick={toggleChat}
        className="fixed bottom-6 right-6 p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all transform hover:scale-105 z-50 group"
        aria-label="Open chat"
      >
        <MessageSquare className="h-6 w-6 group-hover:animate-pulse" />
        <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-slate-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          Chat with Summy
        </span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/30 animate-in fade-in duration-200">
      <div className="w-full max-w-7xl h-[85vh] bg-white rounded-md shadow-xl overflow-hidden flex flex-col md:flex-row border border-slate-200">
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
        <div className="flex-1 flex flex-col min-w-0 bg-white relative">
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
                    ? "Type your message..."
                    : "Ask AI anything - it will search your documents automatically..."
                }
              />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-slate-50/30">
              <div className="w-16 h-16 bg-blue-50 rounded-md flex items-center justify-center mb-4 animate-bounce">
                <Bot className="h-8 w-8 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">
                Start a New Conversation
              </h2>
              <p className="text-slate-600 max-w-md mb-6">
                Create a new chat to start analyzing your documents with Summy
                AI.
                <br />
                <br />
                <span className="text-sm font-medium text-slate-700">
                  Choose how to chat:
                </span>
                <br />
                <span className="text-sm text-slate-600">
                  • Select a document to chat about it specifically
                </span>
                <br />
                <span className="text-sm text-slate-600">
                  • Or chat freely - AI will automatically search your documents
                </span>
              </p>
              <button
                onClick={createNewChat}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium shadow-sm hover:shadow transition-all"
              >
                Create New Chat
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
