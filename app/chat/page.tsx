"use client";

import { useState } from "react";
import ChatPage from "@/components/ChatPage";
import InstitutionalDashboard from "@/components/InstitutionalDashboard";

export const dynamic = "force-dynamic";

export default function ChatRoute() {
  const [showDashboard, setShowDashboard] = useState(false);

  return (
    <>
      {/* ── Desktop: split-screen ── */}
      <div className="hidden md:flex" style={{ height: "100vh", overflow: "hidden" }}>

        {/* LEFT — Dashboard */}
        <div style={{
          width: 420, minWidth: 420, height: "100vh",
          overflowY: "auto", overflowX: "hidden",
          borderRight: "0.5px solid rgba(201,162,39,0.15)",
          padding: 16,
          display: "flex", flexDirection: "column", gap: 0,
          background: "rgba(10,8,18,0.98)",
        }}>
          {/* Wordmark */}
          <div style={{
            marginBottom: 14, paddingBottom: 12,
            borderBottom: "0.5px solid rgba(201,162,39,0.15)",
            display: "flex", alignItems: "baseline", gap: 10,
          }}>
            <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 500, color: "#C9A227", letterSpacing: "0.15em" }}>
              BULLION DESK
            </span>
            <span style={{ fontFamily: "monospace", fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em" }}>
              XAUUSD INTELLIGENCE
            </span>
          </div>
          <InstitutionalDashboard />
        </div>

        {/* RIGHT — Chat */}
        <div style={{ flex: 1, height: "100vh", overflow: "hidden" }}>
          <ChatPage />
        </div>
      </div>

      {/* ── Mobile: chat default, dashboard as drawer ── */}
      <div className="md:hidden" style={{ height: "100vh", position: "relative", overflow: "hidden" }}>

        {/* Dashboard drawer overlay */}
        {showDashboard && (
          <div
            style={{ position: "absolute", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(3px)" }}
            onClick={() => setShowDashboard(false)}
          />
        )}
        <div style={{
          position: "absolute", top: 0, left: 0, bottom: 0,
          width: "90vw", maxWidth: 400,
          transform: showDashboard ? "translateX(0)" : "translateX(-105%)",
          transition: "transform 0.28s ease",
          zIndex: 50,
          background: "rgba(10,8,18,0.99)",
          overflowY: "auto", padding: 16,
          borderRight: "0.5px solid rgba(201,162,39,0.15)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, paddingBottom: 12, borderBottom: "0.5px solid rgba(201,162,39,0.15)" }}>
            <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 500, color: "#C9A227", letterSpacing: "0.15em" }}>BULLION DESK</span>
            <button onClick={() => setShowDashboard(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 18 }}>✕</button>
          </div>
          <InstitutionalDashboard />
        </div>

        {/* Mobile chat + dashboard toggle button */}
        <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "8px 12px", borderBottom: "0.5px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 10, background: "rgba(10,8,18,0.98)" }}>
            <button
              onClick={() => setShowDashboard(true)}
              style={{
                fontFamily: "monospace", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
                border: "0.5px solid rgba(201,162,39,0.3)", background: "transparent",
                color: "#C9A227", padding: "4px 10px", borderRadius: 6, cursor: "pointer",
              }}
            >
              ⊞ Dashboard
            </button>
            <span style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(255,255,255,0.25)", letterSpacing: "0.1em" }}>XAUUSD</span>
          </div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <ChatPage />
          </div>
        </div>
      </div>
    </>
  );
}
