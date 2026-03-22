"use client";

import { useEffect, useState } from "react";
import { useChatContext, type Msg } from "@/context/ChatContext";

type Session = {
  session_id: string;
  mode: string;
  first_message: string;
  created_at: string;
};

type Exchange = {
  mode: string;
  message_user: string;
  message_ia: string;
  image_attached: boolean;
  created_at: string;
};

function groupByDate(sessions: Session[]): { label: string; items: Session[] }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86_400_000);
  const weekAgo = new Date(today.getTime() - 7 * 86_400_000);

  const todayItems: Session[] = [];
  const yesterdayItems: Session[] = [];
  const weekItems: Session[] = [];
  const olderItems: Session[] = [];

  for (const s of sessions) {
    const d = new Date(s.created_at);
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (day >= today) todayItems.push(s);
    else if (day >= yesterday) yesterdayItems.push(s);
    else if (day >= weekAgo) weekItems.push(s);
    else olderItems.push(s);
  }

  const groups = [];
  if (todayItems.length)     groups.push({ label: "Today",     items: todayItems });
  if (yesterdayItems.length) groups.push({ label: "Yesterday", items: yesterdayItems });
  if (weekItems.length)      groups.push({ label: "This Week", items: weekItems });
  if (olderItems.length)     groups.push({ label: "Earlier",   items: olderItems });
  return groups;
}

function modeLabel(mode: string) {
  if (mode === "trade_request") return "TRADE";
  if (mode === "analysis")      return "ANALYSIS";
  if (mode === "market_question") return "MARKET";
  if (mode === "education")     return "EDUCATION";
  return mode.toUpperCase();
}

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function HistoryPanel({ open, onClose }: Props) {
  const { loadHistorySession } = useChatContext();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSession, setLoadingSession] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/conversations")
      .then((r) => r.json())
      .then((data) => {
        if (data?.sessions) setSessions(data.sessions);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  async function openSession(sessionId: string) {
    setLoadingSession(sessionId);
    try {
      const r = await fetch(`/api/conversations?session=${sessionId}`);
      const data = await r.json();
      if (data?.exchanges) {
        const msgs: Msg[] = data.exchanges.flatMap((ex: Exchange) => [
          { role: "user" as const,      content: ex.message_user },
          { role: "assistant" as const, content: ex.message_ia },
        ]);
        loadHistorySession(msgs, sessionId);
        onClose();
      }
    } catch {}
    finally {
      setLoadingSession(null);
    }
  }

  const groups = groupByDate(sessions);

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Panel — only mounted when open, no layout space when closed */}
      {open && <div className="fixed top-0 left-0 z-50 h-full w-full sm:w-[320px] bg-[#0c0a14] border-r border-white/10 shadow-2xl flex flex-col animate-slide-in-left">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] shrink-0">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/30 mb-0.5">Bullion Desk</div>
            <h2 className="text-[15px] tracking-[-0.01em]">Conversation History</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 p-2 text-white/40 hover:text-white/70 hover:border-white/20 transition"
            aria-label="Close history"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto py-2">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-white/30 text-sm">
              Loading…
            </div>
          ) : sessions.length === 0 ? (
            <div className="px-5 py-12 text-center text-white/30 text-sm">
              No conversations yet.
            </div>
          ) : (
            groups.map(({ label, items }) => (
              <div key={label}>
                <div className="px-5 pt-4 pb-1.5 text-[10px] uppercase tracking-[0.18em] text-white/25">
                  {label}
                </div>
                {items.map((s) => (
                  <button
                    key={s.session_id}
                    onClick={() => openSession(s.session_id)}
                    disabled={loadingSession === s.session_id}
                    className="w-full text-left px-5 py-3 hover:bg-white/[0.04] transition flex flex-col gap-1 group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] uppercase tracking-[0.14em] text-[rgba(109,40,217,0.7)] border border-[rgba(109,40,217,0.3)] rounded px-1.5 py-0.5 shrink-0">
                        {modeLabel(s.mode)}
                      </span>
                      {loadingSession === s.session_id && (
                        <span className="w-3 h-3 border border-white/20 border-t-white/60 rounded-full animate-spin shrink-0" />
                      )}
                    </div>
                    <span className="text-[13px] text-white/70 leading-[1.4] line-clamp-2 group-hover:text-white/90 transition">
                      {s.first_message || "Chart analysis"}
                    </span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </div>}
    </>
  );
}
