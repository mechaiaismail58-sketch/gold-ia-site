"use client";

import { useState } from "react";
import ChatPage from "@/components/ChatPage";
import InstitutionalDashboard from "@/components/InstitutionalDashboard";
import ResizableSplit from "@/components/ResizableSplit";

export const dynamic = "force-dynamic";

function DashboardPanel() {
  return (
    <div style={{
      height: "100%",
      background: "rgba(10,8,18,0.98)",
      display: "flex", flexDirection: "column",
    }}>
      {/* Wordmark */}
      <div style={{
        padding: "14px 16px 12px",
        borderBottom: "0.5px solid rgba(201,162,39,0.15)",
        display: "flex", alignItems: "baseline", gap: 10,
        flexShrink: 0,
      }}>
        <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 500, color: "#C9A227", letterSpacing: "0.15em" }}>
          BULLION DESK
        </span>
        <span style={{ fontFamily: "monospace", fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em" }}>
          XAUUSD INTELLIGENCE
        </span>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        <InstitutionalDashboard />
      </div>
    </div>
  );
}

export default function ChatRoute() {
  const [showDashboard, setShowDashboard] = useState(false);

  return (
    <>
      {/* ── Desktop: resizable split-screen ── */}
      <div className="hidden md:block" style={{ height: "100vh" }}>
        <ResizableSplit
          left={<DashboardPanel />}
          right={<ChatPage />}
          defaultWidth={420}
          minWidth={280}
          maxWidth={900}
        />
      </div>

      {/* ── Mobile: chat default, dashboard as drawer ── */}
      <div className="md:hidden" style={{ height: "100vh", position: "relative", overflow: "hidden" }}>

        {/* Backdrop */}
        {showDashboard && (
          <div
            style={{ position: "absolute", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(3px)" }}
            onClick={() => setShowDashboard(false)}
          />
        )}

        {/* Drawer */}
        <div style={{
          position: "absolute", top: 0, left: 0, bottom: 0,
          width: "90vw", maxWidth: 400,
          transform: showDashboard ? "translateX(0)" : "translateX(-105%)",
          transition: "transform 0.28s ease",
          zIndex: 50,
          background: "rgba(10,8,18,0.99)",
          overflowY: "auto",
          borderRight: "0.5px solid rgba(201,162,39,0.15)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px 12px", borderBottom: "0.5px solid rgba(201,162,39,0.15)" }}>
            <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 500, color: "#C9A227", letterSpacing: "0.15em" }}>BULLION DESK</span>
            <button onClick={() => setShowDashboard(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 18 }}>✕</button>
          </div>
          <div style={{ padding: 16 }}>
            <InstitutionalDashboard />
          </div>
        </div>

        {/* Mobile: top bar + chat */}
        <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "8px 12px", borderBottom: "0.5px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 10, background: "rgba(10,8,18,0.98)", flexShrink: 0 }}>
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
          <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
            <ChatPage />
          </div>
        </div>
      </div>
    </>
  );
}
