"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createClient } from "@/lib/supabase/client";

const WELCOME_MESSAGE =
  "Gold just moved. Let me show you what the institutions are seeing right now. What's on your mind — structure, macro, or a specific trade idea?";

const MAX_FREE_MESSAGES = 3;

type AuthStatus = "loading" | "unauthenticated" | "paid" | "unpaid";

interface Message {
  role: "assistant" | "user";
  content: string;
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M14 8L2 2l2.5 6L2 14l12-6z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <span className="inline-flex gap-1 items-center h-4">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="block h-1.5 w-1.5 rounded-full bg-[color:var(--gold)] opacity-70"
          style={{ animation: `demoChatBounce 1.1s ${i * 0.18}s infinite ease-in-out` }}
        />
      ))}
    </span>
  );
}

function GoldCTAButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="block w-full text-center rounded-xl py-3 px-6 text-sm font-bold tracking-[0.04em] bg-[#D4A843] text-black transition hover:brightness-110"
      style={{ boxShadow: "0 0 20px rgba(212,168,67,0.35)" }}
    >
      {children}
    </Link>
  );
}

function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center h-[480px] rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-8 text-center shadow-[0_16px_60px_rgba(0,0,0,0.35)]">
      {children}
    </div>
  );
}

export default function DemoChat() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: WELCOME_MESSAGE },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [userCount, setUserCount] = useState(0);
  const [badgeVisible, setBadgeVisible] = useState(false);
  const [showBlurOverlay, setShowBlurOverlay] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const blurTimerStarted = useRef(false);

  const limitReached = userCount >= MAX_FREE_MESSAGES;

  // Auth check on mount
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        setAuthStatus("unauthenticated");
        return;
      }
      const { data } = await supabase
        .from("users")
        .select("has_paid")
        .eq("id", session.user.id)
        .single();
      setAuthStatus(data?.has_paid ? "paid" : "unpaid");
    });
  }, []);

  // Scroll to bottom on new messages / loading state changes
  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  // Badge: show after 2nd AI response received
  useEffect(() => {
    if (userCount === 2 && !loading) setBadgeVisible(true);
  }, [userCount, loading]);

  // Blur overlay: trigger ~700ms after 3rd AI response arrives
  useEffect(() => {
    if (!loading && userCount === 3 && !blurTimerStarted.current) {
      blurTimerStarted.current = true;
      const t = setTimeout(() => setShowBlurOverlay(true), 700);
      return () => clearTimeout(t);
    }
  }, [loading, userCount]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading || limitReached) return;

    const nextCount = userCount + 1;
    setUserCount(nextCount);
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);

    try {
      const res = await fetch("/api/demo-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, messageIndex: nextCount }),
      });

      if (!res.ok) throw new Error("API error");

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply ?? "Something went wrong. Please try again." },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Unable to reach the server. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // ── Auth-gated renders ────────────────────────────────────────────────────

  if (authStatus === "loading") {
    return (
      <AuthCard>
        <div className="h-5 w-5 rounded-full border-2 border-[#D4A843] border-t-transparent animate-spin" />
      </AuthCard>
    );
  }

  if (authStatus === "unpaid") {
    return (
      <AuthCard>
        <h2 className="text-xl font-semibold text-white mb-2">Welcome back.</h2>
        <p className="text-sm text-zinc-400 mb-8 max-w-xs leading-relaxed">
          You&apos;ve seen what the AI coach can do. Unlock your full access.
        </p>
        <GoldCTAButton href="/upgrade">Get Early Access — $14.99</GoldCTAButton>
        <p className="text-xs mt-3" style={{ color: "#D4A843" }}>
          🔒 Pay $14.99 today. Lock $25/mo forever.
        </p>
      </AuthCard>
    );
  }

  if (authStatus === "paid") {
    return (
      <AuthCard>
        <p className="text-3xl mb-4">🏆</p>
        <h2 className="text-xl font-semibold text-white mb-6">Your AI coach is ready.</h2>
        <GoldCTAButton href="/chat">Open Chat →</GoldCTAButton>
      </AuthCard>
    );
  }

  // ── Unauthenticated: full demo chat ──────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes demoChatBounce {
          0%, 80%, 100% { transform: scaleY(1); opacity: 0.5; }
          40% { transform: scaleY(1.6); opacity: 1; }
        }
        @keyframes demoBadgeFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .demo-badge-enter {
          animation: demoBadgeFadeIn 400ms ease forwards;
        }
      `}</style>

      <div className="flex flex-col h-[480px] card border border-white/10 rounded-2xl overflow-hidden shadow-[0_16px_60px_rgba(0,0,0,0.35)]">

        {/* Header */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/[0.07] shrink-0">
          <span className="h-2 w-2 rounded-full bg-[color:var(--gold)] shadow-[0_0_6px_rgba(212,175,55,0.7)]" />
          <span className="text-xs tracking-[0.12em] uppercase text-white/60">
            Bullion<span className="text-[color:var(--gold)]">Desk</span> — AI Demo
          </span>
          <span className="ml-auto text-[10px] text-white/30 tabular-nums">
            {MAX_FREE_MESSAGES - userCount > 0
              ? `${MAX_FREE_MESSAGES - userCount} free message${MAX_FREE_MESSAGES - userCount > 1 ? "s" : ""} left`
              : "Demo limit reached"}
          </span>
        </div>

        {/* Messages + Overlay wrapper */}
        <div className="flex-1 relative overflow-hidden">
          <div
            ref={messagesRef}
            className="h-full overflow-y-auto px-4 py-4 space-y-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10"
          >
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <span className="mt-1 mr-2 shrink-0 h-6 w-6 rounded-full border border-[rgba(212,175,55,0.35)] bg-[rgba(212,175,55,0.08)] flex items-center justify-center text-[9px] tracking-wider text-[color:var(--gold)] font-medium">
                    AI
                  </span>
                )}
                <div
                  className={
                    msg.role === "user"
                      ? "max-w-[75%] rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-sm text-white bg-[rgba(212,175,55,0.10)] border border-[rgba(212,175,55,0.2)]"
                      : "max-w-[82%] rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm text-white/85 bg-white/[0.04] border border-white/[0.07] leading-relaxed"
                  }
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                      strong: ({ children }) => <span className="font-semibold text-amber-200">{children}</span>,
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <span className="mt-1 mr-2 shrink-0 h-6 w-6 rounded-full border border-[rgba(212,175,55,0.35)] bg-[rgba(212,175,55,0.08)] flex items-center justify-center text-[9px] tracking-wider text-[color:var(--gold)] font-medium">
                  AI
                </span>
                <div className="rounded-2xl rounded-tl-sm px-3.5 py-3 bg-white/[0.04] border border-white/[0.07]">
                  <Spinner />
                </div>
              </div>
            )}
          </div>

          {/* Blur + conversion overlay (Part C) */}
          {showBlurOverlay && (
            <div className="absolute inset-0 pointer-events-none">
              {/* Gradient blur layer — mask fades blur in from top */}
              <div
                className="absolute bottom-0 left-0 right-0 h-[60%]"
                style={{
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                  maskImage: "linear-gradient(to bottom, transparent 0%, black 45%)",
                  WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 45%)",
                }}
              />
              {/* Color fade layer */}
              <div
                className="absolute bottom-0 left-0 right-0 h-[65%]"
                style={{
                  background: "linear-gradient(to bottom, transparent 0%, rgba(10,8,18,0.75) 50%, rgba(10,8,18,0.97) 100%)",
                }}
              />
            </div>
          )}

          {showBlurOverlay && (
            <div className="absolute bottom-0 left-0 right-0 flex items-end justify-center pb-4 px-3 pointer-events-auto">
              <div
                className="w-full rounded-2xl border border-white/10 p-6 text-center"
                style={{
                  background: "rgba(12,10,22,0.88)",
                  backdropFilter: "blur(24px)",
                  WebkitBackdropFilter: "blur(24px)",
                }}
              >
                <p className="text-3xl mb-3">🔒</p>
                <h3 className="text-white text-lg font-semibold leading-snug">
                  Your AI coach was about to say something important.
                </h3>
                <p className="text-zinc-400 text-sm mt-2">
                  3,400+ gold analyses. Prop firm coaching. Risk management.
                </p>
                <div className="mt-6">
                  <GoldCTAButton href="/signup">Unlock Full Access — $14.99</GoldCTAButton>
                </div>
                <p className="text-xs mt-3" style={{ color: "#D4A843" }}>
                  🔒 Pay $14.99 today. Lock $25/mo forever.
                </p>
                <p className="text-xs mt-1" style={{ color: "#71717A" }}>
                  Standard price after beta: $39.99/mo
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="shrink-0 border-t border-white/[0.07] px-3 py-3">
          {/* Part B — "1 message remaining" badge after 2nd response */}
          {badgeVisible && !limitReached && (
            <p
              className="text-xs text-center mb-2 demo-badge-enter"
              style={{ color: "#D4A843" }}
            >
              🔒 1 message remaining
            </p>
          )}

          {showBlurOverlay ? (
            <textarea
              disabled
              placeholder="Create your account to continue..."
              rows={1}
              className="w-full resize-none rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2.5 text-sm text-white/30 placeholder-white/20 outline-none cursor-not-allowed leading-relaxed"
              style={{ scrollbarWidth: "none" }}
            />
          ) : limitReached ? (
            <div className="flex flex-col items-center gap-2 py-1">
              <p className="text-xs text-white/50 text-center">
                You&apos;ve reached the demo limit.
              </p>
              <Link
                href="/signup"
                className="w-full text-center rounded-xl py-2.5 text-xs tracking-[0.10em] uppercase font-medium border border-[rgba(212,175,55,0.55)] text-[color:var(--gold)] transition hover:border-[rgba(212,175,55,0.95)] hover:bg-[rgba(212,175,55,0.08)]"
              >
                Sign up to continue
              </Link>
            </div>
          ) : (
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                placeholder="Ask about XAUUSD…"
                rows={1}
                className="flex-1 resize-none rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-[rgba(212,175,55,0.4)] transition disabled:opacity-50 leading-relaxed max-h-28 overflow-y-auto"
                style={{ scrollbarWidth: "none" }}
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                aria-label="Send"
                className="shrink-0 h-9 w-9 flex items-center justify-center rounded-xl border border-[rgba(212,175,55,0.45)] text-[color:var(--gold)] transition hover:border-[rgba(212,175,55,0.9)] hover:bg-[rgba(212,175,55,0.08)] disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <SendIcon />
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
