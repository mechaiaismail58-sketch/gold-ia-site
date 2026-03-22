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
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null); // session_id or "all"
  const [deleting, setDeleting] = useState(false);

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

  // Close confirmation if panel closes
  useEffect(() => {
    if (!open) setConfirmingDelete(null);
  }, [open]);

  async function openSession(sessionId: string) {
    if (confirmingDelete) return;
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

  async function deleteSession(sessionId: string) {
    setDeleting(true);
    try {
      const r = await fetch(`/api/conversations?session=${sessionId}`, { method: "DELETE" });
      if (r.ok) {
        setSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
      }
    } catch {}
    finally {
      setDeleting(false);
      setConfirmingDelete(null);
    }
  }

  async function deleteAll() {
    setDeleting(true);
    try {
      const r = await fetch("/api/conversations?all=true", { method: "DELETE" });
      if (r.ok) {
        setSessions([]);
      }
    } catch {}
    finally {
      setDeleting(false);
      setConfirmingDelete(null);
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

      {/* Panel */}
      {open && (
        <div className="fixed top-0 left-0 z-50 h-full w-full sm:w-[320px] bg-[#0c0a14] border-r border-white/10 shadow-2xl flex flex-col animate-slide-in-left">
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
                    <div key={s.session_id}>
                      {/* Inline delete confirmation for this session */}
                      {confirmingDelete === s.session_id ? (
                        <div className="mx-3 my-1 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-between gap-2">
                          <span className="text-[12px] text-white/50">Delete this conversation?</span>
                          <div className="flex gap-1.5 shrink-0">
                            <button
                              onClick={() => deleteSession(s.session_id)}
                              disabled={deleting}
                              className="text-[11px] px-2.5 py-1 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/20 transition disabled:opacity-50"
                            >
                              {deleting ? "…" : "Confirm"}
                            </button>
                            <button
                              onClick={() => setConfirmingDelete(null)}
                              disabled={deleting}
                              className="text-[11px] px-2.5 py-1 rounded-lg bg-white/[0.04] text-white/40 hover:text-white/60 border border-white/[0.08] transition disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-stretch group">
                          <button
                            onClick={() => openSession(s.session_id)}
                            disabled={loadingSession === s.session_id}
                            className="flex-1 text-left px-5 py-3 hover:bg-white/[0.04] transition flex flex-col gap-1"
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
                          {/* Trash icon */}
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmingDelete(s.session_id); }}
                            className="px-3 flex items-center opacity-0 group-hover:opacity-100 text-white/25 hover:text-red-400 transition"
                            aria-label="Delete conversation"
                          >
                            <svg width="13" height="14" viewBox="0 0 13 14" fill="none">
                              <path d="M1 3.5h11M4.5 3.5V2.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1M5.5 6.5v4M7.5 6.5v4M2 3.5l.8 8a1 1 0 0 0 1 .9h5.4a1 1 0 0 0 1-.9l.8-8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>

          {/* Footer — Clear all */}
          {sessions.length > 0 && (
            <div className="px-4 py-3 border-t border-white/[0.06] shrink-0">
              {confirmingDelete === "all" ? (
                <div className="flex flex-col gap-2.5">
                  <p className="text-[12px] text-white/45 leading-[1.4]">
                    Delete all conversations?<br/>
                    <span className="text-white/30">This cannot be undone.</span>
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={deleteAll}
                      disabled={deleting}
                      className="flex-1 text-[12px] py-2 rounded-xl bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/20 transition disabled:opacity-50"
                    >
                      {deleting ? "Deleting…" : "Confirm"}
                    </button>
                    <button
                      onClick={() => setConfirmingDelete(null)}
                      disabled={deleting}
                      className="flex-1 text-[12px] py-2 rounded-xl bg-white/[0.04] text-white/40 hover:text-white/60 border border-white/[0.08] transition disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmingDelete("all")}
                  className="w-full text-[12px] py-2 rounded-xl text-red-400/60 hover:text-red-400 hover:bg-red-500/[0.06] border border-transparent hover:border-red-500/15 transition"
                >
                  Clear all history
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
