"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import OnboardingModal from "@/components/OnboardingModal";
import ShareSignalButton from "@/components/ShareSignalButton";
import HistoryPanel from "@/components/HistoryPanel";
import MarkdownMessage from "@/components/MarkdownMessage";
import { useChatContext } from "@/context/ChatContext";
import GradientText from "@/components/ui/reactbits/GradientText";
import ShinyText from "@/components/ui/reactbits/ShinyText";

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
  max_drawdown: string;
  trading_style: string;
}

const PROFILE_KEY = "bulliondesk_trader_profile";
const BANNER_DISMISS_KEY = "profile_banner_dismissed_v2";

const PROP_FIRMS = ["FTMO", "The5ers", "Apex", "E8", "FundedNext", "Blue Guardian", "Alpha Capital"];
const TRADING_STYLES = ["Scalper", "Day Trader", "Swing Trader"];

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
    max_drawdown: "",
    trading_style: "",
  });
  const [savingProfile, setSavingProfile] = useState(false);
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

    fetch("/api/trader-profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const p = data?.profile;
        if (!p) return;
        const hasTraderFields = p.prop_firm || p.max_drawdown != null;
        if (!hasTraderFields) return;
        const merged: TraderProfile = {
          prop_firm: p.prop_firm ?? "",
          account_size: p.account_size != null ? String(p.account_size) : "",
          max_drawdown: p.max_drawdown != null ? String(p.max_drawdown) : "",
          trading_style: p.trading_style ?? "",
        };
        setTraderProfile(merged);
        setSavedProfile(merged);
        try { localStorage.setItem(PROFILE_KEY, JSON.stringify(merged)); } catch { /* ignore */ }
      })
      .catch(() => {});
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

  async function saveProfile() {
    const snapshot = { ...traderProfile };
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(snapshot)); } catch { /* ignore */ }
    setSavedProfile(snapshot);
    setProfileOpen(false);
    setSavingProfile(true);
    try {
      await fetch("/api/trader-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot),
      });
    } catch (err) {
      console.error("[saveProfile]", err);
    } finally {
      setSavingProfile(false);
    }
  }

  function profileSummary(): string | null {
    if (!savedProfile) return null;
    const parts: string[] = [];
    if (savedProfile.prop_firm) parts.push(savedProfile.prop_firm);
    if (savedProfile.account_size) parts.push(formatAccountSize(savedProfile.account_size));
    if (savedProfile.max_drawdown) parts.push(`${savedProfile.max_drawdown}% max DD`);
    if (savedProfile.trading_style) parts.push(savedProfile.trading_style);
    return parts.length > 0 ? parts.join(" · ") : null;
  }

  function formatAccountSize(v: string): string {
    const n = Number(String(v).replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(n) || n <= 0) return v;
    if (n >= 1000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
    return `$${n}`;
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
          if (prof.prop_firm || prof.account_size || prof.max_drawdown || prof.trading_style) {
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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="flex-1 flex flex-col overflow-hidden relative"
      style={{
        background: `
          radial-gradient(ellipse 80% 50% at 50% 0%, rgba(124, 58, 237, 0.15) 0%, transparent 60%),
          radial-gradient(ellipse 60% 40% at 80% 100%, rgba(124, 58, 237, 0.08) 0%, transparent 50%),
          transparent`,
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {showOnboarding && (
        <OnboardingModal onComplete={() => setShowOnboarding(false)} />
      )}
      <HistoryPanel open={showHistory} onClose={() => setShowHistory(false)} />

      {/* ── Trader profile modal ── */}
      <AnimatePresence>
        {profileOpen && (
          <motion.div
            key="profile-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
            onClick={() => setProfileOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 5 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-lg rounded-3xl p-7 sm:p-8"
              style={{
                background: "rgba(16,14,24,0.92)",
                backdropFilter: "blur(40px)",
                WebkitBackdropFilter: "blur(40px)",
                border: "1px solid rgba(255,255,255,0.06)",
                boxShadow: "0 32px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.03) inset",
              }}
            >
              <button
                type="button"
                onClick={() => setProfileOpen(false)}
                aria-label="Close"
                className="absolute right-5 top-5 h-8 w-8 flex items-center justify-center rounded-full text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>

              <h2 className="text-lg font-semibold text-white mb-1 tracking-tight">Your Trading Profile</h2>
              <p className="text-sm text-white/35 mb-7">
                Your AI coach adapts every analysis to these constraints.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Prop Firm */}
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] uppercase tracking-[0.12em] font-medium text-white/25">Prop Firm</label>
                  <select
                    value={traderProfile.prop_firm}
                    onChange={(e) => setTraderProfile((p) => ({ ...p, prop_firm: e.target.value }))}
                    className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-3.5 py-3 text-sm text-white focus:border-[#D4A843]/40 focus:ring-1 focus:ring-[#D4A843]/20 focus:outline-none transition appearance-none cursor-pointer"
                  >
                    <option value="" className="bg-[#111]">Select firm…</option>
                    {PROP_FIRMS.map((f) => <option key={f} value={f} className="bg-[#111]">{f}</option>)}
                  </select>
                </div>

                {/* Account Size */}
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] uppercase tracking-[0.12em] font-medium text-white/25">Account Size</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-white/25 pointer-events-none">$</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="100000"
                      value={traderProfile.account_size}
                      onChange={(e) => setTraderProfile((p) => ({ ...p, account_size: e.target.value }))}
                      className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl pl-7 pr-3.5 py-3 text-sm text-white placeholder-white/15 focus:border-[#D4A843]/40 focus:ring-1 focus:ring-[#D4A843]/20 focus:outline-none transition"
                    />
                  </div>
                </div>

                {/* Max Drawdown */}
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] uppercase tracking-[0.12em] font-medium text-white/25">Max Drawdown %</label>
                  <div className="relative">
                    <input
                      type="number"
                      inputMode="decimal"
                      placeholder="5"
                      value={traderProfile.max_drawdown}
                      onChange={(e) => setTraderProfile((p) => ({ ...p, max_drawdown: e.target.value }))}
                      className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-3.5 py-3 text-sm text-white placeholder-white/15 focus:border-[#D4A843]/40 focus:ring-1 focus:ring-[#D4A843]/20 focus:outline-none transition"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-white/25 pointer-events-none">%</span>
                  </div>
                </div>

                {/* Trading Style */}
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] uppercase tracking-[0.12em] font-medium text-white/25">Trading Style</label>
                  <select
                    value={traderProfile.trading_style}
                    onChange={(e) => setTraderProfile((p) => ({ ...p, trading_style: e.target.value }))}
                    className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-3.5 py-3 text-sm text-white focus:border-[#D4A843]/40 focus:ring-1 focus:ring-[#D4A843]/20 focus:outline-none transition appearance-none cursor-pointer"
                  >
                    <option value="" className="bg-[#111]">Select style…</option>
                    {TRADING_STYLES.map((t) => <option key={t} value={t} className="bg-[#111]">{t}</option>)}
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={saveProfile}
                disabled={savingProfile}
                className="mt-7 w-full rounded-2xl px-4 py-3.5 text-sm font-semibold text-black transition-all duration-200 hover:shadow-[0_0_30px_rgba(212,168,67,0.35)] disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #D4A843, #E8C76A)" }}
              >
                {savingProfile ? "Saving…" : "Save Profile"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Minimal top controls ── */}
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
        className="flex-none px-6 md:px-10 py-3"
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          {/* Status pill */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-white/30">
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
              </span>
              <GradientText colors={["#7C3AED", "#D4A843", "#7C3AED"]} animationSpeed={4} className="font-medium tracking-wide"><span>XAUUSD</span></GradientText>
              <span className="text-white/10">·</span>
              <span className="text-white/25">22 sources</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowHistory(true)}
              className="flex items-center gap-1.5 text-[11px] font-medium text-white/25 hover:text-white/60 rounded-lg px-2.5 py-1.5 hover:bg-white/[0.04] transition-all"
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
              className="flex items-center gap-1.5 text-[11px] font-medium text-white/25 hover:text-white/60 rounded-lg px-2.5 py-1.5 hover:bg-white/[0.04] transition-all"
              title="Start new analysis"
            >
              <svg width="10" height="10" viewBox="0 0 11 11" fill="none">
                <path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              New
            </button>
          </div>
        </div>
      </motion.header>

      {/* Header divider */}
      <div
        className="flex-none h-px"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(124, 58, 237, 0.3), rgba(212, 168, 67, 0.2), rgba(124, 58, 237, 0.3), transparent)",
        }}
      />

      {/* ── Compact trader profile badge ── */}
      {summary && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="flex-none px-6 md:px-10 py-2"
        >
          <div className="max-w-4xl mx-auto">
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              title="Edit trading profile"
              className="inline-flex items-center gap-2 text-[11px] font-mono text-white/20 hover:text-white/45 transition group"
            >
              <span className="h-1 w-1 rounded-full bg-[#D4A843]/50 group-hover:bg-[#D4A843] transition shrink-0" />
              {summary}
              <span className="text-white/10 group-hover:text-white/25 transition">Edit</span>
            </button>
          </div>
        </motion.div>
      )}

      {/* ── Trader profile banner ── */}
      <AnimatePresence>
        {bannerDismissed !== true && !summary && !profileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="flex-none mx-6 md:mx-10 mt-2 shrink-0"
          >
            <div className="max-w-4xl mx-auto">
              <div
                className="px-5 py-4 flex items-center justify-between gap-4 rounded-2xl"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="shrink-0 h-10 w-10 flex items-center justify-center rounded-xl"
                    style={{
                      background: "rgba(212,168,67,0.08)",
                      border: "1px solid rgba(212,168,67,0.15)",
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M12 2.5l7 2.8v5.2c0 4.4-3 8.2-7 9.5-4-1.3-7-5.1-7-9.5V5.3l7-2.8z" stroke="#D4A843" strokeWidth="1.4" strokeLinejoin="round"/>
                      <path d="M9 12l2 2 4-4.5" stroke="#D4A843" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white/80 mb-0.5">Set up your trader profile</p>
                    <p className="text-xs text-white/30">Your AI coach adapts to your prop firm, account size, and style.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setProfileOpen(true)}
                    className="rounded-xl px-4 py-2 text-xs font-semibold text-black/90 transition-all hover:shadow-[0_0_20px_rgba(212,168,67,0.3)]"
                    style={{ background: "linear-gradient(135deg, #D4A843, #E8C76A)" }}
                  >
                    Set up
                  </button>
                  <button
                    type="button"
                    onClick={dismissProfileBanner}
                    aria-label="Dismiss"
                    className="h-8 w-8 flex items-center justify-center rounded-lg text-white/20 hover:text-white/50 hover:bg-white/[0.04] transition"
                  >
                    <svg width="10" height="10" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Messages area ── */}
      <div
        ref={chatContainerRef}
        data-lenis-prevent
        className="flex-1 overflow-y-auto relative"
      >
        {/* Top fade */}
        <div className="sticky top-0 left-0 right-0 h-12 bg-gradient-to-b from-[#07060D] to-transparent pointer-events-none z-10" />

        {/* Empty state */}
        {messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
            className="absolute inset-0 flex flex-col items-center justify-center px-6"
          >
            {/* ── Animated hero emblem ── */}
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
              className="mb-10 relative flex items-center justify-center"
              style={{ width: "140px", height: "140px" }}
            >
              {/* Layer 1 — Large purple ambient glow */}
              <div className="absolute inset-0 rounded-full hero-emblem-glow" style={{ background: "radial-gradient(circle, rgba(123,79,212,0.15) 0%, rgba(123,79,212,0.04) 40%, transparent 70%)" }} />

              {/* Layer 2 — Rotating outer ring */}
              <div className="absolute inset-2 hero-ring-spin">
                <svg viewBox="0 0 120 120" className="w-full h-full">
                  <defs>
                    <linearGradient id="ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="rgba(123,79,212,0.4)" />
                      <stop offset="50%" stopColor="rgba(212,168,67,0.3)" />
                      <stop offset="100%" stopColor="rgba(123,79,212,0.05)" />
                    </linearGradient>
                  </defs>
                  <circle cx="60" cy="60" r="56" fill="none" stroke="url(#ring-grad)" strokeWidth="1" strokeDasharray="8 16" strokeLinecap="round" />
                </svg>
              </div>

              {/* Layer 3 — Counter-rotating inner ring */}
              <div className="absolute inset-6 hero-ring-spin-reverse">
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(212,168,67,0.12)" strokeWidth="0.5" strokeDasharray="4 12" />
                </svg>
              </div>

              {/* Layer 4 — Orbiting particles */}
              <div className="absolute inset-0">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="absolute top-1/2 left-1/2 hero-particle-orbit"
                    style={{
                      width: "4px",
                      height: "4px",
                      marginLeft: "-2px",
                      marginTop: "-2px",
                      animationDelay: `${i * -3}s`,
                    }}
                  >
                    <span
                      className="block rounded-full hero-particle-pulse"
                      style={{
                        width: i % 2 === 0 ? "3px" : "2px",
                        height: i % 2 === 0 ? "3px" : "2px",
                        background: i % 2 === 0 ? "#D4A843" : "#9B7DE8",
                        boxShadow: i % 2 === 0 ? "0 0 6px rgba(212,168,67,0.6)" : "0 0 6px rgba(123,79,212,0.5)",
                        animationDelay: `${i * -1.2}s`,
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* Layer 5 — Center glass circle with gold core */}
              <div
                className="relative flex items-center justify-center rounded-full hero-core-breathe"
                style={{
                  width: "52px",
                  height: "52px",
                  background: "radial-gradient(circle at 35% 35%, rgba(123,79,212,0.12), rgba(212,168,67,0.06) 60%, rgba(0,0,0,0.2))",
                  border: "1px solid rgba(212,168,67,0.15)",
                  boxShadow: "0 0 40px rgba(123,79,212,0.1), 0 0 15px rgba(212,168,67,0.08), inset 0 1px 1px rgba(255,255,255,0.06)",
                  backdropFilter: "blur(8px)",
                }}
              >
                {/* Inner gold spark */}
                <div
                  className="rounded-full hero-spark"
                  style={{
                    width: "8px",
                    height: "8px",
                    background: "radial-gradient(circle, #F5DFA0, #D4A843)",
                    boxShadow: "0 0 12px rgba(212,168,67,0.6), 0 0 30px rgba(212,168,67,0.2)",
                  }}
                />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
              className="text-center mb-2 flex justify-center"
            >
              <GradientText colors={["#7C3AED", "#D4A843", "#7C3AED"]} animationSpeed={4} className="text-[28px] sm:text-[32px] font-semibold tracking-tight">
                <span>Before your next trade.</span>
              </GradientText>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
              className="mb-10 text-center flex justify-center"
            >
              <ShinyText text="Let's check the full picture on XAUUSD." className="text-sm text-white/30" speed={3} />
            </motion.div>

            <div className="grid grid-cols-2 gap-2.5 w-full max-w-lg">
              {suggestions.map((s, i) => (
                <motion.button
                  key={s}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.55 + i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                  type="button"
                  onClick={() => send(s)}
                  className="group rounded-2xl px-4 py-3.5 text-[13px] text-white/40 hover:text-white/80 cursor-pointer text-left transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02]"
                  style={{
                    background: "rgba(124, 58, 237, 0.06)",
                    border: "1px solid rgba(124, 58, 237, 0.15)",
                    boxShadow: "0 0 20px rgba(124, 58, 237, 0.05), inset 0 1px 0 rgba(255,255,255,0.03)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(124, 58, 237, 0.12)";
                    e.currentTarget.style.borderColor = "rgba(212, 168, 67, 0.4)";
                    e.currentTarget.style.boxShadow = "0 0 30px rgba(124, 58, 237, 0.2), 0 0 60px rgba(124, 58, 237, 0.1), 0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(124, 58, 237, 0.06)";
                    e.currentTarget.style.borderColor = "rgba(124, 58, 237, 0.15)";
                    e.currentTarget.style.boxShadow = "0 0 20px rgba(124, 58, 237, 0.05), inset 0 1px 0 rgba(255,255,255,0.03)";
                  }}
                >
                  {s}
                </motion.button>
              ))}
            </div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1, duration: 0.5 }}
              className="mt-8 text-center"
            >
              <ShinyText text="Powered by institutional-grade analysis" className="text-[10px] font-mono text-white/15 tracking-wider" speed={4} />
            </motion.p>
          </motion.div>
        )}

        {/* Messages */}
        {messages.length > 0 && (
          <div className="py-4 px-6 md:px-16 lg:px-24">
            <div className="max-w-3xl mx-auto">
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="mb-6"
                >
                  {m.role === "user" ? (
                    <div className="flex justify-end">
                      <div
                        className="max-w-[75%] px-5 py-3.5 text-white"
                        style={{
                          background: "linear-gradient(135deg, rgba(123,79,212,0.85), rgba(90,53,168,0.9))",
                          borderRadius: "20px 20px 6px 20px",
                          boxShadow: "0 4px 24px rgba(123,79,212,0.2)",
                        }}
                      >
                        {m.imagePreview && (
                          <div className="mb-2.5">
                            <img
                              src={m.imagePreview}
                              alt="Attached chart"
                              className="max-h-48 rounded-xl border border-white/10"
                            />
                          </div>
                        )}
                        <p className="font-sans text-[14px] font-normal break-words leading-relaxed">
                          {m.content}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2 mb-2.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#D4A843]/50 shrink-0" />
                        <span className="text-[10px] uppercase tracking-[0.15em] font-semibold text-[#D4A843]/40">
                          BullionDesk
                        </span>
                      </div>
                      <div
                        className="max-w-[90%] px-5 py-4"
                        style={{
                          background: "linear-gradient(135deg, rgba(123,79,212,0.03), rgba(255,255,255,0.02))",
                          border: "1px solid rgba(123,79,212,0.06)",
                          borderRadius: "20px 20px 20px 6px",
                        }}
                      >
                        <div className="font-sans text-[15px] leading-[1.8] tracking-normal font-normal text-white/85">
                          <MarkdownMessage content={m.content} />
                          {(isStreaming || isTypewriting) && i === messages.length - 1 && m.role === "assistant" && (
                            <span className="typing-cursor" />
                          )}
                        </div>
                      </div>
                      <div className="mt-2 ml-1">
                        <ShareSignalButton text={m.content} />
                      </div>
                      {!loading && !isStreaming && i === messages.length - 1 && (
                        <motion.div
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                          className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 max-w-lg"
                        >
                          {suggestions.map((suggestion) => (
                            <button
                              key={suggestion}
                              type="button"
                              onClick={() => send(suggestion)}
                              className="rounded-xl px-4 py-3 text-[13px] text-white/35 hover:text-white/70 cursor-pointer text-left transition-all duration-200 bg-white/[0.02] border border-white/[0.04] hover:bg-[rgba(123,79,212,0.05)] hover:border-[rgba(123,79,212,0.12)] hover:-translate-y-px"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </motion.div>
                      )}
                      {m.trade_id && !respondedTradeIds.has(m.trade_id) && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {[
                            { result: "tp1_hit",   label: "TP1 Hit" },
                            { result: "tp2_hit",   label: "TP2 Hit" },
                            { result: "sl_hit",    label: "SL Hit" },
                            { result: "breakeven", label: "Breakeven" },
                          ].map(({ result, label }) => (
                            <button
                              key={result}
                              type="button"
                              onClick={() => submitResult(m.trade_id!, result)}
                              className="rounded-xl border border-white/[0.06] px-3 py-1.5 text-[11px] text-white/35 hover:border-[#D4A843]/30 hover:text-white/60 transition"
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              ))}

              {/* Loading dots */}
              {loading && !isStreaming && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="mb-6"
                >
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#D4A843]/50 shrink-0" />
                    <span className="text-[10px] uppercase tracking-[0.15em] font-semibold text-[#D4A843]/40">
                      BullionDesk
                    </span>
                  </div>
                  <div
                    className="inline-flex items-center gap-1.5 px-5 py-4"
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.05)",
                      borderRadius: "20px 20px 20px 6px",
                    }}
                  >
                    {[0, 0.15, 0.3].map((delay) => (
                      <span
                        key={delay}
                        className="w-1.5 h-1.5 rounded-full bg-[#D4A843]/60"
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

        {/* Scroll-to-bottom */}
        <AnimatePresence>
          {showScrollBtn && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
              className="sticky bottom-4 flex justify-center pointer-events-none"
            >
              <button
                type="button"
                onClick={() => scrollToBottom(true)}
                className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-white/[0.06] backdrop-blur-xl border border-white/[0.08] px-3.5 py-2 text-[11px] text-white/40 hover:text-white/60 hover:bg-white/[0.1] transition-all shadow-[0_8px_30px_rgba(0,0,0,0.4)]"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Latest
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Stop generating ── */}
      <AnimatePresence>
        {isStreaming && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.2 }}
            className="flex-none flex justify-center py-2"
          >
            <button
              type="button"
              onClick={stopGeneration}
              className="flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.03] backdrop-blur px-4 py-1.5 text-[11px] text-white/30 hover:text-red-400/70 hover:border-red-400/20 transition-all"
            >
              <span className="h-2 w-2 rounded-sm bg-current shrink-0" />
              Stop generating
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Input area ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
        className={cn(
          "flex-none px-6 md:px-16 lg:px-24 pb-5 pt-3 transition",
          isDragging && "bg-purple-500/[0.02]"
        )}
      >
        <div className="max-w-3xl mx-auto">

          {/* Image preview */}
          <AnimatePresence>
            {selectedImageBase64 && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.25 }}
                className="mb-3 flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3"
              >
                <img
                  src={selectedImageBase64}
                  alt="Selected chart preview"
                  className="h-14 w-20 rounded-lg object-cover border border-white/[0.06]"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/50 truncate">Chart attached</span>
                    <span className="text-[9px] font-mono uppercase tracking-widest text-emerald-400/60 border border-emerald-400/20 rounded-md px-1.5 py-0.5 shrink-0">
                      Ready
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearSelectedImage}
                  className="rounded-lg h-7 w-7 flex items-center justify-center text-white/25 hover:text-white/50 hover:bg-white/[0.04] shrink-0 transition"
                >
                  <svg width="10" height="10" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input row */}
          <div className="relative">
            {/* Ambient purple glow behind input on focus */}
            <div
              className={cn(
                "absolute -inset-4 rounded-3xl transition-opacity duration-500 pointer-events-none",
                inputFocused ? "opacity-100" : "opacity-0"
              )}
              style={{ background: "radial-gradient(ellipse 60% 80% at 50% 50%, rgba(123,79,212,0.06) 0%, transparent 70%)" }}
            />
            {/* Gradient border ring on focus */}
            <div
              className={cn(
                "absolute -inset-px rounded-2xl transition-opacity duration-300 pointer-events-none",
                inputFocused ? "opacity-100" : "opacity-0"
              )}
              style={{
                background: "linear-gradient(135deg, rgba(123,79,212,0.3), rgba(212,168,67,0.2), rgba(123,79,212,0.15))",
                padding: "1px",
                WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                WebkitMaskComposite: "xor",
                maskComposite: "exclude",
                borderRadius: "16px",
              }}
            />

            <input
              ref={chatInputRef}
              className="w-full min-h-[52px] bg-white/[0.03] border border-white/[0.06] rounded-2xl px-5 py-3.5 text-white text-sm placeholder-white/20 backdrop-blur focus:border-[rgba(212,168,67,0.4)] focus:outline-none transition-all duration-300 pr-24"
              style={{
                boxShadow: inputFocused
                  ? "0 0 40px rgba(124, 58, 237, 0.25), 0 0 80px rgba(124, 58, 237, 0.1), inset 0 1px 0 rgba(255,255,255,0.06)"
                  : "0 0 20px rgba(124, 58, 237, 0.08), inset 0 1px 0 rgba(255,255,255,0.03)",
              }}
              placeholder="Ask your AI gold coach anything..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(); }}
              onPaste={handleInputPaste}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
            />

            {/* Attach chart button */}
            <button
              type="button"
              onClick={openFilePicker}
              className={cn(
                "absolute right-12 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center rounded-lg transition-all",
                input.trim() || selectedImageBase64
                  ? "text-[#D4A843]/70 hover:text-[#D4A843]"
                  : "text-white/15 hover:text-white/35 hover:bg-white/[0.04]"
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
            <AnimatePresence>
              {canSend && (
                <motion.button
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  type="button"
                  onClick={() => send()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-10 rounded-xl p-2.5 transition-all"
                  style={{
                    background: "linear-gradient(135deg, #D4A843, #C49A3A)",
                    boxShadow: "0 0 20px rgba(212, 168, 67, 0.4), 0 0 40px rgba(212, 168, 67, 0.15)",
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-white">
                    <path d="M7 11V3M3 7L7 3L11 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </motion.button>
              )}
            </AnimatePresence>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleImageChange}
            />
          </div>

          {/* Disclaimer */}
          <p className="text-[10px] text-white/10 text-center mt-2.5 tracking-wide">
            Not investment advice · Trade at your own risk
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
