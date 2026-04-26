"use client";

import { useState } from "react";
import AppRail     from "@/components/AppRail";
import AppSidebar  from "@/components/AppSidebar";
import AppMain     from "@/components/AppMain";
import ChatOverlay from "@/components/ChatOverlay";

export default function DashboardPage() {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    // position:fixed + inset:0 escapes the root layout's max-width container
    <div style={{
      position: "fixed", inset: 0, zIndex: 50,
      display: "grid",
      gridTemplateColumns: "64px 260px 1fr",
      height: "100vh",
      overflow: "hidden",
      background: "#0A0A0A",
    }}>
      {/* Responsive: on mobile collapse to single column */}
      <style>{`
        @media (max-width: 768px) {
          .dash-grid { grid-template-columns: 1fr !important; }
          .dash-rail  { display: none !important; }
          .dash-sidebar { display: none !important; }
          .dash-bottom { display: flex !important; }
        }
      `}</style>

      {/* Rail */}
      <div className="dash-rail">
        <AppRail chatOpen={chatOpen} onChatToggle={() => setChatOpen(v => !v)} />
      </div>

      {/* Sidebar */}
      <div className="dash-sidebar" style={{ minWidth: 0 }}>
        <AppSidebar />
      </div>

      {/* Main */}
      <AppMain onChatOpen={() => setChatOpen(true)} />

      {/* Chat overlay */}
      <ChatOverlay isOpen={chatOpen} onClose={() => setChatOpen(false)} />

      {/* Mobile bottom tab bar (hidden on desktop) */}
      <div
        className="dash-bottom"
        style={{
          display: "none",
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 55,
          height: 56, background: "#07050F",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          alignItems: "center", justifyContent: "space-around",
          padding: "0 8px",
        }}
      >
        {[
          { label: "Home",    href: "/dashboard" },
          { label: "Console", action: () => setChatOpen(v => !v) },
          { label: "Market",  href: "/market" },
          { label: "History", href: "/history" },
        ].map((t) => (
          t.action ? (
            <button key={t.label} onClick={t.action} style={{
              background: "none", border: "none", color: chatOpen ? "#D4AF37" : "rgba(255,255,255,0.35)",
              fontSize: 10, fontFamily: "monospace", cursor: "pointer", padding: "8px 12px", textTransform: "uppercase" as const, letterSpacing: "0.08em",
            }}>{t.label}</button>
          ) : (
            <a key={t.label} href={t.href} style={{
              color: "rgba(255,255,255,0.35)", fontSize: 10, fontFamily: "monospace",
              textDecoration: "none", padding: "8px 12px", textTransform: "uppercase" as const, letterSpacing: "0.08em",
            }}>{t.label}</a>
          )
        ))}
      </div>
    </div>
  );
}
