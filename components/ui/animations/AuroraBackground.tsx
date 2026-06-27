"use client";

export default function AuroraBackground() {
  return (
    <div className="aurora-bg" aria-hidden>
      <div className="aurora-orb aurora-orb--purple-1" />
      <div className="aurora-orb aurora-orb--gold-1" />
      <div className="aurora-orb aurora-orb--purple-2" />
      <div className="aurora-orb aurora-orb--gold-2" />

      <style jsx>{`
        .aurora-bg {
          position: absolute;
          inset: 0;
          z-index: -1;
          overflow: hidden;
          pointer-events: none;
        }

        .aurora-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          will-change: transform;
        }

        @media (prefers-reduced-motion: reduce) {
          .aurora-orb { animation: none !important; }
        }

        .aurora-orb--purple-1 {
          width: 420px;
          height: 420px;
          top: -10%;
          left: -5%;
          background: radial-gradient(circle, rgba(124,58,237,0.25) 0%, transparent 70%);
          opacity: 0.25;
          animation: aurora-drift-1 18s ease-in-out infinite alternate;
        }

        .aurora-orb--gold-1 {
          width: 360px;
          height: 360px;
          bottom: 10%;
          right: -8%;
          background: radial-gradient(circle, rgba(212,168,67,0.20) 0%, transparent 70%);
          opacity: 0.20;
          animation: aurora-drift-2 22s ease-in-out infinite alternate;
        }

        .aurora-orb--purple-2 {
          width: 300px;
          height: 300px;
          top: 50%;
          right: 20%;
          background: radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%);
          opacity: 0.15;
          animation: aurora-drift-3 20s ease-in-out infinite alternate;
        }

        .aurora-orb--gold-2 {
          width: 280px;
          height: 280px;
          top: 20%;
          left: 30%;
          background: radial-gradient(circle, rgba(212,168,67,0.15) 0%, transparent 70%);
          opacity: 0.18;
          animation: aurora-drift-4 24s ease-in-out infinite alternate;
        }

        @keyframes aurora-drift-1 {
          0%   { transform: translate(0, 0); }
          100% { transform: translate(60px, 40px); }
        }
        @keyframes aurora-drift-2 {
          0%   { transform: translate(0, 0); }
          100% { transform: translate(-50px, -30px); }
        }
        @keyframes aurora-drift-3 {
          0%   { transform: translate(0, 0); }
          100% { transform: translate(40px, -50px); }
        }
        @keyframes aurora-drift-4 {
          0%   { transform: translate(0, 0); }
          100% { transform: translate(-30px, 60px); }
        }
      `}</style>
    </div>
  );
}
