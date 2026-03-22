"use client";

import { createContext, useContext, useState, useCallback } from "react";

export type Msg = {
  role: "user" | "assistant";
  content: string;
  imagePreview?: string | null;
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

const INITIAL_MSG: Msg = {
  role: "assistant",
  content: "Bullion Desk ready. Ask for a gold trade signal (intraday, swing, risk context).",
};

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<Msg[]>([INITIAL_MSG]);
  const [analysisMode, setAnalysisMode] = useState<"deep" | "quick" | "trade_only">("deep");
  const [previousResponseId, setPreviousResponseId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>(() => crypto.randomUUID());

  const startNewChat = useCallback(() => {
    setMessages([INITIAL_MSG]);
    setPreviousResponseId(null);
    setSessionId(crypto.randomUUID());
  }, []);

  const loadHistorySession = useCallback((msgs: Msg[], sid: string) => {
    setMessages(msgs.length > 0 ? msgs : [INITIAL_MSG]);
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
