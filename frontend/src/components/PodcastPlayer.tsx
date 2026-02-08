import { useEffect, useMemo, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import { ChevronUp, Minimize2, Pause, Play, X } from "lucide-react";

interface PodcastPlayerProps {
  audioUrl: string;
  isLoading?: boolean;
  title: string;
  statusLabel?: string;
  segments?: Array<{
    speaker: string;
    startTime: number;
    endTime: number;
  }>;
  onClose?: () => void;
}

export function PodcastPlayer({
  audioUrl,
  isLoading = false,
  title,
  statusLabel,
  segments = [],
  onClose,
}: PodcastPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const waveWrapRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<HTMLDivElement | null>(null);
  const waveSurferRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<unknown | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [activeSpeaker, setActiveSpeaker] = useState<"Alex" | "Sarah" | null>(null);
  const [cursorPx, setCursorPx] = useState<number | null>(null);
  const durationRef = useRef<number>(0);
  const lastProgressColorRef = useRef<string | null>(null);
  const segmentsRef = useRef(segments);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    rectLeft: number;
    rectTop: number;
    width: number;
    height: number;
    dragging: boolean;
  } | null>(null);

  const waveOptions = useMemo(
    () => ({
      height: 48,
      waveColor: "#94a3b8", // slate-400
      progressColor: "#4f46e5", // indigo-600
      cursorColor: "#0f172a", // slate-900
      barWidth: 2,
      barGap: 2,
      barRadius: 2,
      normalize: true,
      interact: true,
    }),
    []
  );

  const activeGlow = activeSpeaker === "Sarah" ? "emerald" : "indigo";

  const renderRegions = (ws: WaveSurfer) => {
    const regAny = regionsRef.current as
      | null
      | {
          clearRegions?: () => void;
          addRegion?: (opts: Record<string, unknown>) => void;
        };

    if (!regAny?.clearRegions || !regAny?.addRegion) return;

    const duration = ws.getDuration?.() ?? 0;
    if (!duration || !Number.isFinite(duration) || duration <= 0) return;

    try {
      regAny.clearRegions();
    } catch {
      // ignore
    }

    const segs = segmentsRef.current ?? [];
    for (const seg of segs) {
      const speaker = (seg.speaker ?? "").toLowerCase();
      const isSarah = speaker === "sarah";
      const isAlex = speaker === "alex";
      if (!isSarah && !isAlex) continue;

      let start = Number(seg.startTime);
      let end = Number(seg.endTime);
      if (!Number.isFinite(start) || !Number.isFinite(end)) continue;

      // Clamp to the audio duration
      start = Math.max(0, Math.min(start, duration));
      end = Math.max(0, Math.min(end, duration));
      if (end <= start) continue;

      // Ensure tiny regions are still visible/clickable.
      if (end - start < 0.02) end = Math.min(duration, start + 0.02);

      const color = isAlex
        ? "rgba(99, 102, 241, 0.3)" // purple
        : "rgba(16, 185, 129, 0.3)"; // green

      try {
        regAny.addRegion({
          start,
          end,
          color,
          drag: false,
          resize: false,
        });
      } catch {
        // ignore
      }
    }
  };

  const updateCursorOverlay = (t: number) => {
    const dur = durationRef.current;
    const wrap = waveWrapRef.current;
    if (!dur || !wrap) return;
    if (!Number.isFinite(t) || t < 0) return;

    const ratio = Math.max(0, Math.min(1, t / dur));
    const w = wrap.getBoundingClientRect().width;
    if (!w || !Number.isFinite(w)) return;
    setCursorPx(ratio * w);
  };

  useEffect(() => {
    segmentsRef.current = segments ?? [];
  }, [segments]);

  useEffect(() => {
    const ws = waveSurferRef.current;
    if (!ws || !isReady) return;
    renderRegions(ws);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments, isReady]);

  useEffect(() => {
    // If we're loading or have no audio, ensure any previous waveform is cleaned up.
    if (isLoading || !audioUrl || !containerRef.current) {
      if (waveSurferRef.current) {
        try {
          waveSurferRef.current.destroy();
        } catch {
          // ignore
        }
        waveSurferRef.current = null;
      }
      regionsRef.current = null;
      durationRef.current = 0;
      setCursorPx(null);
      setIsReady(false);
      setIsPlaying(false);
      setActiveSpeaker(null);
      return;
    }

    // Cleanup any previous instance
    if (waveSurferRef.current) {
      try {
        waveSurferRef.current.destroy();
      } catch {
        // ignore
      }
      waveSurferRef.current = null;
    }
    regionsRef.current = null;
    durationRef.current = 0;
    setCursorPx(null);

    const ws = WaveSurfer.create({
      container: containerRef.current,
      ...waveOptions,
    });

    waveSurferRef.current = ws;
    // Register Regions plugin for colored, read-only timeline sections.
    try {
      regionsRef.current = ws.registerPlugin(RegionsPlugin.create());
    } catch {
      regionsRef.current = null;
    }
    setIsReady(false);
    setIsPlaying(false);

    ws.on("ready", () => {
      setIsReady(true);
      durationRef.current = ws.getDuration?.() ?? 0;
      updateCursorOverlay(ws.getCurrentTime());
      renderRegions(ws);
    });
    ws.on("play", () => setIsPlaying(true));
    ws.on("pause", () => setIsPlaying(false));
    ws.on("finish", () => setIsPlaying(false));

    const updateSpeaker = (t: number) => {
      const segs = segmentsRef.current ?? [];
      const seg = segs.find((s) => t >= s.startTime && t < s.endTime) ?? null;

      const speaker =
        seg?.speaker?.toLowerCase() === "sarah"
          ? "Sarah"
          : seg?.speaker?.toLowerCase() === "alex"
            ? "Alex"
            : null;

      setActiveSpeaker(speaker);

      // Keep the "filled" progress portion speaker-colored while playing.
      const color = speaker === "Sarah" ? "#10b981" : "#6366f1";
      if (color !== lastProgressColorRef.current) {
        lastProgressColorRef.current = color;
        const anyWs = ws as unknown as { setOptions?: (opts: Record<string, unknown>) => void };
        if (typeof anyWs.setOptions === "function") {
          anyWs.setOptions({ progressColor: color });
        }
      }
    };

    const onAudioProcess = (t: number) => {
      updateSpeaker(t);
      updateCursorOverlay(t);
    };
    const onInteraction = () => {
      const t = ws.getCurrentTime();
      updateSpeaker(t);
      updateCursorOverlay(t);
    };

    ws.on("audioprocess", onAudioProcess);
    // Fired on click/drag seek even while paused.
    ws.on("interaction", onInteraction);

    ws.load(audioUrl);

    return () => {
      try {
        ws.un("audioprocess", onAudioProcess);
        ws.un("interaction", onInteraction);
      } catch {
        // ignore
      }
      try {
        ws.destroy();
      } catch {
        // ignore
      }
      waveSurferRef.current = null;
      regionsRef.current = null;
      durationRef.current = 0;
    };
  }, [audioUrl, isLoading, waveOptions]);

  const togglePlay = () => {
    const ws = waveSurferRef.current;
    if (!ws) return;
    ws.playPause();
  };

  const canPlay = !isLoading && !!audioUrl && isReady;

  const onPointerDownDrag = (e: React.PointerEvent) => {
    if (isMinimized) return;
    // Only left click / primary pointer
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const rect = playerRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: offset.x,
      origY: offset.y,
      rectLeft: rect.left,
      rectTop: rect.top,
      width: rect.width,
      height: rect.height,
      dragging: true,
    };
  };

  const onPointerMoveDrag = (e: React.PointerEvent) => {
    const st = dragRef.current;
    if (!st?.dragging) return;
    const dx = e.clientX - st.startX;
    const dy = e.clientY - st.startY;

    // Clamp within viewport (keep the card fully visible with a small margin)
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const unclampedLeft = st.rectLeft + dx;
    const unclampedTop = st.rectTop + dy;

    const minLeft = margin;
    const maxLeft = Math.max(margin, vw - st.width - margin);
    const minTop = margin;
    const maxTop = Math.max(margin, vh - st.height - margin);

    const clampedLeft = Math.min(Math.max(unclampedLeft, minLeft), maxLeft);
    const clampedTop = Math.min(Math.max(unclampedTop, minTop), maxTop);

    const adjDx = clampedLeft - st.rectLeft;
    const adjDy = clampedTop - st.rectTop;

    setOffset({ x: st.origX + adjDx, y: st.origY + adjDy });
  };

  const onPointerUpDrag = () => {
    if (dragRef.current) dragRef.current.dragging = false;
  };

  const SpeakerViz = ({
    name,
    role,
    isActiveSpeaker,
  }: {
    name: string;
    role: string;
    isActiveSpeaker: boolean;
  }) => {
    const active = isLoading || isPlaying;
    const isAlex = name.toLowerCase() === "alex";
    const accent: "indigo" | "emerald" = isAlex ? "indigo" : "emerald";
    const badgeText = isLoading ? "Connecting..." : role;
    return (
      <div
        className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300 min-w-0 ${
          isActiveSpeaker
            ? accent === "indigo"
              ? "bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-500/60"
              : "bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-500/60"
            : "bg-slate-50 dark:bg-slate-800/50 ring-1 ring-black/5 dark:ring-white/5"
        }`}
      >
        <div
          className={`h-12 w-12 rounded-2xl flex items-center justify-center ring-1 transition-all relative ${
            accent === "indigo"
              ? "bg-indigo-50/70 dark:bg-indigo-900/30 ring-indigo-100/70 dark:ring-indigo-800/70"
              : "bg-emerald-50/70 dark:bg-emerald-900/25 ring-emerald-100/70 dark:ring-emerald-800/70"
          } ${
            isActiveSpeaker
              ? accent === "indigo"
                ? "scale-[1.04] ring-2 ring-indigo-500 shadow-lg shadow-indigo-500/20 animate-pulse"
                : "scale-[1.04] ring-2 ring-emerald-500 shadow-lg shadow-emerald-500/20 animate-pulse"
              : ""
          } ${isLoading ? "animate-pulse" : ""}`}
        >
          <div className={`h-2.5 w-2.5 rounded-full ${active ? "animate-pulse" : ""} ${
            accent === "indigo" ? "bg-indigo-600/80" : "bg-emerald-600/80"
          }`} />
        </div>
        <div className="min-w-0">
          <div className="font-bold text-lg text-slate-900 dark:text-white leading-tight truncate">
            {name}
          </div>
          <div className="mt-1">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                isLoading
                  ? "bg-slate-200/80 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300"
                  : accent === "indigo"
                    ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200"
                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
              }`}
            >
              {badgeText}
            </span>
          </div>
        </div>
        <div className="ml-auto flex items-end gap-1">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-1 rounded-full ${active ? "animate-pulse" : ""} ${
                accent === "indigo" ? "bg-indigo-500/70" : "bg-emerald-500/70"
              }`}
              style={{
                height: 6 + i * 4,
                animationDelay: `${i * 120}ms`,
              }}
            />
          ))}
        </div>
      </div>
    );
  };

  const toggleMinimize = () => {
    setIsMinimized((prev) => {
      const next = !prev;
      // Always snap back to the default position (bottom centered)
      setOffset({ x: 0, y: 0 });
      return next;
    });
  };

  return (
    <div className="fixed left-0 right-0 bottom-4 z-[60] p-3 sm:p-4 pointer-events-none" style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}>
      <div
        className={`pointer-events-auto mx-auto rounded-2xl overflow-hidden border border-white/20 dark:border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl bg-white/90 dark:bg-slate-900/90 ${
          isMinimized ? "max-w-md" : "max-w-5xl"
        }`}
        ref={playerRef}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/20 dark:border-white/10 select-none">
          {/* Drag handle (kept off the buttons so clicks work) */}
          <div
            className={`min-w-0 flex-1 ${isMinimized ? "cursor-default" : "cursor-grab active:cursor-grabbing"}`}
            onPointerDown={isMinimized ? undefined : onPointerDownDrag}
            onPointerMove={isMinimized ? undefined : onPointerMoveDrag}
            onPointerUp={isMinimized ? undefined : onPointerUpDrag}
            title="Drag to move"
          >
            <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
              {title}
            </div>
            <div className="text-xs text-slate-600/80 dark:text-slate-300/70">
              {isLoading ? "Generating audio..." : (statusLabel ?? "Podcast Generator")}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleMinimize}
              className="inline-flex items-center justify-center h-10 w-10 rounded-xl border border-white/25 dark:border-white/10 text-slate-700/80 dark:text-slate-200/80 hover:bg-white/60 dark:hover:bg-white/5 transition-colors"
              aria-label={isMinimized ? "Expand player" : "Minimize player"}
              title={isMinimized ? "Expand" : "Minimize"}
            >
              {isMinimized ? <ChevronUp className="h-5 w-5" /> : <Minimize2 className="h-5 w-5" />}
            </button>

            <button
              onClick={togglePlay}
              disabled={!canPlay}
              className={`inline-flex items-center justify-center h-10 w-10 rounded-xl border transition-colors ${
                canPlay
                  ? "border-white/25 dark:border-white/10 bg-white/60 dark:bg-white/5 text-slate-900 dark:text-white hover:bg-white/80 dark:hover:bg-white/10"
                  : "border-white/15 dark:border-white/10 bg-white/40 dark:bg-white/5 text-slate-400 cursor-not-allowed"
              }`}
              aria-label={isPlaying ? "Pause" : "Play"}
              title={isLoading ? "Producing..." : isReady ? "Play/Pause" : "Loading audio..."}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5" />
              )}
            </button>

            <button
              onClick={onClose}
              className="inline-flex items-center justify-center h-10 w-10 rounded-xl border border-white/25 dark:border-white/10 text-slate-700/80 dark:text-slate-200/80 hover:bg-white/60 dark:hover:bg-white/5 transition-colors"
              aria-label="Close player"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className={`px-4 ${isMinimized ? "py-2" : "py-3"} space-y-3`}>
          {/* Speaker section (hide when minimized), waveform stays visible for skipping/seeking */}
          {!isMinimized && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SpeakerViz name="Alex" role="Host" isActiveSpeaker={activeSpeaker === "Alex"} />
              <SpeakerViz name="Sarah" role="Expert" isActiveSpeaker={activeSpeaker === "Sarah"} />
            </div>
          )}

          {isLoading ? (
            <div className={`w-full ${isMinimized ? "py-1" : "py-2"} space-y-3`}>
              {!isMinimized && (
                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-600/80 dark:text-slate-300/70 animate-[fade_1.6s_ease-in-out_infinite]">
                    AI Hosts are analyzing your document...
                  </div>
                </div>
              )}

              <div className="h-16 w-full bg-slate-50 dark:bg-slate-800/50 rounded-xl flex items-center justify-center gap-2 overflow-hidden relative">
                {/* Subtle background shimmer */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/45 to-transparent dark:via-white/10 bg-[length:200%_100%] animate-[shimmer_1.35s_linear_infinite]" />

                <div className="relative z-[1] flex items-center justify-center gap-3">
                  <div className="flex items-end gap-1.5">
                    {[
                      { h: 14, c: "bg-indigo-500" },
                      { h: 22, c: "bg-emerald-500" },
                      { h: 30, c: "bg-indigo-500" },
                      { h: 20, c: "bg-emerald-500" },
                      { h: 26, c: "bg-indigo-500" },
                      { h: 18, c: "bg-emerald-500" },
                    ].map((b, i) => (
                      <div
                        key={i}
                        className={`w-1.5 rounded-full ${b.c} animate-bounce`}
                        style={{
                          height: `${b.h}px`,
                          animationDelay: `${i * 150}ms`,
                          animationDuration: "900ms",
                        }}
                      />
                    ))}
                  </div>

                  <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Synthesizing Audio...
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div
              ref={waveWrapRef}
              className={`relative w-full rounded-xl border border-white/25 dark:border-white/10 bg-white/60 dark:bg-white/5 overflow-hidden ${
                isPlaying
                  ? activeGlow === "emerald"
                    ? "shadow-[0_0_26px_rgba(16,185,129,0.25)]"
                    : "shadow-[0_0_26px_rgba(99,102,241,0.25)]"
                  : ""
              }`}
            >
              {/* Cursor glow overlay */}
              {isPlaying && cursorPx != null && (
                <div
                  className="pointer-events-none absolute inset-y-0"
                  style={{ left: Math.max(0, cursorPx - 10) }}
                >
                  <div
                    className={`h-full w-1 rounded-full ${
                      activeGlow === "emerald"
                        ? "bg-emerald-400/50 shadow-[0_0_22px_rgba(16,185,129,0.55)]"
                        : "bg-indigo-400/50 shadow-[0_0_22px_rgba(99,102,241,0.55)]"
                    } blur-[0.2px]`}
                  />
                </div>
              )}

              <div ref={containerRef} className="w-full px-3 py-2" />

              {/* Subtle bottom glow matching active speaker */}
              {isPlaying && (
                <div
                  className={`pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 h-16 w-72 rounded-full blur-2xl ${
                    activeGlow === "emerald" ? "bg-emerald-400/20" : "bg-indigo-400/20"
                  }`}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* local keyframes for shimmer/fade */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes fade {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 0.95; }
        }
      `}</style>
    </div>
  );
}

