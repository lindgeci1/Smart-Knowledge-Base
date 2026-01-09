import { useState, useEffect, useCallback } from "react";
import { Conversation, Message, Document } from "../types/chat";
import { apiClient } from "../lib/authClient";

export function useChatState() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(
    null
  );
  const [isDocumentLocked, setIsDocumentLocked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [availableDocuments, setAvailableDocuments] = useState<Document[]>([]);
  const [animatingMessageId, setAnimatingMessageId] = useState<string | null>(
    null
  );

  // Helper to get current messages
  const currentMessages = activeConversationId
    ? messages[activeConversationId] || []
    : [];

  // Fetch all conversations
  const fetchConversations = useCallback(async () => {
    try {
      const response = await apiClient.get("/Chat/GetAllChats");

      // Transform backend format to frontend format
      const transformedConversations: Conversation[] = response.data.map(
        (chat: any) => ({
          id: chat.chatId,
          title: chat.title,
          createdAt: new Date(chat.createdAt).getTime(),
          updatedAt: new Date(chat.updatedAt).getTime(),
          documentId: chat.documentId,
        })
      );

      setConversations(transformedConversations);
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
    }
  }, []);

  // Fetch messages for a specific conversation
  const fetchMessages = useCallback(async (chatId: string) => {
    try {
      const response = await apiClient.get(`/Chat/GetAllMessages/${chatId}`);

      // Transform backend format to frontend format
      const transformedMessages: Message[] = response.data.map((msg: any) => ({
        id: msg.chatMessageId || msg.messageId || `msg-${crypto.randomUUID()}`,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.createdAt).getTime(),
      }));

      setMessages((prev) => ({
        ...prev,
        [chatId]: transformedMessages,
      }));
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    }
  }, []);

  // Fetch available documents (summaries)
  const fetchDocuments = useCallback(async () => {
    try {
      // Fetch both file summaries and text summaries
      const [documentsResponse, textsResponse] = await Promise.all([
        apiClient.get("/Documents/summaries"),
        apiClient.get("/Texts/summaries"),
      ]);

      const docs: Document[] = [
        ...documentsResponse.data.map((doc: any) => ({
          id: doc.id,
          name: doc.documentName || doc.fileName || "Unnamed Document",
          type: "pdf" as const,
        })),
        ...textsResponse.data.map((text: any) => ({
          id: text.id,
          name: text.textName || "Text Summary",
          type: "txt" as const,
        })),
      ];

      setAvailableDocuments(docs);
    } catch (error) {
      console.error("Failed to fetch documents:", error);
    }
  }, []);

  // Load initial data when chat opens
  useEffect(() => {
    if (isChatOpen) {
      fetchConversations();
      fetchDocuments();
    }
  }, [isChatOpen, fetchConversations, fetchDocuments]);

  const toggleChat = useCallback(() => setIsChatOpen((prev) => !prev), []);
  const toggleSidebar = useCallback(
    () => setIsSidebarOpen((prev) => !prev),
    []
  );

  const createNewChat = useCallback(async () => {
    try {
      const response = await apiClient.post("/Chat/CreateChat", {
        title: "New Chat",
      });

      const newChat = response.data;
      const newConversation: Conversation = {
        id: newChat.chatId,
        title: newChat.title,
        createdAt: new Date(newChat.createdAt).getTime(),
        updatedAt: new Date(newChat.updatedAt).getTime(),
      };

      setConversations((prev) => [newConversation, ...prev]);
      setMessages((prev) => ({
        ...prev,
        [newConversation.id]: [],
      }));
      setActiveConversationId(newConversation.id);
      setSelectedDocument(null);
      setIsDocumentLocked(false);

      // Auto-close sidebar on mobile
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      }
    } catch (error) {
      console.error("Failed to create new chat:", error);
    }
  }, []);

  const selectConversation = useCallback(
    async (id: string) => {
      setActiveConversationId(id);

      // Fetch messages if not already loaded
      if (!messages[id]) {
        await fetchMessages(id);
      }

      // Check if conversation has locked document
      const conversation = conversations.find((c) => c.id === id);
      if (conversation && conversation.documentId) {
        // Restore the locked document from the conversation
        const lockedDoc = availableDocuments.find(
          (d) => d.id === conversation.documentId
        );
        if (lockedDoc) {
          setSelectedDocument(lockedDoc);
          setIsDocumentLocked(true);
        } else {
          // If document not found in availableDocuments, create a placeholder
          // This ensures the document is locked even if not in the list
          const placeholderDoc: Document = {
            id: conversation.documentId,
            name: `Document (${conversation.documentId.substring(0, 8)}...)`,
            type: "pdf",
          };
          setSelectedDocument(placeholderDoc);
          setIsDocumentLocked(true);
        }
      } else {
        // No locked document for this conversation
        setSelectedDocument(null);
        setIsDocumentLocked(false);
      }

      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      }
    },
    [conversations, messages, fetchMessages, availableDocuments]
  );

  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        await apiClient.delete(`/Chat/DeleteChat/${id}`);

        setConversations((prev) => prev.filter((c) => c.id !== id));
        setMessages((prev) => {
          const newMessages = { ...prev };
          delete newMessages[id];
          return newMessages;
        });

        if (activeConversationId === id) {
          setActiveConversationId(null);
          setSelectedDocument(null);
          setIsDocumentLocked(false);
        }
      } catch (error) {
        console.error("Failed to delete conversation:", error);
      }
    },
    [activeConversationId]
  );

  const selectDocument = useCallback(
    (doc: Document | null) => {
      if (!isDocumentLocked) {
        setSelectedDocument(doc);
      }
    },
    [isDocumentLocked]
  );

  const sendMessage = useCallback(
    async (content: string) => {
      if (!activeConversationId) return;

      // Lock document once conversation starts
      if (selectedDocument && !isDocumentLocked) {
        setIsDocumentLocked(true);
      }

      // Generate a truly unique temp ID using crypto
      const tempId = `temp-${crypto.randomUUID()}`;

      const userMsg: Message = {
        id: tempId,
        role: "user",
        content,
        timestamp: Date.now(),
      };

      // Add user message optimistically
      setMessages((prev) => ({
        ...prev,
        [activeConversationId]: [
          ...(prev[activeConversationId] || []),
          userMsg,
        ],
      }));

      setIsLoading(true);

      try {
        const requestBody: { message: string; documentId?: string | null } = {
          message: content,
        };
        
        // Only include documentId if a document is selected
        if (selectedDocument?.id) {
          requestBody.documentId = selectedDocument.id;
        } else {
          requestBody.documentId = null;
        }

        console.log('[useChatState] Sending message:', {
          chatId: activeConversationId,
          messageLength: content.length,
          documentId: requestBody.documentId || 'null (RAG mode)',
        });

        const response = await apiClient.post(
          `/Chat/CreateMessage/${activeConversationId}`,
          requestBody
        );

        const aiMessage = response.data;
        const transformedAiMessage: Message = {
          id: aiMessage.chatMessageId || `ai-${crypto.randomUUID()}`,
          role: "assistant",
          content: aiMessage.content,
          timestamp: new Date(aiMessage.createdAt).getTime(),
        };

        // Replace temp user message with real one and add AI response
        setMessages((prev) => {
          const currentMessages = prev[activeConversationId] || [];
          // Remove the temp message and add both real messages
          const withoutTemp = currentMessages.filter((m) => m.id !== tempId);
          return {
            ...prev,
            [activeConversationId]: [
              ...withoutTemp,
              userMsg,
              transformedAiMessage,
            ],
          };
        });

        // Trigger animation for this AI message
        setAnimatingMessageId(transformedAiMessage.id);

        // Persist the locked document on the conversation locally so it stays locked when switching
        if (selectedDocument?.id) {
          setConversations((prev) =>
            prev.map((c) =>
              c.id === activeConversationId
                ? { ...c, documentId: selectedDocument.id }
                : c
            )
          );
        }

        // Update conversation title if it changed
        const currentChat = conversations.find(
          (c) => c.id === activeConversationId
        );
        if (
          currentChat &&
          (currentChat.title === "New Chat" ||
            currentChat.title === "New Conversation" ||
            (typeof currentChat.title === "string" &&
              currentChat.title.toLowerCase().startsWith("new")))
        ) {
          setConversations((prev) =>
            prev.map((c) =>
              c.id === activeConversationId
                ? {
                    ...c,
                    title:
                      content.slice(0, 30) + (content.length > 30 ? "..." : ""),
                    updatedAt: Date.now(),
                  }
                : c
            )
          );
        }
      } catch (error) {
        console.error("Failed to send message:", error);
        // Remove the optimistic message on error
        setMessages((prev) => ({
          ...prev,
          [activeConversationId]: (prev[activeConversationId] || []).filter(
            (m) => m.id !== tempId
          ),
        }));
      } finally {
        setIsLoading(false);
      }
    },
    [activeConversationId, selectedDocument, isDocumentLocked, conversations]
  );

  // When documents load or change, reapply locked document for the active conversation
  useEffect(() => {
    if (!activeConversationId || availableDocuments.length === 0) return;

    const conversation = conversations.find(
      (c) => c.id === activeConversationId
    );
    if (conversation?.documentId) {
      // If selectedDocument already matches, keep as is
      if (selectedDocument?.id === conversation.documentId && isDocumentLocked)
        return;

      const lockedDoc = availableDocuments.find(
        (d) => d.id === conversation.documentId
      );
      if (lockedDoc) {
        setSelectedDocument(lockedDoc);
        setIsDocumentLocked(true);
      }
    }
  }, [availableDocuments, activeConversationId, conversations]);

  return {
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
    finishAnimation: () => setAnimatingMessageId(null),
    refreshConversations: fetchConversations,
  };
}
