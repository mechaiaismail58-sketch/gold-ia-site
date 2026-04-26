"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import MarkdownMessage from "@/components/MarkdownMessage";
import { useChatContext, type Msg } from "@/context/ChatContext";

interface Props {
  isOpen:  boolean;
  onClose: () => void;
}

function DotsLoader() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(200,162,74,0.5)", flexShrink: 0 }} />
        <span style={{ fontSize: 10, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.18em", color: "rgba(255,255,255,0.2)" }}>
          Bullion Desk
        </span>
      </div>
      <div style={{ paddingLeft: 10, borderLeft: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 5, paddingTop: 8, paddingBottom: 8 }}>
        {[0, 0.2, 0.4].map(delay => (
          <span key={delay} style={{ width: 6, height: 6, borderRadius: "50%", background: "#D4AF37", animation: "dot-bounce 1.2s ease-in-out infinite", animationDelay: `${delay}s` }} />
        ))}
      </div>
    </div>
  );
}

export default function ChatOverlay({ isOpen, onClose }: Props) {
  const { messages, setMessages, sessionId, previousResponseId, setPreviousResponseId, startNewChat } = useChatContext();

  const [input,         setInput]         = useState("");
  const [loading,       setLoading]       = useState(false);
  const [isStreaming,   setIsStreaming]    = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const chatRef       = useRef<HTMLDivElement>(null);
  const inputRef      = useRef<HTMLInputElement>(null);
  const bottomRef     = useRef<HTMLDivElement>(null);
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const scrolledUpRef = useRef(false);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 320);
  }, [isOpen]);

  // Scroll management
  const scrollToBottom = useCallback((force = false) => {
    if (!force && scrolledUpRef.current) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  useEffect(() => {
    const c = chatRef.current;
    if (!c) return;
    function onScroll() {
      if (!c) return;
      scrolledUpRef.current = c.scrollHeight - c.scrollTop - c.clientHeight > 120;
    }
    c.addEventListener("scroll", onScroll, { passive: true });
    return () => c.removeEventListener("scroll", onScroll);
  }, []);

  // Paste image anywhere in overlay
  useEffect(() => {
    if (!isOpen) return;
    async function onPaste(e: ClipboardEvent) {
      if (e.clipboardData?.items) {
        for (const item of Array.from(e.clipboardData.items)) {
          if (item.kind === "file" && item.type.startsWith("image/")) {
            const file = item.getAsFile();
            if (file) { e.preventDefault(); attachFile(file); return; }
          }
        }
      }
      try {
        const clips = await navigator.clipboard.read();
        for (const clip of clips) {
          for (const type of clip.types) {
            if (type.startsWith("image/")) {
              const blob = await clip.getType(type);
              attachFile(new File([blob], "pasted.png", { type }));
              return;
            }
          }
        }
      } catch { /* unavailable */ }
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [isOpen]);

  function attachFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setSelectedImage(reader.result as string);
    reader.readAsDataURL(file);
  }

  // ── Send ──────────────────────────────────────────────────────────────────

  const send = useCallback(async (textOverride?: string) => {
    const userText  = textOverride ?? input.trim();
    const imgToSend = textOverride ? null : selectedImage;
    if (!userText && !imgToSend) return;
    if (loading) return;

    setInput("");
    setSelectedImage(null);
    setLoading(true);
    scrolledUpRef.current = false;

    setMessages(m => [...m, {
      role: "user",
      content: userText || "[Image attached]",
      imagePreview: imgToSend ?? undefined,
    }]);

    try {
      const body: Record<string, unknown> = { userMessage: userText, session_id: sessionId };
      if (previousResponseId) body.previous_response_id = previousResponseId;
      if (imgToSend) body.chartImageBase64 = imgToSend;

      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!r.ok) {
        const errText = await r.text();
        let msg = `Request failed (${r.status})`;
        try { msg = JSON.parse(errText).error ?? msg; } catch { /* */ }
        throw new Error(msg);
      }
      if (!r.body) throw new Error("No response body");

      const reader  = r.body.getReader();
      const decoder = new TextDecoder();
      let fullText  = "";
      let msgAdded  = false;
      let buffer    = "";
      setIsStreaming(true);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(part.slice(6));
            if (event.type === "delta") {
              fullText += event.text;
              if (!msgAdded) {
                setMessages(m => [...m, { role: "assistant", content: fullText }]);
                msgAdded = true;
              } else {
                setMessages(m => {
                  const u = [...m];
                  u[u.length - 1] = { ...u[u.length - 1], content: fullText };
                  return u;
                });
              }
              scrollToBottom();
            } else if (event.type === "done") {
              if (event.response_id) setPreviousResponseId(event.response_id);
              if (event.trade_id && msgAdded) {
                setMessages(m => {
                  const u = [...m];
                  u[u.length - 1] = { ...u[u.length - 1], trade_id: event.trade_id };
                  return u;
                });
              }
            } else if (event.type === "error") {
              throw new Error(event.error);
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }

      setIsStreaming(false);
      if (!msgAdded) setMessages(m => [...m, { role: "assistant", content: "No response — please retry." }]);
    } catch (err) {
      setIsStreaming(false);
      setMessages(m => [...m, { role: "assistant", content: `Error: ${err instanceof Error ? err.message : "Unknown error"}` }]);
    } finally {
      setLoading(false);
    }
  }, [input, selectedImage, loading, sessionId, previousResponseId, setMessages, setPreviousResponseId, scrollToBottom]);

  // Trade result submit
  const [respondedIds, setRespondedIds] = useState<Set<string>>(new Set());
  async function submitResult(tradeId: string, result: string) {
    setRespondedIds(p => new Set([...p, tradeId]));
    try {
      const r = await fetch("/api/trades/result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trade_id: tradeId, result }),
      });
      const d = await r.json();
      const labels: Record<string, string> = { tp1_hit: "TP1 Hit", tp2_hit: "TP2 Hit", sl_hit: "SL Hit", breakeven: "Breakeven" };
      const msg = d.lesson_learned
        ? `Trade result recorded: **${labels[result] ?? result}**\n\n${d.lesson_learned}`
        : `Trade result recorded: **${labels[result] ?? result}**`;
      setMessages(m => [...m, { role: "assistant", content: msg }]);
    } catch {
      setMessages(m => [...m, { role: "assistant", content: "Failed to record result — please retry." }]);
    }
  }

  function getSuggestions(content: string): string[] {
    if (content.includes(":::notrade") || /\bNO[- ]TRADE\b/i.test(content)) return ["Check back later", "What-if scenario", "Quick update"];
    if (content.includes(":::trade")) return ["Manage position", "Risk sizing", "What if it reverses?"];
    if (content.length > 600) return ["Give me a trade", "Quick summary", "Key level to watch"];
    return ["Full analysis", "Quick update", "Trade setup"];
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 60,
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(2px)",
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
          transition: "opacity 300ms ease",
        }}
      />

      {/* Drawer */}
      <div
        style={{
          position: "fixed", right: 0, top: 0, bottom: 0, zIndex: 61,
          width: "min(420px, 100vw)",
          background: "#0A0714",
          borderLeft: "1px solid rgba(255,255,255,0.06)",
          display: "flex", flexDirection: "column",
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 300ms ease-out",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 11, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.16em", color: "rgba(255,255,255,0.5)" }}>
              Live Signal Console
            </span>
            <span style={{ fontSize: 9, fontFamily: "monospace", color: "#4ADE80", background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 3, padding: "1px 6px" }}>
              AI Connected
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={startNewChat}
              style={{ background: "none", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, color: "rgba(255,255,255,0.35)", padding: "4px 10px", cursor: "pointer", fontSize: 10, fontFamily: "monospace" }}
              title="New chat"
            >
              New
            </button>
            <button
              onClick={onClose}
              style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "4px 6px" }}
              title="Close (Esc)"
            >
              ×
            </button>
          </div>
        </div>

        {/* Messages */}
        <div
          ref={chatRef}
          style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 20 }}
        >
          {messages.map((m: Msg, i: number) => (
            <div key={i} style={{ animation: "fade-in-fast 0.15s ease-out" }}>
              {m.role === "user" ? (
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <div style={{ maxWidth: "78%" }}>
                    {m.imagePreview && (
                      <div style={{ marginBottom: 6, display: "flex", justifyContent: "flex-end" }}>
                        <img src={m.imagePreview} alt="chart" style={{ maxHeight: 140, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)" }} />
                      </div>
                    )}
                    <div style={{
                      display: "inline-block", padding: "8px 14px", borderRadius: "14px 14px 3px 14px",
                      background: "rgba(109,40,217,0.16)", border: "1px solid rgba(109,40,217,0.4)",
                      color: "rgba(255,255,255,0.85)", fontSize: 13, lineHeight: 1.65, wordBreak: "break-word",
                    }}>
                      {m.content}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(200,162,74,0.7)", flexShrink: 0 }} />
                    <span style={{ fontSize: 10, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.18em", color: "rgba(255,255,255,0.25)" }}>
                      Bullion Desk
                    </span>
                    {isStreaming && i === messages.length - 1 && (
                      <span style={{ width: 2, height: 13, background: "#D4AF37", display: "inline-block", verticalAlign: "text-bottom", animation: "cursorBlink 0.8s ease-in-out infinite" }} />
                    )}
                  </div>
                  <div style={{ paddingLeft: 10, borderLeft: "1px solid rgba(255,255,255,0.06)" }}>
                    <MarkdownMessage content={m.content} />
                  </div>
                  {/* Suggestion chips */}
                  {!loading && !isStreaming && i === messages.length - 1 && (
                    <div style={{ paddingLeft: 10, display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                      {getSuggestions(m.content).map(s => (
                        <button key={s} onClick={() => send(s)} style={{
                          padding: "5px 12px", borderRadius: 14,
                          border: "0.5px solid rgba(212,175,55,0.12)",
                          fontSize: 11, fontFamily: "monospace",
                          color: "rgba(255,255,255,0.32)", background: "transparent", cursor: "pointer",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(212,175,55,0.4)"; e.currentTarget.style.color = "rgba(212,175,55,0.8)"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(212,175,55,0.12)"; e.currentTarget.style.color = "rgba(255,255,255,0.32)"; }}>
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Trade result buttons */}
                  {m.trade_id && !respondedIds.has(m.trade_id) && (
                    <div style={{ paddingLeft: 10, display: "flex", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
                      {[
                        { result: "tp1_hit", label: "✅ TP1" },
                        { result: "tp2_hit", label: "🎯 TP2" },
                        { result: "sl_hit",  label: "❌ SL"  },
                        { result: "breakeven", label: "➡️ B/E" },
                      ].map(({ result, label }) => (
                        <button key={result} onClick={() => submitResult(m.trade_id!, result)} style={{
                          padding: "5px 10px", borderRadius: 8,
                          border: "1px solid rgba(255,255,255,0.08)",
                          fontSize: 11, color: "rgba(255,255,255,0.45)", background: "transparent", cursor: "pointer",
                        }}>
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {loading && !isStreaming && <DotsLoader />}
          <div ref={bottomRef} />
        </div>

        {/* Image preview */}
        {selectedImage && (
          <div style={{
            margin: "0 18px 8px", display: "flex", alignItems: "center", gap: 10,
            padding: 10, borderRadius: 10,
            border: "1px solid rgba(109,40,217,0.25)", background: "rgba(109,40,217,0.05)",
          }}>
            <img src={selectedImage} alt="chart preview" style={{ height: 48, width: 64, objectFit: "cover", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)" }} />
            <span style={{ flex: 1, fontSize: 12, color: "rgba(255,255,255,0.7)" }}>Chart attached</span>
            <button onClick={() => setSelectedImage(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 16 }}>×</button>
          </div>
        )}

        {/* Input area */}
        <div style={{ padding: "12px 18px", borderTop: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {/* Image attach */}
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{ background: "none", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "rgba(255,255,255,0.3)", cursor: "pointer", padding: "8px 10px", flexShrink: 0, minHeight: 44 }}
              title="Attach chart"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <rect x="1" y="3" width="14" height="10" rx="2" />
                <circle cx="5.5" cy="6.5" r="1.2" />
                <path d="M1 11l4-3 3 2.5 2-2 5 4" />
              </svg>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) attachFile(f); }} />

            {/* Text input */}
            <div style={{ flex: 1, position: "relative" }}>
              {!input && (
                <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.2)", fontSize: 13, pointerEvents: "none", whiteSpace: "nowrap" }}>
                  Analyse XAUUSD
                </span>
              )}
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                onPaste={e => {
                  if (!e.clipboardData) return;
                  for (const item of Array.from(e.clipboardData.items)) {
                    if (item.kind === "file" && item.type.startsWith("image/")) {
                      const f = item.getAsFile();
                      if (f) { e.preventDefault(); attachFile(f); return; }
                    }
                  }
                }}
                style={{
                  width: "100%", background: "transparent",
                  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10,
                  padding: "11px 50px 11px 14px", color: "rgba(255,255,255,0.9)", fontSize: 13,
                  outline: "none", boxSizing: "border-box", minHeight: 44,
                }}
                onFocus={e => (e.target.style.borderColor = "rgba(109,40,217,0.75)")}
                onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
              />
              {/* Send button */}
              <button
                onClick={() => send()}
                disabled={loading || (!input.trim() && !selectedImage)}
                style={{
                  position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: loading ? "not-allowed" : "pointer",
                  color: (loading || (!input.trim() && !selectedImage)) ? "rgba(255,255,255,0.15)" : "#D4AF37",
                  padding: 4,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="9" y1="14" x2="9" y2="4" />
                  <polyline points="5,8 9,4 13,8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
