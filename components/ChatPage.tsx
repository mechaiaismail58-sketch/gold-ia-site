"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import LiveTicker from "@/components/LiveTicker";
import MarketDashboard from "@/components/MarketDashboard";
import TradeTracker from "@/components/TradeTracker";
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

  // Base64 dataURL — used both as preview and as payload sent to the API
  const [selectedImageBase64, setSelectedImageBase64] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [respondedTradeIds, setRespondedTradeIds] = useState<Set<string>>(new Set());

  const [isStreaming, setIsStreaming] = useState(false);

  // Smart scroll
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  function attachImageFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      console.log("[chat] image attached via FileReader, size:", result.length, "type:", file.type);
      setSelectedImageBase64(result);
    };
    reader.readAsDataURL(file);
  }

  const PLACEHOLDER_TEXT = "Analyse XAUUSD";

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatInputRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Smart scroll — only scroll if already near the bottom
  function scrollToBottom(force = false) {
    const c = chatContainerRef.current;
    if (!c) return;
    const distFromBottom = c.scrollHeight - c.scrollTop - c.clientHeight;
    if (force || distFromBottom < 150) {
      c.scrollTo({ top: c.scrollHeight, behavior: "smooth" });
    }
  }

  useEffect(() => {
    scrollToBottom();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // Show scroll-to-bottom button when user scrolled up and streaming is active
  useEffect(() => {
    const c = chatContainerRef.current;
    if (!c) return;
    function onScroll() {
      if (!c) return;
      const distFromBottom = c.scrollHeight - c.scrollTop - c.clientHeight;
      setShowScrollBtn(distFromBottom > 150 && isStreaming);
    }
    c.addEventListener("scroll", onScroll, { passive: true });
    return () => c.removeEventListener("scroll", onScroll);
  }, [isStreaming]);

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

      if (e.key === "Enter") chatInputRef.current?.focus();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [setAnalysisMode]);

  // Clipboard paste — document-level listener catches paste anywhere on the page
  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      console.log("[chat] paste event fired, items:", e.clipboardData?.items?.length ?? 0);
      if (!e.clipboardData) return;
      for (const item of Array.from(e.clipboardData.items)) {
        console.log("[chat] clipboard item type:", item.type);
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (!file) continue;
          e.preventDefault();
          attachImageFile(file);
          return;
        }
      }
    }
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Also on the input element directly so the event is caught even if React intercepts it first
  function handleInputPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    console.log("[chat] input onPaste fired, items:", e.clipboardData?.items?.length ?? 0);
    if (!e.clipboardData) return;
    for (const item of Array.from(e.clipboardData.items)) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (!file) continue;
        e.preventDefault();
        attachImageFile(file);
        return;
      }
    }
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) attachImageFile(file);
  }

  const canSend = useMemo(() => {
    return (!loading && input.trim().length > 0) || (!loading && !!selectedImageBase64);
  }, [input, loading, selectedImageBase64]);

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file || !file.type.startsWith("image/")) return;
    attachImageFile(file);
  }

  function clearSelectedImage() {
    setSelectedImageBase64(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function getSuggestions(content: string): string[] {
    if (content.includes(":::notrade") || /\bNO[- ]TRADE\b/i.test(content)) {
      return ["Check back later", "What-if scenario", "Quick update"];
    }
    if (content.includes(":::trade")) {
      return ["Manage position", "Risk sizing", "What if it reverses?"];
    }
    if (content.length > 600) {
      return ["Give me a trade", "Quick summary", "Key level to watch"];
    }
    return ["Full analysis", "Quick update", "Trade setup"];
  }

  async function send(textOverride?: string) {
    const isSuggestion = textOverride !== undefined;
    const userText = isSuggestion ? textOverride.trim() : input.trim();
    const imageBase64ToSend = isSuggestion ? null : selectedImageBase64;

    if (isSuggestion) {
      if (!userText || loading) return;
    } else {
      if (!canSend) return;
    }

    if (!isSuggestion) {
      setInput("");
      setSelectedImageBase64(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }

    setLoading(true);

    setMessages((m) => [
      ...m,
      {
        role: "user",
        content: userText || "[Chart image attached]",
        imagePreview: imageBase64ToSend ?? undefined,
      },
    ]);

    try {
      const body: Record<string, unknown> = {
        userMessage: userText,
        analysis_mode: "deep",
        session_id: sessionId,
      };
      if (previousResponseId) body.previous_response_id = previousResponseId;
      if (imageBase64ToSend) body.chartImageBase64 = imageBase64ToSend;

      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      // Pre-stream error (JSON response)
      if (!r.ok) {
        const text = await r.text();
        let errorMsg = `Request failed (${r.status})`;
        try {
          const data = JSON.parse(text);
          const stepsInfo = data?.steps?.length ? `\n\nTiming: ${data.steps.join(" → ")}` : "";
          errorMsg = (data?.error || errorMsg) + stepsInfo;
        } catch { /* not JSON */ }
        throw new Error(errorMsg);
      }

      if (!r.body) throw new Error("No response body");

      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let messageAdded = false;
      let tradeId: string | null = null;
      let streamResponseId: string | null = null;
      let buffer = "";

      setIsStreaming(true);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(part.slice(6));
            if (event.type === "delta") {
              fullText += event.text;

              if (fullText) {
                if (!messageAdded) {
                  setMessages((m) => [...m, { role: "assistant", content: fullText }]);
                  messageAdded = true;
                } else {
                  setMessages((m) => {
                    const updated = [...m];
                    updated[updated.length - 1] = { ...updated[updated.length - 1], content: fullText };
                    return updated;
                  });
                }
                scrollToBottom();
              }
            } else if (event.type === "done") {
              tradeId = event.trade_id ?? event.pending_trade_id ?? null;
              streamResponseId = event.response_id ?? null;
            } else if (event.type === "error") {
              throw new Error(event.error);
            }
          } catch (parseErr) {
            if (parseErr instanceof SyntaxError) continue;
            throw parseErr;
          }
        }
      }

      setIsStreaming(false);
      setShowScrollBtn(false);

      // Update with trade_id metadata
      if (tradeId && messageAdded) {
        setMessages((m) => {
          const updated = [...m];
          updated[updated.length - 1] = { ...updated[updated.length - 1], trade_id: tradeId };
          return updated;
        });
      }

      if (!messageAdded) {
        setMessages((m) => [...m, { role: "assistant", content: "No response generated — please retry." }]);
      }

      if (streamResponseId) setPreviousResponseId(streamResponseId);

      if (fullText) {
        saveConversation({
          session_id: sessionId,
          mode: analysisMode,
          message_user: userText || "[Chart image attached]",
          message_ia: fullText,
          image_attached: Boolean(imageBase64ToSend),
        }).catch(() => {});
      }
    } catch (err) {
      console.error("[chat] fetch error:", err);
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `System error: ${errMsg}` },
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

      <div className="mt-3">
        <MarketDashboard />
      </div>

      <TradeTracker />

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

          <div
            ref={chatContainerRef}
            className="px-4 sm:px-6 py-6 h-[calc(100svh-380px)] min-h-[320px] sm:h-[560px] overflow-y-auto flex flex-col gap-6 relative"
          >
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
                      {isStreaming && i === messages.length - 1 && m.role === "assistant" && (
                        <span className="typing-cursor" />
                      )}
                    </div>
                    <div className="pl-3">
                      <ShareSignalButton text={m.content} />
                    </div>
                    {!loading && !isStreaming && i === messages.length - 1 && (
                      <div className="pl-3 flex flex-wrap gap-2 mt-1">
                        {getSuggestions(m.content).map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => send(suggestion)}
                            style={{
                              padding: "6px 14px",
                              borderRadius: "16px",
                              border: "0.5px solid rgba(212,175,55,0.12)",
                              fontSize: "11px",
                              fontFamily: "var(--font-mono, monospace)",
                              color: "rgba(255,255,255,0.35)",
                              background: "transparent",
                              cursor: "pointer",
                              transition: "border-color 0.15s, color 0.15s",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = "rgba(212,175,55,0.4)";
                              e.currentTarget.style.color = "rgba(212,175,55,0.8)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = "rgba(212,175,55,0.12)";
                              e.currentTarget.style.color = "rgba(255,255,255,0.35)";
                            }}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
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

            {loading && !isStreaming && (
              <div className="animate-fade-in-fast flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-[rgba(200,162,74,0.5)] shrink-0" />
                  <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/25">
                    Bullion Desk
                  </span>
                </div>
                <div className="pl-3 border-l border-white/[0.06] flex items-center gap-2 py-1">
                  <span
                    style={{
                      width: "6px", height: "6px", borderRadius: "50%", background: "#D4AF37", flexShrink: 0,
                      animation: "goldPulse 1.2s ease-in-out infinite",
                    }}
                  />
                  <span className="text-[11px] font-mono tracking-wide text-white/25">Analyzing...</span>
                </div>
              </div>
            )}

            {showScrollBtn && (
              <button
                type="button"
                onClick={() => scrollToBottom(true)}
                className="sticky bottom-2 self-center rounded-full border border-[rgba(212,175,55,0.35)] bg-[rgba(7,6,11,0.85)] backdrop-blur-sm px-3 py-1.5 text-[11px] text-[rgba(212,175,55,0.8)] hover:border-[rgba(212,175,55,0.7)] hover:text-[rgba(212,175,55,1)] transition flex items-center gap-1.5 shadow-[0_4px_20px_rgba(0,0,0,0.4)]"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Scroll to bottom
              </button>
            )}
            <div ref={bottomRef} />
          </div>

          <div
            className={cn(
              "px-4 sm:px-6 py-4 border-t border-[color:var(--border)] transition",
              isDragging && "bg-[rgba(109,40,217,0.06)] border-t-[rgba(109,40,217,0.4)]"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {selectedImageBase64 ? (
              <div className="mb-3 flex items-center gap-3 rounded-2xl border border-[rgba(109,40,217,0.25)] bg-[rgba(109,40,217,0.05)] p-3">
                <img
                  src={selectedImageBase64}
                  alt="Selected chart preview"
                  className="h-16 w-24 rounded-lg object-cover border border-white/10"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white/80 truncate">Chart attached</span>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[rgba(109,40,217,0.8)] border border-[rgba(109,40,217,0.3)] rounded-md px-1.5 py-0.5 shrink-0">
                        Ready
                      </span>
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
                    className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-[color:var(--muted)] text-[13px] whitespace-nowrap overflow-hidden"
                  >
                    {PLACEHOLDER_TEXT}
                  </span>
                )}
                <input
                  ref={chatInputRef}
                  className="w-full rounded-2xl px-4 py-3 pr-14 bg-transparent border border-[color:var(--border)] focus:outline-none focus:border-[rgba(109,40,217,0.75)]"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") send(); }}
                  onPaste={handleInputPaste}
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
                onClick={() => send()}
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
