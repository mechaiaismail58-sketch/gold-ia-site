"use client";
import { motion } from "framer-motion";

type Props = { text: string; className?: string; delay?: number };

export default function TextReveal({ text, className, delay = 0 }: Props) {
  const words = text.split(" ");
  return (
    <motion.h2
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
    >
      {words.map((word, i) => (
        <motion.span
          key={i}
          className="inline-block mr-[0.3em]"
          variants={{
            hidden: { opacity: 0, y: 30, filter: "blur(4px)" },
            visible: { opacity: 1, y: 0, filter: "blur(0px)" },
          }}
          transition={{ duration: 0.5, delay: delay + i * 0.06, ease: [0.25, 0.1, 0.25, 1] }}
        >
          {word}
        </motion.span>
      ))}
    </motion.h2>
  );
}
