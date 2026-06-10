"use client";

import { createContext, useContext, useState, useCallback } from "react";

export type Msg = {
  role: "user" | "assistant";
  content: string;
  imagePreview?: string | null;
  trade_id?: string | null;
};

type ChatContextValue = {
  messages: Msg[];
  setMessages: React.Dispatch<React.SetStateAction<Msg[]>>;
  analysisMode: "deep" | "quick" | "trade_only";
  setAnalysisMode: (mode: "deep" | "quick" | "trade_only") => void;
  previousResponseId: string | null;
  setPreviousResponseId: (id: string | null) => void;
  sessionId: string;
  startNewChat: () => void;
  loadHistorySession: (msgs: Msg[], sid: string) => void;
};

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [analysisMode, setAnalysisModeRaw] = useState<"deep" | "quick" | "trade_only">("deep");
  const [previousResponseId, setPreviousResponseId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>(() => crypto.randomUUID());

  // Reset the OpenAI conversation thread whenever the mode changes.
  // The Responses API ties previous_response_id to a specific system prompt —
  // sending a different prompt against an existing thread causes a 500.
  const setAnalysisMode = useCallback((mode: "deep" | "quick" | "trade_only") => {
    setAnalysisModeRaw(mode);
    setPreviousResponseId(null);
  }, []);

  const startNewChat = useCallback(() => {
    setMessages([]);
    setPreviousResponseId(null);
    setSessionId(crypto.randomUUID());
  }, []);

  const loadHistorySession = useCallback((msgs: Msg[], sid: string) => {
    setMessages(msgs);
    setPreviousResponseId(null);
    setSessionId(sid);
  }, []);

  return (
    <ChatContext.Provider
      value={{
        messages,
        setMessages,
        analysisMode,
        setAnalysisMode,
        previousResponseId,
        setPreviousResponseId,
        sessionId,
        startNewChat,
        loadHistorySession,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be used inside ChatProvider");
  return ctx;
}
