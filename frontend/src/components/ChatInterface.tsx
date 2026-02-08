import { useEffect, useRef, useState } from "react";
import { MessageSquare, Bot } from "lucide-react";
import { useChatState } from "../hooks/useChatState";
import { ChatSidebar } from "./ChatSidebar";
import { ChatHeader } from "./ChatHeader";
import { MessagesArea } from "./MessagesArea";
import { MessageInput } from "./MessageInput";
import { apiClient } from "../lib/authClient";
import { PodcastPlayer } from "./PodcastPlayer";
import { Document } from "../types/chat";

type PodcastSegment = {
  speaker: string;
  startTime: number;
  endTime: number;
};

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

  const [podcastState, setPodcastState] = useState<{
    url: string | null;
    isLoading: boolean;
    title: string;
    segments: PodcastSegment[];
    statusLabel: string;
  }>({ url: null, isLoading: false, title: "", segments: [], statusLabel: "" });
  const lastObjectUrlRef = useRef<string | null>(null);

  const [cachedPodcast, setCachedPodcast] = useState<{
    docId: string;
    audioUrl: string;
    segments: PodcastSegment[];
  } | null>(null);

  const openCachedPodcastInPlayer = (doc: Document) => {
    if (!doc?.id) return;
    if (!cachedPodcast) return;
    if (cachedPodcast.docId !== doc.id) return;
    if (!cachedPodcast.audioUrl) return;

    lastObjectUrlRef.current = cachedPodcast.audioUrl;
    setPodcastState({
      url: cachedPodcast.audioUrl,
      isLoading: false,
      title: doc.name || "Podcast",
      segments: cachedPodcast.segments ?? [],
      statusLabel: "Loaded instantly (cached)",
    });
  };

  const closePodcast = () => {
    if (lastObjectUrlRef.current) {
      try {
        // Only revoke blob/object URLs
        if (lastObjectUrlRef.current.startsWith("blob:")) {
          URL.revokeObjectURL(lastObjectUrlRef.current);
        }
      } catch {
        // ignore
      }
      lastObjectUrlRef.current = null;
    }
    setPodcastState({ url: null, isLoading: false, title: "", segments: [], statusLabel: "" });
  };

  const handleGeneratePodcast = async (doc: Document) => {
    if (!doc?.id) return;
    if (podcastState.isLoading) return;

    // If cached for this doc, open instantly (no regenerate)
    if (cachedPodcast && cachedPodcast.docId === doc.id && cachedPodcast.audioUrl) {
      lastObjectUrlRef.current = cachedPodcast.audioUrl;
      setPodcastState({
        url: cachedPodcast.audioUrl,
        isLoading: false,
        title: doc.name || "Podcast",
        segments: cachedPodcast.segments ?? [],
        statusLabel: "Loaded instantly (cached)",
      });
      return;
    }

    // Pop up the player immediately in "Producing..." state
    setPodcastState({
      url: null,
      isLoading: true,
      title: doc.name || "Podcast",
      segments: [],
      statusLabel: "",
    });

    try {
      const response = await apiClient.post(`/Podcast/generate/${doc.id}`);
      const audioUrl = (response.data?.audioUrl as string | undefined) ?? "";
      const segments = (response.data?.segments as PodcastSegment[] | undefined) ?? [];
      const isCached = Boolean(response.data?.isCached);
      if (!audioUrl) throw new Error("Missing audioUrl from podcast response.");

      // Clean up previous blob/object URL
      if (lastObjectUrlRef.current) {
        try {
          if (lastObjectUrlRef.current.startsWith("blob:")) {
            URL.revokeObjectURL(lastObjectUrlRef.current);
          }
        } catch {
          // ignore
        }
      }
      lastObjectUrlRef.current = audioUrl;

      setPodcastState({
        url: audioUrl,
        isLoading: false,
        title: doc.name || "Podcast",
        segments,
        statusLabel: isCached ? "Loaded instantly (cached)" : "Saved to Cloudinary",
      });
    } catch (err) {
      console.error("Failed to generate podcast:", err);
      setPodcastState((prev) => ({ ...prev, isLoading: false }));
    }
  };

  // When a document/text is selected, check if a cached podcast exists (no generation).
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!selectedDocument?.id) {
        setCachedPodcast(null);
        return;
      }
      try {
        const resp = await apiClient.get(`/Podcast/metadata/${selectedDocument.id}`);
        const audioUrl = (resp.data?.audioUrl as string | undefined) ?? "";
        const segments = (resp.data?.segments as PodcastSegment[] | undefined) ?? [];
        if (!audioUrl) {
          if (!cancelled) setCachedPodcast(null);
          return;
        }
        if (!cancelled) {
          setCachedPodcast({ docId: selectedDocument.id, audioUrl, segments });
        }
      } catch (e: any) {
        // 404 means "not cached" - normal.
        if (!cancelled) setCachedPodcast(null);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [selectedDocument?.id]);

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

  useEffect(() => {
    return () => {
      // Cleanup object URL on unmount
      if (lastObjectUrlRef.current) {
        try {
          URL.revokeObjectURL(lastObjectUrlRef.current);
        } catch {
          // ignore
        }
        lastObjectUrlRef.current = null;
      }
    };
  }, []);

  return (
    <>
      {!isChatOpen ? (
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
      ) : (
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
                onGeneratePodcast={handleGeneratePodcast}
                onOpenPodcast={openCachedPodcastInPlayer}
                isGeneratingPodcast={podcastState.isLoading}
                cachedPodcastUrl={cachedPodcast?.docId === selectedDocument?.id ? (cachedPodcast?.audioUrl ?? null) : null}
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
                        ? "Ask..."
                        : "Ask AI..."
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
      )}

      {(podcastState.isLoading || !!podcastState.url) && (
        <PodcastPlayer
          audioUrl={podcastState.url ?? ""}
          isLoading={podcastState.isLoading}
          title={podcastState.title || "Podcast"}
          segments={podcastState.segments}
          statusLabel={podcastState.statusLabel}
          onClose={closePodcast}
        />
      )}
    </>
  );
}