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
      // Handle both sync and async implementations
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
          className="fixed inset-0 bg-black/30 z-30 md:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <div
        className={`
        absolute md:relative inset-y-0 left-0 z-40
        w-64 bg-white border-r border-slate-200
        transform transition-transform duration-300 ease-in-out flex flex-col
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}
      >
        {/* Header */}
        <div className="p-3 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Conversations</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
              aria-label="Refresh conversations"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onCloseMobile}
              className="md:hidden p-1.5 text-slate-400 hover:text-slate-600"
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* New Chat Button */}
        <div className="p-3">
          <button
            onClick={onNewChat}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-sm hover:shadow transition-all font-medium text-sm"
          >
            <Plus className="h-4 w-4" />
            <span>New Chat</span>
          </button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1">
          {conversations.length === 0 ? (
            <div className="text-center py-6 px-3">
              <div className="w-10 h-10 bg-slate-100 rounded flex items-center justify-center mx-auto mb-2">
                <MessageSquare className="h-5 w-5 text-slate-400" />
              </div>
              <p className="text-xs text-slate-500">
                No conversations yet.
                <br />
                Start a new chat!
              </p>
            </div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={`
                  group flex items-center gap-2 p-2 rounded cursor-pointer transition-all border
                  ${
                    activeConversationId === conv.id
                      ? 'bg-blue-50 border-blue-200 shadow-sm'
                      : 'border-transparent hover:bg-slate-50 text-slate-600'
                  }
                `}
              >
                <MessageSquare
                  className={`h-4 w-4 flex-shrink-0 ${
                    activeConversationId === conv.id
                      ? 'text-blue-600'
                      : 'text-slate-400'
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <h3
                    className={`text-sm font-medium truncate ${
                      activeConversationId === conv.id ? 'text-slate-900' : ''
                    }`}
                  >
                    {conv.title}
                  </h3>
                  <p className="text-xs text-slate-400 truncate">
                    {new Date(conv.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={(e) => handleDeleteClick(e, conv.id)}
                  className={`
                    p-1 rounded transition-opacity
                    ${
                      activeConversationId === conv.id
                        ? 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                        : 'text-slate-400 hover:text-red-600 hover:bg-slate-100'
                    }
                  `}
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
