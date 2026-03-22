"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const components: Components = {
  // H2 — section headers (## SECTION)
  h2({ children }) {
    return (
      <h2 className="text-[13px] font-semibold text-white/90 tracking-[0.06em] uppercase mt-5 mb-1.5 first:mt-0">
        {children}
      </h2>
    );
  },
  // H3 — sub-section headers (### Sub)
  h3({ children }) {
    return (
      <h3 className="text-[12px] font-semibold text-white/75 tracking-[0.04em] uppercase mt-3.5 mb-1 first:mt-0">
        {children}
      </h3>
    );
  },
  // Bold text
  strong({ children }) {
    return (
      <strong className="font-semibold text-white/90">{children}</strong>
    );
  },
  // Italic
  em({ children }) {
    return <em className="italic text-white/70">{children}</em>;
  },
  // Paragraph
  p({ children }) {
    return (
      <p className="leading-[1.75] text-[13px] text-white/75 mb-2 last:mb-0">
        {children}
      </p>
    );
  },
  // Unordered list
  ul({ children }) {
    return (
      <ul className="mb-2 space-y-0.5 pl-4 list-disc marker:text-white/25 last:mb-0">{children}</ul>
    );
  },
  // Ordered list
  ol({ children }) {
    return (
      <ol className="mb-2 space-y-0.5 pl-4 list-decimal marker:text-white/30 last:mb-0">{children}</ol>
    );
  },
  // List item
  li({ children }) {
    return (
      <li className="text-[13px] text-white/75 leading-[1.7]">
        {children}
      </li>
    );
  },
  // Horizontal rule — subtle section separator
  hr() {
    return (
      <div className="my-3 h-px w-full bg-white/[0.07]" role="separator" />
    );
  },
  // Inline code
  code({ children }) {
    return (
      <code className="rounded px-1.5 py-0.5 bg-white/[0.06] text-[12px] text-white/80 font-mono">
        {children}
      </code>
    );
  },
  // Block / pre
  pre({ children }) {
    return (
      <pre className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-3 text-[12px] text-white/70 font-mono overflow-x-auto mb-2 leading-relaxed">
        {children}
      </pre>
    );
  },
  // Blockquote
  blockquote({ children }) {
    return (
      <blockquote className="border-l-2 border-white/20 pl-3 my-2 text-white/60 italic">
        {children}
      </blockquote>
    );
  },
};

type Props = { content: string };

export default function MarkdownMessage({ content }: Props) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  );
}
