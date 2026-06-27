"use client";

export default function AuroraBackground() {
  return (
    <div className="aurora-bg" aria-hidden>
      <div className="aurora-orb aurora-orb--purple-1" />
      <div className="aurora-orb aurora-orb--gold-1" />
      <div className="aurora-orb aurora-orb--purple-2" />
      <div className="aurora-orb aurora-orb--gold-2" />
      <div className="aurora-orb aurora-orb--gold-3" />

      <style jsx>{`
        .aurora-bg {
          position: absolute;
          inset: 0;
          z-index: 0;
          overflow: hidden;
          pointer-events: none;
        }

        .aurora-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(100px);
          will-change: transform;
        }

        @media (prefers-reduced-motion: reduce) {
          .aurora-orb { animation: none !important; }
        }

        .aurora-orb--purple-1 {
          width: 500px;
          height: 500px;
          top: -10%;
          left: -5%;
          background: radial-gradient(circle, rgba(124,58,237,0.50) 0%, transparent 70%);
          opacity: 0.50;
          animation: aurora-drift-1 18s ease-in-out infinite alternate;
        }

        .aurora-orb--gold-1 {
          width: 450px;
          height: 450px;
          bottom: 10%;
          right: -8%;
          background: radial-gradient(circle, rgba(212,168,67,0.45) 0%, transparent 70%);
          opacity: 0.45;
          animation: aurora-drift-2 22s ease-in-out infinite alternate;
        }

        .aurora-orb--purple-2 {
          width: 400px;
          height: 400px;
          top: 50%;
          right: 20%;
          background: radial-gradient(circle, rgba(124,58,237,0.40) 0%, transparent 70%);
          opacity: 0.40;
          animation: aurora-drift-3 20s ease-in-out infinite alternate;
        }

        .aurora-orb--gold-2 {
          width: 400px;
          height: 400px;
          top: 20%;
          left: 30%;
          background: radial-gradient(circle, rgba(212,168,67,0.35) 0%, transparent 70%);
          opacity: 0.40;
          animation: aurora-drift-4 24s ease-in-out infinite alternate;
        }

        .aurora-orb--gold-3 {
          width: 420px;
          height: 420px;
          bottom: 30%;
          left: 10%;
          background: radial-gradient(circle, rgba(212,168,67,0.40) 0%, transparent 70%);
          opacity: 0.30;
          animation: aurora-drift-5 26s ease-in-out infinite alternate;
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
        @keyframes aurora-drift-5 {
          0%   { transform: translate(0, 0); }
          100% { transform: translate(50px, -40px); }
        }
      `}</style>
    </div>
  );
}
