"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Info,
  Loader2,
  RotateCcw,
  Send,
  Sparkles,
  User,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type Role = "user" | "assistant";

type Message = {
  id: string;
  role: Role;
  content: string;
};

const MAX_MESSAGE_CHARS = 2000;
const MAX_TURNS_SENT = 16;

const STARTERS = [
  "What is my total portfolio worth?",
  "Show my portfolio value by currency.",
  "Which assets have not been updated recently?",
  "What percentage of my portfolio is in each category?",
  "Which assets need more information?",
  "How can I better protect my digital assets?",
  "What should I review to prepare my inheritance plan?",
  "Explain the latest AI insights on my dashboard.",
  "What practical steps can I take to manage my wealth better?",
  "How can I research ways to save more or grow my wealth responsibly?",
];

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

type SendError = {
  message: string;
  code: string | null;
  /** The user text that failed, kept so Retry can resend it exactly once. */
  pending: string;
};

export function VaultChat({ userName }: { userName?: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<SendError | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending, error]);

  async function send(text: string, options?: { resend?: boolean }) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const resend = options?.resend === true;
    const nextMessages = resend
      ? messages
      : [
          ...messages,
          { id: makeId(), role: "user" as const, content: trimmed },
        ];

    if (!resend) {
      setMessages(nextMessages);
      setInput("");
    }
    setError(null);
    setSending(true);

    try {
      const payload = {
        messages: nextMessages
          .slice(-MAX_TURNS_SENT)
          .map((message) => ({ role: message.role, content: message.content })),
      };
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => null)) as {
        reply?: string;
        error?: string;
        code?: string;
      } | null;

      if (!res.ok || !body?.reply) {
        throw {
          message: body?.error ?? "The assistant could not answer. Please retry.",
          code: body?.code ?? null,
        };
      }

      const reply: Message = {
        id: makeId(),
        role: "assistant",
        content: body.reply,
      };
      // Always append after whatever is currently in the transcript.
      setMessages((prev) => [...prev, reply]);
    } catch (cause) {
      // The user's message stays in the transcript; `pending` lets Retry
      // resend the same payload without duplicating the bubble.
      const failure = cause as { message?: string; code?: string };
      setError({
        message: failure?.message ?? "Network error. Please retry.",
        code: failure?.code ?? null,
        pending: trimmed,
      });
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send(input);
    }
  }

  function resetChat() {
    setMessages([]);
    setError(null);
    setInput("");
    textareaRef.current?.focus();
  }

  const notConfigured = error?.code === "not_configured";
  const verificationRequired =
    error?.code === "forbidden" ||
    (error != null && /verification required/i.test(error.message));

  return (
    <div className="flex h-[calc(100dvh-8rem)] min-h-[520px] flex-col">
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          {/* Conversation */}
          <div
            className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6"
            role="log"
            aria-live="polite"
            aria-label="Conversation with the AI Vault assistant"
          >
            {messages.length === 0 ? (
              <div className="mx-auto flex max-w-xl flex-col items-center py-6 text-center">
                <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Sparkles className="size-5" aria-hidden />
                </span>
                <h2 className="mt-3 font-heading text-lg font-semibold">
                  Ask the AI Vault
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {userName ? `Hi ${userName} — ` : ""}ask anything about the
                  assets saved in your vault. Answers use your stored records;
                  values shown are saved valuations, not live market prices.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {STARTERS.map((question) => (
                    <button
                      key={question}
                      type="button"
                      onClick={() => void send(question)}
                      disabled={sending}
                      className="rounded-full border bg-card px-3 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <ul className="space-y-4">
                {messages.map((message) => (
                  <li
                    key={message.id}
                    className={`flex gap-3 ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {message.role === "assistant" && (
                      <span
                        className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                        aria-hidden
                      >
                        <Sparkles className="size-4" />
                      </span>
                    )}
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed sm:max-w-[75%] ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "border bg-card text-foreground"
                      }`}
                    >
                      {message.role === "assistant" && (
                        <Badge
                          variant="secondary"
                          className="mb-1.5 hidden text-[10px] font-normal sm:inline-flex"
                        >
                          AI Vault
                        </Badge>
                      )}
                      <p className="whitespace-pre-wrap break-words">
                        {message.content}
                      </p>
                    </div>
                    {message.role === "user" && (
                      <span
                        className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
                        aria-hidden
                      >
                        <User className="size-4" />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {sending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Thinking through your vault…
              </div>
            )}

            {error && (
              <Alert variant={notConfigured ? "default" : "destructive"}>
                <AlertCircle className="size-4" aria-hidden />
                <AlertTitle>
                  {notConfigured
                    ? "AI chat is not configured"
                    : verificationRequired
                      ? "Verification required"
                      : "Message not sent"}
                </AlertTitle>
                <AlertDescription className="flex flex-wrap items-center gap-3">
                  <span>{error.message}</span>
                  {!notConfigured && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const pending = error.pending;
                        setError(null);
                        void send(pending, { resend: true });
                      }}
                    >
                      Retry
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Composer */}
          <form
            className="border-t bg-muted/30 p-3 sm:p-4"
            onSubmit={(event) => {
              event.preventDefault();
              void send(input);
            }}
          >
            <div className="flex items-end gap-2">
              <label htmlFor="vault-chat-input" className="sr-only">
                Message the AI Vault assistant
              </label>
              <Textarea
                id="vault-chat-input"
                ref={textareaRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your assets, insights or inheritance plan…"
                rows={1}
                maxLength={MAX_MESSAGE_CHARS}
                className="max-h-32 min-h-[44px] resize-none"
                aria-describedby="vault-chat-hint"
              />
              <Button
                type="submit"
                size="icon"
                aria-label="Send message"
                disabled={sending || input.trim().length === 0}
              >
                {sending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Send className="size-4" aria-hidden />
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={resetChat}
                aria-label="Start a new chat"
                disabled={messages.length === 0 && !error}
              >
                <RotateCcw className="size-4" aria-hidden />
              </Button>
            </div>
            <div
              id="vault-chat-hint"
              className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"
            >
              <span className="flex items-center gap-1.5">
                <Info className="size-3.5" aria-hidden />
                Educational information, not financial advice. History stays in
                this browser tab only.
              </span>
              <span>
                {input.length}/{MAX_MESSAGE_CHARS} · Enter to send, Shift+Enter
                for a new line
              </span>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
