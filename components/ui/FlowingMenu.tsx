"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import Link from "next/link";
import "./FlowingMenu.css";

export interface MenuItem {
  text: string;
  link: string;
  marqueeBgColor?: string;
  marqueeTextColor?: string;
  onClick?: (e: React.MouseEvent) => void;
}

interface FlowingMenuProps {
  items: MenuItem[];
  bgColor?: string;
  marqueeBgColor?: string;
  marqueeTextColor?: string;
  borderColor?: string;
  textColor?: string;
}

function FlowingMenuItem({
  item,
  defaultMarqueeBg,
  defaultMarqueeText,
  borderColor,
  textColor,
}: {
  item: MenuItem;
  defaultMarqueeBg: string;
  defaultMarqueeText: string;
  borderColor: string;
  textColor: string;
}) {
  const itemRef = useRef<HTMLDivElement>(null);
  const marqueeInnerRef = useRef<HTMLDivElement>(null);
  const tweenRef = useRef<gsap.core.Tween | null>(null);

  const bgColor = item.marqueeBgColor || defaultMarqueeBg;
  const txtColor = item.marqueeTextColor || defaultMarqueeText;

  useEffect(() => {
    const el = marqueeInnerRef.current;
    if (!el) return;

    const totalWidth = el.scrollWidth / 2;

    tweenRef.current = gsap.to(el, {
      x: -totalWidth,
      duration: 12,
      ease: "none",
      repeat: -1,
    });
    tweenRef.current.pause();

    return () => {
      tweenRef.current?.kill();
    };
  }, []);

  function handleMouseEnter() {
    const el = itemRef.current;
    if (!el) return;
    el.style.backgroundColor = bgColor;
    tweenRef.current?.play();
  }

  function handleMouseLeave() {
    const el = itemRef.current;
    if (!el) return;
    el.style.backgroundColor = "transparent";
    tweenRef.current?.pause();
  }

  const repeats = Array.from({ length: 8 }, (_, i) => i);

  return (
    <div
      ref={itemRef}
      className="flowing-menu-item"
      style={{ borderColor }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Link
        href={item.link}
        className="flowing-menu-item-text"
        style={{ color: textColor }}
        onClick={(e) => {
          if (item.onClick) {
            e.preventDefault();
            item.onClick(e);
          }
        }}
      >
        {item.text}
      </Link>
      <div className="flowing-menu-marquee">
        <div ref={marqueeInnerRef} className="flowing-menu-marquee-inner">
          {repeats.map((i) => (
            <span
              key={i}
              className="flowing-menu-marquee-text"
              style={{ color: txtColor }}
            >
              {item.text}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function FlowingMenu({
  items,
  bgColor = "#07060b",
  marqueeBgColor = "#D4A843",
  marqueeTextColor = "#07060b",
  borderColor = "rgba(212,168,67,0.3)",
  textColor = "#ffffff",
}: FlowingMenuProps) {
  return (
    <div className="flowing-menu" style={{ backgroundColor: bgColor }}>
      {items.map((item) => (
        <FlowingMenuItem
          key={item.text}
          item={item}
          defaultMarqueeBg={marqueeBgColor}
          defaultMarqueeText={marqueeTextColor}
          borderColor={borderColor}
          textColor={textColor}
        />
      ))}
    </div>
  );
}
