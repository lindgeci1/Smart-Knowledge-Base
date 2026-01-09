export type Role = 'user' | 'assistant';

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  documentId?: string; // Locked document ID for this conversation
}

export interface Document {
  id: string;
  name: string;
  type: 'pdf' | 'docx' | 'txt' | 'sheet';
}

export interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Record<string, Message[]>; // conversationId -> messages
  selectedDocument: Document | null;
  isDocumentLocked: boolean;
  isLoading: boolean;
  isSidebarOpen: boolean;
  isChatOpen: boolean;
}
