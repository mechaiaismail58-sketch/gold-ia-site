"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import LiveTicker from "@/components/LiveTicker";
import OnboardingModal from "@/components/OnboardingModal";
import ShareSignalButton from "@/components/ShareSignalButton";
import HistoryPanel from "@/components/HistoryPanel";
import MarkdownMessage from "@/components/MarkdownMessage";
import { useChatContext } from "@/context/ChatContext";

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

async function saveConversation(params: {
  session_id: string;
  mode: string;
  message_user: string;
  message_ia: string;
  image_attached: boolean;
}) {
  try {
    await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  } catch (err) {
    console.error("[saveConversation]", err);
  }
}

export default function ChatPage() {
  const {
    messages,
    setMessages,
    analysisMode,
    setAnalysisMode,
    previousResponseId,
    setPreviousResponseId,
    sessionId,
    startNewChat,
  } = useChatContext();

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);

  const [respondedTradeIds, setRespondedTradeIds] = useState<Set<string>>(new Set());

  const placeholders = [
    "Ask for a gold trade signal...",
    "Is XAUUSD ready to break higher?",
    "Give me a daytrade setup on gold",
  ];
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [placeholderVisible, setPlaceholderVisible] = useState(true);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatInputRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data?.profile && !data.profile.onboarding_completed) {
          setShowOnboarding(true);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (input.length > 0) return;
    const interval = setInterval(() => {
      setPlaceholderVisible(false);
      setTimeout(() => {
        setPlaceholderIndex((i) => (i + 1) % placeholders.length);
        setPlaceholderVisible(true);
      }, 300);
    }, 3000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const active = document.activeElement as HTMLElement | null;
      const isTyping =
        active?.tagName === "INPUT" ||
        active?.tagName === "TEXTAREA" ||
        active?.tagName === "SELECT";

      if (isTyping) {
        if (e.key === "Escape") {
          setInput("");
          active?.blur();
        }
        return;
      }

      if (e.key === "d" || e.key === "D") setAnalysisMode("deep");
      else if (e.key === "q" || e.key === "Q") setAnalysisMode("quick");
      else if (e.key === "t" || e.key === "T") setAnalysisMode("trade_only");
      else if (e.key === "Enter") chatInputRef.current?.focus();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [setAnalysisMode]);

  // Clipboard paste — detect image and attach it automatically
  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      if (!e.clipboardData) return;
      for (const item of Array.from(e.clipboardData.items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (!file) continue;
          e.preventDefault();
          setSelectedImage(file);
          return;
        }
      }
    }
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, []);

  useEffect(() => {
    if (!selectedImage) {
      setSelectedImagePreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(selectedImage);
    setSelectedImagePreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedImage]);

  const canSend = useMemo(() => {
    return (!loading && input.trim().length > 0) || (!loading && !!selectedImage);
  }, [input, loading, selectedImage]);

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file || !file.type.startsWith("image/")) return;
    setSelectedImage(file);
  }

  function clearSelectedImage() {
    setSelectedImage(null);
    setSelectedImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function send() {
    if (!canSend) return;

    const userText = input.trim();
    const imageToSend = selectedImage;
    const imagePreviewToSend = selectedImagePreview;

    setInput("");
    setSelectedImage(null);
    setSelectedImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";

    setLoading(true);

    setMessages((m) => [
      ...m,
      {
        role: "user",
        content: userText || "[Chart image attached]",
        imagePreview: imagePreviewToSend,
      },
    ]);

    try {
      const formData = new FormData();
      formData.append("userMessage", userText);
      formData.append("analysis_mode", analysisMode);
      formData.append("session_id", sessionId);
      if (previousResponseId) {
        formData.append("previous_response_id", previousResponseId);
      }
      if (imageToSend) {
        formData.append("chartImage", imageToSend);
      }

      const r = await fetch("/api/chat", {
        method: "POST",
        body: formData,
      });

      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Request failed");

      const tradeId = data.trade_id ?? data.pending_trade_id ?? null;
      setMessages((m) => [
        ...m,
        { role: "assistant", content: data.text ?? "…", trade_id: tradeId },
      ]);

      if (data.response_id) {
        setPreviousResponseId(data.response_id);
      }

      if (data.text) {
        saveConversation({
          session_id: sessionId,
          mode: analysisMode,
          message_user: userText || "[Chart image attached]",
          message_ia: data.text,
          image_attached: Boolean(imageToSend),
        }).catch(() => {});
      }
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "System error: AI not connected." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function submitResult(tradeId: string, result: string) {
    setRespondedTradeIds((prev) => new Set([...prev, tradeId]));
    try {
      const r = await fetch("/api/trades/result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trade_id: tradeId, result }),
      });
      const data = await r.json();
      const labels: Record<string, string> = {
        tp1_hit: "TP1 Hit",
        tp2_hit: "TP2 Hit",
        sl_hit: "SL Hit",
        breakeven: "Breakeven",
      };
      const labelStr = labels[result] ?? result;
      const confirmation = data.lesson_learned
        ? `Trade result recorded: **${labelStr}**\n\n${data.lesson_learned}`
        : `Trade result recorded: **${labelStr}**`;
      setMessages((m) => [...m, { role: "assistant", content: confirmation }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Failed to record trade result — please retry." }]);
    }
  }

  return (
    <main>
      {showOnboarding && (
        <OnboardingModal onComplete={() => setShowOnboarding(false)} />
      )}

      <HistoryPanel open={showHistory} onClose={() => setShowHistory(false)} />

      <section className="card rounded-2xl sm:rounded-3xl p-5 sm:p-8 border border-white/10 shadow-[0_18px_80px_rgba(109,40,217,0.18)]">
        <div className="flex flex-col gap-4">
          <h1 className="text-[28px] sm:text-[34px] leading-[1.15] tracking-[-0.02em]">
            Institutional-grade gold trade signals, filtered through a disciplined framework.
          </h1>

          <p className="text-[color:var(--muted)] max-w-[60ch] leading-6 text-[14px] sm:text-base">
            Bullion Desk evaluates whether the market is tradable first, then delivers structured gold trade signals, directional bias, and risk-aware execution logic only when conditions justify action.
          </p>

          <div className="flex gap-3 flex-wrap mt-2">
            <div className="rounded-2xl px-3 py-1 text-xs card border-[rgba(109,40,217,0.5)]">
              XAUUSD Signals
            </div>
            <div className="rounded-2xl px-3 py-1 text-xs card border-[rgba(200,162,74,0.35)]">
              Market Filter
            </div>
            <div className="rounded-2xl px-3 py-1 text-xs card border-[rgba(109,40,217,0.35)]">
              Risk-First
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5">
        <div className="flex items-stretch overflow-hidden rounded-xl border border-[rgba(109,40,217,0.40)] bg-[rgba(109,40,217,0.06)] shadow-[0_0_30px_rgba(109,40,217,0.08)]">
          <div className="flex items-center gap-2 px-4 shrink-0 border-r border-[rgba(109,40,217,0.30)]">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse shrink-0" />
            <span className="text-[10px] font-mono font-semibold tracking-[0.22em] uppercase text-white/35 whitespace-nowrap">Live</span>
          </div>
          <div className="flex-1 min-w-0 py-0.5">
            <LiveTicker />
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="card rounded-2xl sm:rounded-3xl p-0 overflow-hidden border border-white/10 shadow-[0_18px_90px_rgba(109,40,217,0.14)]">
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[color:var(--border)]">
            <div className="text-sm uppercase tracking-widest text-[color:var(--muted)]">
              Live Signal Console
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowHistory(true)}
                className="rounded-xl border border-white/10 px-3 py-1.5 min-h-[36px] text-[11px] uppercase tracking-[0.10em] text-[color:var(--muted)] hover:border-white/20 hover:text-white/70 transition flex items-center gap-1.5"
                title="Conversation history"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.1"/>
                  <path d="M6 3.5V6l2 1.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                History
              </button>
              <button
                type="button"
                onClick={startNewChat}
                className="rounded-xl border border-white/10 px-3 py-1.5 min-h-[36px] text-[11px] uppercase tracking-[0.10em] text-[color:var(--muted)] hover:border-[rgba(109,40,217,0.5)] hover:text-white/70 transition flex items-center gap-1.5"
                title="Start new analysis"
              >
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                New
              </button>
              <div className="hidden sm:block text-xs text-[color:var(--muted)]">AI Connected</div>
            </div>
          </div>

          <div className="px-4 sm:px-6 py-6 h-[calc(100svh-380px)] min-h-[320px] sm:h-[560px] overflow-y-auto flex flex-col gap-6">
            {messages.map((m, i) => (
              <div key={i} className="animate-fade-in-fast">
                {m.role === "user" ? (
                  <div className="flex justify-end">
                    <div className="max-w-[72%]">
                      {m.imagePreview && (
                        <div className="mb-2 flex justify-end">
                          <img
                            src={m.imagePreview}
                            alt="Attached chart"
                            className="max-h-48 rounded-xl border border-white/10"
                          />
                        </div>
                      )}
                      <div className="inline-block rounded-2xl rounded-tr-sm px-4 py-2.5 text-[13px] leading-[1.65] bg-[rgba(109,40,217,0.16)] border border-[rgba(109,40,217,0.40)] text-white/85 break-words">
                        {m.content}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="h-1 w-1 rounded-full bg-[rgba(200,162,74,0.7)] shrink-0" />
                      <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/25">
                        Bullion Desk
                      </span>
                    </div>
                    <div className="pl-3 border-l border-white/[0.06]">
                      <MarkdownMessage content={m.content} />
                    </div>
                    <div className="pl-3">
                      <ShareSignalButton text={m.content} />
                    </div>
                    {m.trade_id && !respondedTradeIds.has(m.trade_id) && (
                      <div className="pl-3 flex flex-wrap gap-2 mt-1">
                        {[
                          { result: "tp1_hit", label: "✅ TP1 Hit" },
                          { result: "tp2_hit", label: "🎯 TP2 Hit" },
                          { result: "sl_hit",  label: "❌ SL Hit" },
                          { result: "breakeven", label: "➡️ Breakeven" },
                        ].map(({ result, label }) => (
                          <button
                            key={result}
                            type="button"
                            onClick={() => submitResult(m.trade_id!, result)}
                            className="rounded-xl border border-white/10 px-3 py-1.5 text-[11px] text-white/50 hover:border-[rgba(109,40,217,0.5)] hover:text-white/80 transition"
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="animate-fade-in-fast flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-[rgba(200,162,74,0.5)] shrink-0" />
                  <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/25">
                    Bullion Desk
                  </span>
                </div>
                <div className="pl-3 border-l border-white/[0.06] flex items-center gap-1.5 py-1">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          <div className="px-4 sm:px-6 py-4 border-t border-[color:var(--border)]">
            <div className="flex gap-2 mb-3 items-center overflow-x-auto no-scrollbar">
              {(["deep", "quick", "trade_only"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setAnalysisMode(mode)}
                  className={cn(
                    "rounded-xl border px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] transition shrink-0 min-h-[36px]",
                    analysisMode === mode
                      ? "border-[rgba(109,40,217,0.65)] bg-[rgba(109,40,217,0.14)] text-white"
                      : "border-white/10 text-[color:var(--muted)] hover:border-white/20 hover:text-white/70"
                  )}
                >
                  {mode === "deep" ? "Deep Analysis" : mode === "quick" ? "Quick Brief" : "Trade Only"}
                </button>
              ))}

              <div className="relative group ml-auto hidden sm:flex">
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg cursor-default text-white/20 hover:text-white/40 transition">
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                    <rect x="0.5" y="2.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.1"/>
                    <rect x="2" y="5" width="2" height="1.5" rx="0.4" fill="currentColor"/>
                    <rect x="5" y="5" width="2" height="1.5" rx="0.4" fill="currentColor"/>
                    <rect x="8" y="5" width="2" height="1.5" rx="0.4" fill="currentColor"/>
                    <rect x="3.5" y="7.5" width="5" height="1.5" rx="0.4" fill="currentColor"/>
                  </svg>
                  <span className="text-[10px] font-mono tracking-wide">shortcuts</span>
                </div>
                <div className="absolute bottom-full right-0 mb-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10">
                  <div className="rounded-xl border border-white/10 bg-[rgba(10,8,18,0.97)] shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-3 min-w-[180px]">
                    <div className="text-[10px] font-mono text-white/25 uppercase tracking-widest mb-2">Keyboard Shortcuts</div>
                    {[
                      ["D", "Deep Analysis"],
                      ["Q", "Quick Brief"],
                      ["T", "Trade Only"],
                      ["Enter", "Focus input"],
                      ["Esc", "Clear input"],
                    ].map(([key, label]) => (
                      <div key={key} className="flex items-center justify-between gap-4 py-0.5">
                        <span className="text-[11px] text-white/35">{label}</span>
                        <kbd className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-mono text-white/40">{key}</kbd>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {selectedImagePreview ? (
              <div className="mb-3 flex items-center gap-3 rounded-2xl border border-[rgba(109,40,217,0.25)] bg-[rgba(109,40,217,0.05)] p-3">
                <img
                  src={selectedImagePreview}
                  alt="Selected chart preview"
                  className="h-16 w-24 rounded-lg object-cover border border-white/10"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white/80 truncate">
                      {selectedImage?.name && selectedImage.name !== "image.png" ? selectedImage.name : "Chart attached"}
                    </span>
                    {(!selectedImage?.name || selectedImage.name === "image.png") && (
                      <span className="text-[10px] font-mono uppercase tracking-widest text-[rgba(109,40,217,0.8)] border border-[rgba(109,40,217,0.3)] rounded-md px-1.5 py-0.5 shrink-0">
                        Pasted
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[color:var(--muted)] mt-0.5">
                    Chart ready to send
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearSelectedImage}
                  className="rounded-xl border border-white/10 px-3 py-2 text-xs text-[color:var(--muted)] hover:border-white/20 shrink-0"
                >
                  ✕
                </button>
              </div>
            ) : null}

            <div className="flex gap-3 items-center">
              <div className="relative flex-1">
                {!input && (
                  <span
                    className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-[color:var(--muted)] text-[13px] transition-opacity duration-300 whitespace-nowrap overflow-hidden"
                    style={{ opacity: placeholderVisible ? 1 : 0 }}
                  >
                    {placeholders[placeholderIndex]}
                  </span>
                )}
                <input
                  ref={chatInputRef}
                  className="w-full rounded-2xl px-4 py-3 pr-14 bg-transparent border border-[color:var(--border)] focus:outline-none focus:border-[rgba(109,40,217,0.75)]"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") send(); }}
                />

                <button
                  type="button"
                  onClick={openFilePicker}
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-xl border border-white/10 flex items-center justify-center hover:border-[rgba(109,40,217,0.75)] hover:bg-[rgba(109,40,217,0.10)] transition"
                  title="Attach chart screenshot"
                >
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="text-white/40">
                    <rect x="0.5" y="9.5" width="2" height="5" rx="0.5" fill="currentColor"/>
                    <rect x="3.5" y="6.5" width="2" height="8" rx="0.5" fill="currentColor"/>
                    <rect x="6.5" y="3.5" width="2" height="11" rx="0.5" fill="currentColor"/>
                    <rect x="9.5" y="0.5" width="2" height="14" rx="0.5" fill="currentColor"/>
                    <path d="M1.5 9L4.5 5.5L7.5 7L12 1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleImageChange}
                />
              </div>

              <button
                className={cn(
                  "rounded-2xl px-5 py-3 border transition min-h-[44px] min-w-[64px] text-[14px] sm:text-[13px]",
                  canSend
                    ? "border-[rgba(109,40,217,0.55)] hover:border-[rgba(109,40,217,0.95)] hover:bg-[rgba(109,40,217,0.10)]"
                    : "border-white/10 opacity-50 cursor-not-allowed"
                )}
                onClick={send}
                disabled={!canSend}
              >
                Send
              </button>
            </div>

            <div className="mt-2 flex items-center gap-1.5 text-[12px] sm:text-[11px] text-white/20">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="shrink-0">
                <path d="M2 10V7.5M5 10V4.5M8 10V2M11 10V5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              Attaching your chart is recommended for more accurate signals.
            </div>
            <div className="mt-2 text-[12px] text-[color:var(--muted)]">
              Not investment advice. Trade at your own risk.
            </div>
          </div>
        </div>
      </section>

      <footer className="mt-8 text-xs text-[color:var(--muted)]">
        © {new Date().getFullYear()} Bullion Desk
      </footer>
    </main>
  );
}
