"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const WELCOME_MESSAGE =
  "Welcome to BullionDesk. I'm your AI Gold Trading Coach. Ask me anything about XAUUSD — structure, macro context, risk management, or prop firm strategy.";

const MAX_FREE_MESSAGES = 3;

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

export default function DemoChat() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: WELCOME_MESSAGE },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [userCount, setUserCount] = useState(0);
  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const limitReached = userCount >= MAX_FREE_MESSAGES;

  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

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

  return (
    <>
      <style>{`
        @keyframes demoChatBounce {
          0%, 80%, 100% { transform: scaleY(1); opacity: 0.5; }
          40% { transform: scaleY(1.6); opacity: 1; }
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

        {/* Messages */}
        <div ref={messagesRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
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

        {/* Input or CTA */}
        <div className="shrink-0 border-t border-white/[0.07] px-3 py-3">
          {limitReached ? (
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
