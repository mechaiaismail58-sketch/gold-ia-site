"use client";

interface AvatarProps {
  src?: string | null;
  size?: number;
  className?: string;
}

export default function Avatar({ src, size = 32, className = "" }: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt="Avatar"
        width={size}
        height={size}
        className={`rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  // Default: purple silhouette on white background
  return (
    <div
      className={`rounded-full bg-white flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: size * 0.7, height: size * 0.7 }}
      >
        {/* Head */}
        <circle cx="16" cy="11" r="5" fill="#7c3aed" />
        {/* Body */}
        <path
          d="M6 27c0-5.523 4.477-10 10-10s10 4.477 10 10"
          fill="#7c3aed"
        />
      </svg>
    </div>
  );
}
