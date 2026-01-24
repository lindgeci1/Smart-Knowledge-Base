import React, { useState } from 'react';
import { Plus, RefreshCw, MessageSquare, Trash2, X } from 'lucide-react';
import { Conversation } from '../types/chat';
import { DeleteConfirmModal } from './DeleteConfirmModal';

interface ChatSidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onNewChat: () => void;
  onRefreshConversations: () => Promise<void> | void;
  isOpen: boolean;
  onCloseMobile: () => void;
}

export function ChatSidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onDeleteConversation,
  onNewChat,
  onRefreshConversations,
  isOpen,
  onCloseMobile
}: ChatSidebarProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteId(id);
  };

  const confirmDelete = () => {
    if (deleteId) {
      onDeleteConversation(deleteId);
      setDeleteId(null);
    }
  };

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      const maybePromise = onRefreshConversations();
      if (maybePromise && typeof (maybePromise as any).then === 'function') {
        await (maybePromise as Promise<void>);
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden animate-in fade-in"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <div
        className={`
        absolute md:relative inset-y-0 left-0 z-40
        w-72 bg-slate-50 dark:bg-slate-900/50 border-r border-slate-200 dark:border-slate-700
        transform transition-transform duration-300 ease-in-out flex flex-col
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-white/50 dark:bg-slate-800/50 backdrop-blur-md">
          <h2 className="font-bold text-slate-900 dark:text-white tracking-tight">History</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onCloseMobile}
              className="md:hidden p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* New Chat Button */}
        <div className="p-4">
          <button
            onClick={onNewChat}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md shadow-indigo-200 dark:shadow-none transition-all font-medium text-sm hover:-translate-y-0.5"
          >
            <Plus className="h-4 w-4" />
            <span>New Chat</span>
          </button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1 custom-scrollbar">
          {conversations.length === 0 ? (
            <div className="text-center py-10 px-4">
              <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                <MessageSquare className="h-5 w-5 text-slate-400 dark:text-slate-500" />
              </div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-200">No chats yet</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Start a new conversation to get help with your documents.</p>
            </div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={`
                  group flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border
                  ${
                    activeConversationId === conv.id
                      ? 'bg-white dark:bg-slate-800 border-indigo-200 dark:border-indigo-800 shadow-sm ring-1 ring-indigo-50 dark:ring-indigo-900'
                      : 'border-transparent hover:bg-white dark:hover:bg-slate-800 hover:border-slate-200 dark:hover:border-slate-700'
                  }
                `}
              >
                <div className={`
                   flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center
                   ${activeConversationId === conv.id ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}
                `}>
                   <MessageSquare className="h-4 w-4" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3
                    className={`text-sm font-medium truncate ${
                      activeConversationId === conv.id ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white'
                    }`}
                  >
                    {conv.title}
                  </h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
                    {new Date(conv.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={(e) => handleDeleteClick(e, conv.id)}
                  className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"
                  aria-label="Delete conversation"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <DeleteConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        title={conversations.find((c) => c.id === deleteId)?.title}
      />
    </>
  );
}