"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
}

const PROFILE_KEY = "bulliondesk_trader_profile";

const PROP_FIRMS = ["FTMO", "The5ers", "Apex", "E8", "FundedNext", "Blue Guardian", "Alpha Capital", "Other", "None"];
const ACCOUNT_SIZES = ["$10K", "$25K", "$50K", "$100K", "$200K"];
const CHALLENGE_PHASES = ["Phase 1", "Phase 2", "Funded", "Not in a challenge"];

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

  const [respondedTradeIds, setRespondedTradeIds] = useState<Set<string>>(new Set());

  const [isStreaming, setIsStreaming] = useState(false);
  const [isTypewriting, setIsTypewriting] = useState(false);

  // Trader profile state
  const [profileOpen, setProfileOpen] = useState(false);
  const [traderProfile, setTraderProfile] = useState<TraderProfile>({
    prop_firm: "",
    account_size: "",
    challenge_phase: "",
    current_drawdown: "",
  });
  const [savedProfile, setSavedProfile] = useState<TraderProfile | null>(null);

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
    "What's the structure on gold right now?",
    "I'm about to enter a trade — check it",
    "My prop firm challenge status",
    "Full XAUUSD analysis",
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

  // Lock body scroll while chat is mounted
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Load trader profile from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PROFILE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as TraderProfile;
        setTraderProfile(parsed);
        setSavedProfile(parsed);
      }
    } catch { /* ignore */ }
  }, []);

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
    if (messages.length <= 1) fetchSuggestions();
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

      // Inject trader profile if set
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
    <div
      className="h-screen flex flex-col bg-[#0A0A0A] overflow-hidden"
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
        <div className="max-w-5xl mx-auto px-6 md:px-10 py-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-6">

            {/* Left: brand */}
            <div className="flex flex-col gap-0.5 shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#D4A843] animate-pulse inline-block shrink-0" />
                <span className="text-sm font-semibold text-white">BullionDesk</span>
              </div>
              <span className="text-[10px] text-[#71717A] uppercase tracking-wider pl-4">
                AI Gold Trading Coach · XAUUSD
              </span>
            </div>

            {/* Center: always-visible anchor */}
            <div className="chat-anchor-pulse bg-[#D4A843]/[0.08] border border-[#D4A843]/20 rounded-xl px-4 py-2.5 flex-1 max-w-md">
              <p className="text-sm text-[#D4A843] font-medium text-center leading-snug">
                ⚡ Don&apos;t take any trade before checking with the AI.
              </p>
            </div>

            {/* Right: controls */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowHistory(true)}
                className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-[#71717A] hover:text-white border border-white/[0.08] rounded-lg px-3 py-1.5 hover:border-white/20 transition-all"
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
                className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-[#71717A] hover:text-white border border-white/[0.08] rounded-lg px-3 py-1.5 hover:border-white/20 transition-all"
                title="Start new analysis"
              >
                <svg width="10" height="10" viewBox="0 0 11 11" fill="none">
                  <path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                New
              </button>
              <span className="text-[9px] uppercase bg-[#D4A843]/20 text-[#D4A843] px-2 py-0.5 rounded-full font-medium tracking-wide">
                Beta
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Quick stats bar ── */}
      <div className="flex-none bg-white/[0.015] border-b border-white/[0.06] px-6 md:px-10 py-2 overflow-x-auto">
        <div className="max-w-5xl mx-auto flex items-center gap-6 text-xs whitespace-nowrap">
          <span className="text-[#D4A843]/60 font-mono tracking-wider">XAUUSD</span>
          <span className="text-white/[0.08]">·</span>
          <span className="text-[#71717A]">Live data connected</span>
          <span className="text-white/[0.08]">·</span>
          <span className="text-[#71717A]">Not investment advice · No signals · Trade at your own risk</span>
        </div>
      </div>

      {/* ── Trader profile bar ── */}
      <div className="flex-none border-b border-white/[0.06]">
        <button
          type="button"
          onClick={() => setProfileOpen(o => !o)}
          className="w-full flex items-center justify-between px-6 md:px-10 py-2 text-xs text-[#71717A] hover:text-white/70 hover:bg-white/[0.02] transition-all"
        >
          <span className="flex items-center gap-2">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="shrink-0 opacity-60">
              <circle cx="6" cy="4" r="2.5" stroke="currentColor" strokeWidth="1.1"/>
              <path d="M1.5 11c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
            </svg>
            {summary
              ? <span className="text-[#A1A1AA]">📊 {summary}</span>
              : <span>Set up your trader profile for personalised coaching →</span>
            }
          </span>
          <svg
            width="10" height="10" viewBox="0 0 10 10" fill="none"
            className={cn("transition-transform duration-300", profileOpen && "rotate-180")}
          >
            <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Expandable profile form */}
        <div
          style={{
            maxHeight: profileOpen ? "480px" : "0",
            overflow: "hidden",
            transition: "max-height 400ms ease",
          }}
        >
          {profileOpen && (
            <div className="px-6 md:px-10 pb-4 pt-1 profile-content-enter">
              <div className="max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Prop Firm */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase tracking-wider text-[#71717A]">Prop Firm</label>
                  <select
                    value={traderProfile.prop_firm}
                    onChange={e => setTraderProfile(p => ({ ...p, prop_firm: e.target.value }))}
                    className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:border-[#D4A843]/30 focus:outline-none transition appearance-none cursor-pointer"
                  >
                    <option value="" className="bg-[#111]">Select firm…</option>
                    {PROP_FIRMS.map(f => <option key={f} value={f} className="bg-[#111]">{f}</option>)}
                  </select>
                </div>

                {/* Account Size */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase tracking-wider text-[#71717A]">Account Size</label>
                  <select
                    value={traderProfile.account_size}
                    onChange={e => setTraderProfile(p => ({ ...p, account_size: e.target.value }))}
                    className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:border-[#D4A843]/30 focus:outline-none transition appearance-none cursor-pointer"
                  >
                    <option value="" className="bg-[#111]">Select size…</option>
                    {ACCOUNT_SIZES.map(s => <option key={s} value={s} className="bg-[#111]">{s}</option>)}
                  </select>
                </div>

                {/* Challenge Phase */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase tracking-wider text-[#71717A]">Challenge Phase</label>
                  <select
                    value={traderProfile.challenge_phase}
                    onChange={e => setTraderProfile(p => ({ ...p, challenge_phase: e.target.value }))}
                    className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:border-[#D4A843]/30 focus:outline-none transition appearance-none cursor-pointer"
                  >
                    <option value="" className="bg-[#111]">Select phase…</option>
                    {CHALLENGE_PHASES.map(ph => <option key={ph} value={ph} className="bg-[#111]">{ph}</option>)}
                  </select>
                </div>

                {/* Current Drawdown */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase tracking-wider text-[#71717A]">Current Drawdown %</label>
                  <input
                    type="text"
                    placeholder="e.g. 2.5%"
                    value={traderProfile.current_drawdown}
                    onChange={e => setTraderProfile(p => ({ ...p, current_drawdown: e.target.value }))}
                    className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-[#525252] focus:border-[#D4A843]/30 focus:outline-none transition"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={saveProfile}
                className="mt-3 flex items-center gap-2 rounded-lg border border-[#D4A843]/30 bg-[#D4A843]/[0.08] px-4 py-2 text-xs text-[#D4A843] hover:bg-[#D4A843]/[0.14] transition"
              >
                Save profile
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Messages area ── */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto relative"
      >
        {/* Empty state — absolutely centred in the scrollable area */}
        {messages.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 empty-state-enter">
            <p className="text-xl font-medium text-white/50 mb-8 text-center leading-snug">
              Before your next trade —<br className="hidden sm:block" /> let&apos;s check the full picture.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
              {suggestions.map((s, i) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="chip-enter bg-white/[0.04] border border-white/[0.07] rounded-xl px-5 py-3.5 text-sm text-[#A1A1AA] hover:border-[#D4A843]/30 hover:text-white cursor-pointer transition-all duration-300 text-left"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  {s}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-[#52525B] mt-6 text-center">
              Powered by institutional-grade analysis · 22 data sources
            </p>
          </div>
        )}

        {/* Messages */}
        {messages.length > 0 && (
          <div className="py-6 px-6 md:px-16 lg:px-24">
            <div className="max-w-3xl mx-auto">
              {messages.map((m, i) => (
                <div key={i} className="animate-fade-in-fast">
                  {m.role === "user" ? (
                    <div className="flex justify-end mb-6">
                      <div className="max-w-[75%] bg-white/[0.05] border border-white/[0.06] rounded-2xl rounded-br-md px-5 py-3">
                        {m.imagePreview && (
                          <div className="mb-2">
                            <img
                              src={m.imagePreview}
                              alt="Attached chart"
                              className="max-h-48 rounded-xl border border-white/10"
                            />
                          </div>
                        )}
                        <p className="text-sm text-white/90 font-normal break-words">
                          {m.content}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-8">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-[#D4A843]/60 mb-2">
                        BullionDesk
                      </p>
                      <div className="border-l-2 border-[#D4A843]/20 pl-5 max-w-[85%]">
                        <div
                          className="text-[15px] font-light leading-[1.8] tracking-[0.01em] text-[#E5E5E5]"
                          style={{ fontFamily: "var(--font-geist)" }}
                        >
                          <MarkdownMessage content={m.content} />
                          {(isStreaming || isTypewriting) && i === messages.length - 1 && m.role === "assistant" && (
                            <span className="typing-cursor" />
                          )}
                        </div>
                      </div>
                      <div className="pl-5 mt-2">
                        <ShareSignalButton text={m.content} />
                      </div>
                      {!loading && !isStreaming && i === messages.length - 1 && (
                        <div className="pl-5 grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 max-w-lg">
                          {suggestions.map((suggestion) => (
                            <button
                              key={suggestion}
                              type="button"
                              onClick={() => send(suggestion)}
                              className="bg-white/[0.04] border border-white/[0.07] rounded-xl px-5 py-3 text-sm text-[#A1A1AA] hover:border-[#D4A843]/30 hover:text-white cursor-pointer transition-all duration-300 text-left"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      )}
                      {m.trade_id && !respondedTradeIds.has(m.trade_id) && (
                        <div className="pl-5 flex flex-wrap gap-2 mt-3">
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
                    </div>
                  )}
                </div>
              ))}

              {/* Loading dots */}
              {loading && !isStreaming && (
                <div className="mb-8 animate-fade-in-fast">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-[#D4A843]/60 mb-2">
                    BullionDesk
                  </p>
                  <div className="border-l-2 border-[#D4A843]/20 pl-5 flex items-center gap-1.5 py-2">
                    {[0, 0.2, 0.4].map((delay) => (
                      <span
                        key={delay}
                        className="w-1.5 h-1.5 rounded-full bg-[#D4A843]"
                        style={{ animation: "dot-bounce 1.2s ease-in-out infinite", animationDelay: `${delay}s` }}
                      />
                    ))}
                  </div>
                </div>
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

      {/* ── Input area ── */}
      <div className={cn(
        "flex-none bg-[#0A0A0A] border-t border-white/[0.06] px-6 md:px-16 lg:px-24 py-4 transition",
        isDragging && "bg-[rgba(109,40,217,0.04)] border-t-[rgba(109,40,217,0.3)]"
      )}>
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
            <input
              ref={chatInputRef}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-5 py-3.5 text-white text-sm placeholder-[#525252] focus:border-[#D4A843]/30 focus:shadow-[0_0_20px_rgba(212,168,67,0.06)] focus:outline-none transition pr-24"
              placeholder="Ask about gold, your trade, or your strategy..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(); }}
              onPaste={handleInputPaste}
            />

            {/* Attach chart button */}
            <button
              type="button"
              onClick={openFilePicker}
              className="absolute right-12 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center text-white/25 hover:text-white/50 transition"
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

            {/* Send button — visible when there is content to send */}
            {canSend && (
              <button
                type="button"
                onClick={() => send()}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#D4A843] hover:bg-[#D4A843]/90 rounded-lg p-2 transition"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-black">
                  <path d="M7 11V3M3 7L7 3L11 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
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
      </div>
    </div>
  );
}
