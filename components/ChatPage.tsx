"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

interface TraderProfile {
  prop_firm: string;
  account_size: string;
  challenge_phase: string;
  current_drawdown: string;
  trading_style: string;
}

const PROFILE_KEY = "bulliondesk_trader_profile";
// Bump this key to force the onboarding card to reappear for everyone
// (older "profile_banner_dismissed" flags no longer hide it).
const BANNER_DISMISS_KEY = "profile_banner_dismissed_v2";

const PROP_FIRMS = ["FTMO", "The5ers", "Apex", "E8", "FundedNext", "Blue Guardian", "Alpha Capital", "Other", "None"];
const ACCOUNT_SIZES = ["$10K", "$25K", "$50K", "$100K", "$200K"];
const CHALLENGE_PHASES = ["Phase 1", "Phase 2", "Funded", "Not in a challenge"];
const TRADING_STYLES = ["Scalping", "Day trading", "Swing trading", "Position trading"];

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

  const [selectedImageBase64, setSelectedImageBase64] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);

  const [respondedTradeIds, setRespondedTradeIds] = useState<Set<string>>(new Set());

  const [isStreaming, setIsStreaming] = useState(false);
  const [isTypewriting, setIsTypewriting] = useState(false);

  const [profileOpen, setProfileOpen] = useState(false);
  const [traderProfile, setTraderProfile] = useState<TraderProfile>({
    prop_firm: "",
    account_size: "",
    challenge_phase: "",
    current_drawdown: "",
    trading_style: "",
  });
  const [savedProfile, setSavedProfile] = useState<TraderProfile | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState<boolean | null>(null);

  const typewriterQueueRef     = useRef<string>("");
  const typewriterDisplayedRef = useRef<string>("");
  const typewriterTimerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamingFinishedRef   = useRef<boolean>(false);

  function startTypewriterTimer() {
    if (typewriterTimerRef.current !== null) return;
    setIsTypewriting(true);
    typewriterTimerRef.current = setInterval(() => {
      const queue = typewriterQueueRef.current;
      if (queue.length === 0) {
        if (streamingFinishedRef.current) {
          clearInterval(typewriterTimerRef.current!);
          typewriterTimerRef.current = null;
          setIsTypewriting(false);
        }
        return;
      }
      const wordsPerTick = queue.length > 500 ? 4 : queue.length > 200 ? 2 : 1;
      let chunk = "";
      let remaining = queue;
      for (let i = 0; i < wordsPerTick && remaining.length > 0; i++) {
        const space   = remaining.indexOf(" ");
        const newline = remaining.indexOf("\n");
        let end: number;
        if (space === -1 && newline === -1) end = remaining.length;
        else if (space === -1)              end = newline + 1;
        else if (newline === -1)            end = space + 1;
        else                                end = Math.min(space, newline) + 1;
        chunk    += remaining.slice(0, end);
        remaining = remaining.slice(end);
      }
      typewriterQueueRef.current     = remaining;
      typewriterDisplayedRef.current += chunk;
      const text = typewriterDisplayedRef.current;
      setMessages((m) => {
        const updated = [...m];
        updated[updated.length - 1] = { ...updated[updated.length - 1], content: text };
        return updated;
      });
      scrollToBottom();
    }, 25);
  }

  function flushTypewriterQueue() {
    if (typewriterTimerRef.current !== null) {
      clearInterval(typewriterTimerRef.current);
      typewriterTimerRef.current = null;
    }
    const remaining = typewriterQueueRef.current;
    if (remaining.length > 0) {
      typewriterDisplayedRef.current += remaining;
      typewriterQueueRef.current      = "";
      const text = typewriterDisplayedRef.current;
      setMessages((m) => {
        const updated = [...m];
        updated[updated.length - 1] = { ...updated[updated.length - 1], content: text };
        return updated;
      });
    }
    setIsTypewriting(false);
  }

  const [suggestions, setSuggestions] = useState<string[]>([
    "Should I trade gold right now?",
    "Am I revenge trading?",
    "Review my FTMO drawdown",
    "What's the gold bias today?",
    "Is my position size too large?",
    "Help me pass my prop firm challenge",
  ]);

  function fetchSuggestions() {
    fetch("/api/suggestions")
      .then(r => r.json())
      .then(data => { if (Array.isArray(data.suggestions)) setSuggestions(data.suggestions); })
      .catch(() => {});
  }

  const abortControllerRef = useRef<AbortController | null>(null);

  function stopGeneration() {
    abortControllerRef.current?.abort();
    flushTypewriterQueue();
  }

  const chatContainerRef  = useRef<HTMLDivElement | null>(null);
  const userScrolledUpRef = useRef(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  function attachImageFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setSelectedImageBase64(result);
    };
    reader.readAsDataURL(file);
  }

  const fileInputRef  = useRef<HTMLInputElement | null>(null);
  const chatInputRef  = useRef<HTMLInputElement | null>(null);
  const bottomRef     = useRef<HTMLDivElement | null>(null);

  function scrollToBottom(force = false) {
    const c = chatContainerRef.current;
    if (!c) return;
    if (!force && userScrolledUpRef.current) return;
    c.scrollTo({ top: c.scrollHeight, behavior: "smooth" });
  }

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(PROFILE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as TraderProfile;
        setTraderProfile(parsed);
        setSavedProfile(parsed);
      }
      setBannerDismissed(localStorage.getItem(BANNER_DISMISS_KEY) === "true");
    } catch { /* ignore */ }
  }, []);

  function dismissProfileBanner() {
    try {
      localStorage.setItem(BANNER_DISMISS_KEY, "true");
    } catch { /* ignore */ }
    setBannerDismissed(true);
  }

  useEffect(() => {
    scrollToBottom();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  useEffect(() => {
    const c = chatContainerRef.current;
    if (!c) return;
    function onScroll() {
      if (!c) return;
      const distFromBottom = c.scrollHeight - c.scrollTop - c.clientHeight;
      userScrolledUpRef.current = distFromBottom > 120;
      setShowScrollBtn(distFromBottom > 150);
    }
    c.addEventListener("scroll", onScroll, { passive: true });
    return () => c.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (messages.length === 1) fetchSuggestions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

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

  useEffect(() => {
    async function handlePaste(e: ClipboardEvent) {
      if (e.clipboardData?.items) {
        for (const item of Array.from(e.clipboardData.items)) {
          if (item.kind === "file" && item.type.startsWith("image/")) {
            const file = item.getAsFile();
            if (file) {
              e.preventDefault();
              attachImageFile(file);
              return;
            }
          }
        }
      }
      try {
        const clips = await navigator.clipboard.read();
        for (const clip of clips) {
          for (const type of clip.types) {
            if (type.startsWith("image/")) {
              const blob = await clip.getType(type);
              attachImageFile(new File([blob], "pasted.png", { type }));
              return;
            }
          }
        }
      } catch { /* clipboard API unavailable or no image */ }
    }
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleInputPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    if (!e.clipboardData) return;
    for (const item of Array.from(e.clipboardData.items)) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
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

  function saveProfile() {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(traderProfile));
    setSavedProfile({ ...traderProfile });
    setProfileOpen(false);
  }

  function profileSummary(): string | null {
    if (!savedProfile) return null;
    const parts: string[] = [];
    if (savedProfile.prop_firm && savedProfile.prop_firm !== "None") parts.push(savedProfile.prop_firm);
    if (savedProfile.account_size) parts.push(savedProfile.account_size);
    if (savedProfile.challenge_phase && savedProfile.challenge_phase !== "Not in a challenge") parts.push(savedProfile.challenge_phase);
    if (savedProfile.current_drawdown) parts.push(`DD: ${savedProfile.current_drawdown}`);
    if (savedProfile.trading_style) parts.push(savedProfile.trading_style);
    return parts.length > 0 ? parts.join(" · ") : null;
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
    userScrolledUpRef.current = false;

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

      try {
        const stored = localStorage.getItem(PROFILE_KEY);
        if (stored) {
          const prof = JSON.parse(stored) as TraderProfile;
          if (prof.prop_firm || prof.account_size || prof.challenge_phase || prof.current_drawdown) {
            body.traderProfile = prof;
          }
        }
      } catch { /* non-critical */ }

      abortControllerRef.current = new AbortController();
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: abortControllerRef.current.signal,
      });

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
              if (!messageAdded) {
                typewriterQueueRef.current     = "";
                typewriterDisplayedRef.current = "";
                streamingFinishedRef.current   = false;
                setMessages((m) => [...m, { role: "assistant", content: "" }]);
                messageAdded = true;
                startTypewriterTimer();
              }
              typewriterQueueRef.current += event.text;
            } else if (event.type === "done") {
              streamingFinishedRef.current = true;
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
      fetchSuggestions();

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
      if (err instanceof Error && err.name === "AbortError") {
        flushTypewriterQueue();
        setIsStreaming(false);
        setShowScrollBtn(false);
      } else {
        flushTypewriterQueue();
        console.error("[chat] fetch error:", err);
        const errMsg = err instanceof Error ? err.message : "Unknown error";
        setMessages((m) => [
          ...m,
          { role: "assistant", content: `System error: ${errMsg}` },
        ]);
      }
    } finally {
      if (typewriterTimerRef.current !== null) flushTypewriterQueue();
      setLoading(false);
      setIsStreaming(false);
      abortControllerRef.current = null;
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

  const summary = profileSummary();

  return (
    <motion.div
      initial={{ y: 10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut", delay: 0.15 }}
      className="flex-1 flex flex-col bg-[#0A0A0A] overflow-hidden relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {showOnboarding && (
        <OnboardingModal onComplete={() => setShowOnboarding(false)} />
      )}
      <HistoryPanel open={showHistory} onClose={() => setShowHistory(false)} />

      {/* ── Trading desk header ── */}
      <header className="flex-none bg-white/[0.02] border-b border-white/[0.06] chat-header-enter">
        <div className="max-w-5xl mx-auto px-6 md:px-10 py-3">
          <div className="flex items-center justify-end gap-3">

            {/* Controls */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowHistory(true)}
                className="flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] font-medium text-[#71717A] hover:text-white border border-white/[0.08] rounded-lg px-3 py-1.5 hover:border-white/20 transition-all"
                title="Conversation history"
              >
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.1"/>
                  <path d="M6 3.5V6l2 1.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                History
              </button>
              <button
                type="button"
                onClick={startNewChat}
                className="flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] font-medium text-[#71717A] hover:text-white border border-white/[0.08] rounded-lg px-3 py-1.5 hover:border-white/20 transition-all"
                title="Start new analysis"
              >
                <svg width="10" height="10" viewBox="0 0 11 11" fill="none">
                  <path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                New
              </button>
              <span className="text-[9px] uppercase bg-[#D4A843]/20 text-[#D4A843] px-2 py-0.5 rounded-full font-medium tracking-wide shadow-[0_0_12px_rgba(212,168,67,0.15)]">
                Beta
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Gold gradient line below header */}
      <div className="h-px bg-gradient-to-r from-transparent via-[#D4A843]/30 to-transparent flex-none" />

      {/* ── Quick stats bar ── */}
      <div className="flex-none bg-white/[0.015] border-b border-white/[0.06] px-6 md:px-10 py-2 overflow-x-auto chat-stats-enter">
        <div className="max-w-5xl mx-auto flex items-center gap-3 text-xs font-normal whitespace-nowrap">
          <span className="text-[#D4A843] tracking-wider">XAUUSD</span>
          <span className="w-px h-3 bg-white/10 shrink-0" />
          <span className="flex items-center gap-1.5 text-[#71717A]">
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            Live data connected
          </span>
          <span className="text-white/[0.08]">·</span>
          <span className="text-[#71717A]">Not investment advice · No signals · Trade at your own risk</span>
        </div>
      </div>

      {/* ── Trader profile setup form — opened via banner CTA ── */}
      {profileOpen && (
        <div className="flex-none border-b border-white/[0.06] bg-white/[0.03]">
          <div className="px-6 md:px-10 py-4 profile-content-enter">
            <div className="max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Prop Firm */}
              <div className="flex flex-col gap-1">
                <label className="text-xs uppercase tracking-[0.15em] font-medium text-[#71717A]">Prop Firm</label>
                <select
                  value={traderProfile.prop_firm}
                  onChange={e => setTraderProfile(p => ({ ...p, prop_firm: e.target.value }))}
                  className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:border-[#D4A843]/30 focus:shadow-[0_0_15px_rgba(212,168,67,0.06)] focus:outline-none transition appearance-none cursor-pointer"
                >
                  <option value="" className="bg-[#111]">Select firm…</option>
                  {PROP_FIRMS.map(f => <option key={f} value={f} className="bg-[#111]">{f}</option>)}
                </select>
              </div>

              {/* Account Size */}
              <div className="flex flex-col gap-1">
                <label className="text-xs uppercase tracking-[0.15em] font-medium text-[#71717A]">Account Size</label>
                <select
                  value={traderProfile.account_size}
                  onChange={e => setTraderProfile(p => ({ ...p, account_size: e.target.value }))}
                  className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:border-[#D4A843]/30 focus:shadow-[0_0_15px_rgba(212,168,67,0.06)] focus:outline-none transition appearance-none cursor-pointer"
                >
                  <option value="" className="bg-[#111]">Select size…</option>
                  {ACCOUNT_SIZES.map(s => <option key={s} value={s} className="bg-[#111]">{s}</option>)}
                </select>
              </div>

              {/* Challenge Phase */}
              <div className="flex flex-col gap-1">
                <label className="text-xs uppercase tracking-[0.15em] font-medium text-[#71717A]">Challenge Phase</label>
                <select
                  value={traderProfile.challenge_phase}
                  onChange={e => setTraderProfile(p => ({ ...p, challenge_phase: e.target.value }))}
                  className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:border-[#D4A843]/30 focus:shadow-[0_0_15px_rgba(212,168,67,0.06)] focus:outline-none transition appearance-none cursor-pointer"
                >
                  <option value="" className="bg-[#111]">Select phase…</option>
                  {CHALLENGE_PHASES.map(ph => <option key={ph} value={ph} className="bg-[#111]">{ph}</option>)}
                </select>
              </div>

              {/* Max Drawdown */}
              <div className="flex flex-col gap-1">
                <label className="text-xs uppercase tracking-[0.15em] font-medium text-[#71717A]">Max Drawdown %</label>
                <input
                  type="text"
                  placeholder="e.g. 2.5%"
                  value={traderProfile.current_drawdown}
                  onChange={e => setTraderProfile(p => ({ ...p, current_drawdown: e.target.value }))}
                  className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-[#525252] focus:border-[#D4A843]/30 focus:shadow-[0_0_15px_rgba(212,168,67,0.06)] focus:outline-none transition"
                />
              </div>

              {/* Trading Style */}
              <div className="flex flex-col gap-1">
                <label className="text-xs uppercase tracking-[0.15em] font-medium text-[#71717A]">Trading Style</label>
                <select
                  value={traderProfile.trading_style}
                  onChange={e => setTraderProfile(p => ({ ...p, trading_style: e.target.value }))}
                  className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:border-[#D4A843]/30 focus:shadow-[0_0_15px_rgba(212,168,67,0.06)] focus:outline-none transition appearance-none cursor-pointer"
                >
                  <option value="" className="bg-[#111]">Select style…</option>
                  {TRADING_STYLES.map(t => <option key={t} value={t} className="bg-[#111]">{t}</option>)}
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={saveProfile}
              className="mt-3 flex items-center gap-2 rounded-lg border border-[#D4A843]/30 bg-[#D4A843]/[0.08] px-4 py-2 text-xs text-[#D4A843] hover:bg-[#D4A843]/[0.14] hover:shadow-[0_0_20px_rgba(212,168,67,0.2)] transition"
            >
              Save profile
            </button>
          </div>
        </div>
      )}

      {/* ── Trader profile banner — unmissable onboarding nudge ── */}
      <AnimatePresence>
        {bannerDismissed !== true && !summary && !profileOpen && (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="flex-none mx-4 md:mx-6 mt-3 shrink-0"
          >
            <div
              className="px-5 py-4 sm:px-6 sm:py-5 flex items-start justify-between gap-4 rounded-2xl"
              style={{
                background: "rgba(255,255,255,0.03)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                border: "1px solid transparent",
                borderImage: "linear-gradient(to right, #7B4FD4, #D4A843) 1",
              }}
            >
              <div className="flex items-start gap-4">
                {/* Gold shield icon */}
                <div
                  className="shrink-0 h-11 w-11 flex items-center justify-center rounded-xl"
                  style={{
                    background: "rgba(212,168,67,0.10)",
                    border: "1px solid rgba(212,168,67,0.30)",
                    boxShadow: "0 0 20px rgba(212,168,67,0.12)",
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 2.5l7 2.8v5.2c0 4.4-3 8.2-7 9.5-4-1.3-7-5.1-7-9.5V5.3l7-2.8z"
                      stroke="#D4A843"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M9 12l2 2 4-4.5"
                      stroke="#D4A843"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-base sm:text-lg font-semibold text-white mb-1">
                    Complete your trader profile
                  </p>
                  <p className="text-sm text-white/50 max-w-md mb-3">
                    Tell BullionDesk your prop firm, account size, and trading style. Your AI coach adapts to you.
                  </p>
                  <button
                    type="button"
                    onClick={() => setProfileOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-black transition hover:shadow-[0_0_24px_rgba(212,168,67,0.4)] hover:brightness-105"
                    style={{ background: "#D4A843" }}
                  >
                    Set up now →
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={dismissProfileBanner}
                aria-label="Dismiss"
                className="shrink-0 h-8 w-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white/70 hover:bg-white/10 transition"
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Messages area ── */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto relative"
      >
        {/* Fade gradient at top — messages scroll under this */}
        <div className="sticky top-0 left-0 right-0 h-10 bg-gradient-to-b from-[#0A0A0A] to-transparent pointer-events-none z-10" />

        {/* Empty state */}
        {messages.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 pb-4 empty-state-enter">
            {/* Pulsing gold chart icon */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="relative mb-5 flex items-center justify-center"
            >
              <span className="absolute h-16 w-16 rounded-full bg-[#D4A843]/10 animate-ping" />
              <div
                className="relative h-14 w-14 rounded-full flex items-center justify-center"
                style={{ background: "rgba(212,168,67,0.08)", border: "1px solid rgba(212,168,67,0.30)" }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M3 16l5-6 4 3 6-8" stroke="#D4A843" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M3 21h18" stroke="rgba(123,79,212,0.7)" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </div>
            </motion.div>

            <p className="text-xl font-medium text-white mb-2 text-center">
              Before your next trade.
            </p>
            <p className="text-sm text-white/40 mb-8 text-center">
              Let&apos;s check the full picture on XAUUSD.
            </p>
            <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
              {suggestions.map((s, i) => (
                <motion.button
                  key={s}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05, ease: "easeOut" }}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-xl px-4 py-3 text-sm text-[#A1A1AA] hover:text-white cursor-pointer text-left backdrop-blur-xl transition-all duration-300 bg-[rgba(123,79,212,0.10)] border border-[rgba(123,79,212,0.30)] hover:bg-[rgba(123,79,212,0.20)] hover:border-[rgba(123,79,212,0.5)] hover:shadow-[0_0_20px_rgba(123,79,212,0.25)]"
                >
                  {s}
                </motion.button>
              ))}
            </div>
            <p className="text-xs font-mono text-white/20 mt-6 text-center">
              Powered by institutional-grade analysis · 22 data sources
            </p>
          </div>
        )}

        {/* Messages */}
        {messages.length > 0 && (
          <div className="py-6 px-6 md:px-16 lg:px-24">
            <div className="max-w-3xl mx-auto">
              {messages.map((m, i) => (
                <div key={i} className="mb-8">
                  {m.role === "user" ? (
                    <motion.div
                      initial={{ x: 20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      className="flex justify-end"
                    >
                      <div
                        className="max-w-[75%] px-5 py-3 text-white"
                        style={{
                          background: "linear-gradient(135deg, #7B4FD4 20%, #5a35a8)",
                          borderRadius: "18px 18px 4px 18px",
                          boxShadow: "0 4px 20px rgba(123,79,212,0.3)",
                        }}
                      >
                        {m.imagePreview && (
                          <div className="mb-2">
                            <img
                              src={m.imagePreview}
                              alt="Attached chart"
                              className="max-h-48 rounded-xl border border-white/10"
                            />
                          </div>
                        )}
                        <p className="font-sans text-sm font-normal break-words">
                          {m.content}
                        </p>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                    >
                      <p className="text-xs uppercase tracking-[0.15em] font-medium text-[#D4A843]/60 mb-2">
                        BullionDesk
                      </p>
                      <div
                        className="max-w-[85%] px-5 py-4"
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderTop: "2px solid rgba(212,168,67,0.3)",
                          borderRadius: "18px 18px 18px 4px",
                        }}
                      >
                        <div className="font-sans text-[15px] leading-[1.75] tracking-normal font-normal text-[#E8E8E8]">
                          <MarkdownMessage content={m.content} />
                          {(isStreaming || isTypewriting) && i === messages.length - 1 && m.role === "assistant" && (
                            <span className="typing-cursor" />
                          )}
                        </div>
                      </div>
                      <div className="mt-2">
                        <ShareSignalButton text={m.content} />
                      </div>
                      {!loading && !isStreaming && i === messages.length - 1 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 max-w-lg">
                          {suggestions.map((suggestion, si) => (
                            <motion.button
                              key={suggestion}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.3, delay: si * 0.05, ease: "easeOut" }}
                              type="button"
                              onClick={() => send(suggestion)}
                              className="rounded-xl px-4 py-3 text-sm text-[#A1A1AA] hover:text-white cursor-pointer text-left backdrop-blur-xl transition-all duration-300 bg-[rgba(123,79,212,0.10)] border border-[rgba(123,79,212,0.30)] hover:bg-[rgba(123,79,212,0.20)] hover:border-[rgba(123,79,212,0.5)] hover:shadow-[0_0_20px_rgba(123,79,212,0.25)]"
                            >
                              {suggestion}
                            </motion.button>
                          ))}
                        </div>
                      )}
                      {m.trade_id && !respondedTradeIds.has(m.trade_id) && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {[
                            { result: "tp1_hit",   label: "✅ TP1 Hit" },
                            { result: "tp2_hit",   label: "🎯 TP2 Hit" },
                            { result: "sl_hit",    label: "❌ SL Hit" },
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
                    </motion.div>
                  )}
                </div>
              ))}

              {/* Loading dots */}
              {loading && !isStreaming && (
                <motion.div
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="mb-8"
                >
                  <p className="text-xs uppercase tracking-[0.15em] font-medium text-[#D4A843]/60 mb-2">
                    BullionDesk
                  </p>
                  <div
                    className="flex items-center gap-1.5 px-5 py-3.5 max-w-[85%]"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: "18px 18px 18px 4px",
                    }}
                  >
                    {[0, 0.2, 0.4].map((delay) => (
                      <span
                        key={delay}
                        className="w-1.5 h-1.5 rounded-full bg-[#D4A843]"
                        style={{ animation: "dot-bounce 1.2s ease-in-out infinite", animationDelay: `${delay}s` }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              <div ref={bottomRef} />
            </div>
          </div>
        )}

        {/* Scroll-to-bottom button */}
        {showScrollBtn && (
          <div className="sticky bottom-4 flex justify-center pointer-events-none">
            <button
              type="button"
              onClick={() => scrollToBottom(true)}
              className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-[rgba(212,175,55,0.35)] bg-[rgba(7,6,11,0.85)] backdrop-blur-sm px-3 py-1.5 text-[11px] text-[rgba(212,175,55,0.8)] hover:border-[rgba(212,175,55,0.7)] hover:text-[rgba(212,175,55,1)] transition shadow-[0_4px_20px_rgba(0,0,0,0.4)]"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Scroll to bottom
            </button>
          </div>
        )}
      </div>

      {/* ── Stop generating ── */}
      {isStreaming && (
        <div className="flex-none flex justify-center py-2 border-t border-white/[0.06] bg-[#0A0A0A]">
          <button
            type="button"
            onClick={stopGeneration}
            className="flex items-center gap-2 rounded-xl border border-white/[0.08] px-4 py-1.5 text-[11px] uppercase tracking-[0.08em] text-white/40 hover:border-red-500/30 hover:text-red-400/75 transition"
          >
            <span className="h-2 w-2 rounded-sm bg-current shrink-0" />
            Stop generating
          </button>
        </div>
      )}

      {/* Gold gradient line above input */}
      <div className="h-px bg-gradient-to-r from-transparent via-[#D4A843]/20 to-transparent flex-none" />

      {/* ── Input area ── */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut", delay: 0.3 }}
        className={cn(
          "flex-none bg-[#0A0A0A] px-6 md:px-16 lg:px-24 py-4 transition",
          isDragging && "bg-[rgba(109,40,217,0.04)]"
        )}
      >
        <div className="max-w-3xl mx-auto">

          {/* Image preview */}
          {selectedImageBase64 && (
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
              </div>
              <button
                type="button"
                onClick={clearSelectedImage}
                className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/40 hover:border-white/20 shrink-0 transition"
              >
                ✕
              </button>
            </div>
          )}

          {/* Input row */}
          <div className="relative flex items-center">
            {/* Radial focus glow */}
            {inputFocused && (
              <div
                className="absolute inset-0 pointer-events-none -mx-6 rounded-2xl"
                style={{
                  background: "radial-gradient(ellipse 400px 80px at center, rgba(212,168,67,0.02) 0%, transparent 70%)",
                }}
              />
            )}
            <input
              ref={chatInputRef}
              className="w-full min-h-[52px] bg-white/[0.05] border border-white/10 rounded-2xl px-5 py-3.5 text-white text-sm placeholder-[#525252] backdrop-blur focus:border-[rgba(212,168,67,0.5)] focus:shadow-[0_0_0_2px_rgba(212,168,67,0.15)] focus:outline-none transition pr-24"
              placeholder="Ask your AI gold coach anything..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(); }}
              onPaste={handleInputPaste}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
            />

            {/* Attach chart button — turns gold when there's input */}
            <button
              type="button"
              onClick={openFilePicker}
              className={cn(
                "absolute right-12 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center transition",
                input.trim() || selectedImageBase64
                  ? "text-[#D4A843]"
                  : "text-white/25 hover:text-white/50"
              )}
              title="Attach chart screenshot"
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <rect x="0.5" y="9.5" width="2" height="5" rx="0.5" fill="currentColor"/>
                <rect x="3.5" y="6.5" width="2" height="8" rx="0.5" fill="currentColor"/>
                <rect x="6.5" y="3.5" width="2" height="11" rx="0.5" fill="currentColor"/>
                <rect x="9.5" y="0.5" width="2" height="14" rx="0.5" fill="currentColor"/>
                <path d="M1.5 9L4.5 5.5L7.5 7L12 1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {/* Send button */}
            {canSend && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={() => send()}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 transition hover:brightness-105 hover:shadow-[0_0_18px_rgba(212,168,67,0.4)]"
                style={{ background: "#D4A843" }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-white">
                  <path d="M7 11V3M3 7L7 3L11 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </motion.button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleImageChange}
            />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
