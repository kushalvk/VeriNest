import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import * as chatApi from '../api/chatApi';
import { getApiError } from '../api/client';
import { MAX_QUESTION_LENGTH } from '../api/chatApi';

interface Message {
  role: 'user' | 'assistant' | 'error';
  text: string;
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, busy]);

  const send = async () => {
    const question = draft.trim();
    if (!question || busy || question.length > MAX_QUESTION_LENGTH) return;
    setMessages((m) => [...m, { role: 'user', text: question }]);
    setDraft('');
    setBusy(true);
    try {
      const answer = await chatApi.askAssistant(question);
      setMessages((m) => [...m, { role: 'assistant', text: answer }]);
    } catch (err) {
      // Distinct states for the failures the backend explains specifically.
      let text = getApiError(err);
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 503) {
          text = 'The assistant is temporarily unavailable — please try again in a little while.';
        } else if (err.response?.status === 429) {
          text = 'You’ve reached the hourly question limit. Please try again later.';
        }
      }
      setMessages((m) => [...m, { role: 'error', text }]);
    } finally {
      setBusy(false);
    }
  };

  const remaining = MAX_QUESTION_LENGTH - draft.length;

  return (
    <>
      {/* floating action button */}
      <button type="button" data-testid="chat-fab" aria-label="Open assistant"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary-600 text-2xl text-white shadow-lg transition hover:bg-primary-700">
        {open ? '✕' : '💬'}
      </button>

      {open && (
        <div data-testid="chat-panel"
          className="fixed bottom-24 right-5 z-30 flex h-[28rem] w-80 flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-2xl sm:w-96">
          <div className="border-b border-line bg-primary-600 px-4 py-3">
            <p className="text-sm font-semibold text-white">Assistant</p>
            <p className="text-xs text-primary-200">
              Answers questions about your own account and activity.
            </p>
          </div>

          <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <p className="mt-6 text-center text-sm text-ink-faint">
                Try: “What’s my trust score?” or “How many applications do I have pending?”
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} data-testid={`chat-${m.role}`}
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                  m.role === 'user'
                    ? 'ml-auto rounded-br-sm bg-primary-600 text-white'
                    : m.role === 'assistant'
                      ? 'mr-auto rounded-bl-sm bg-canvas text-ink'
                      : 'mr-auto rounded-bl-sm border border-amber-200 bg-amber-50 text-amber-800'
                }`}>
                {m.text}
              </div>
            ))}
            {busy && (
              <div className="mr-auto flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-canvas px-3 py-2"
                data-testid="chat-loading">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-faint" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-faint [animation-delay:120ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-faint [animation-delay:240ms]" />
              </div>
            )}
          </div>

          <div className="border-t border-line p-3">
            <div className="flex gap-2">
              <textarea rows={1} data-testid="chat-input"
                className="flex-1 resize-none rounded-md border border-line-strong px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                placeholder="Ask a question…"
                value={draft}
                maxLength={MAX_QUESTION_LENGTH}
                disabled={busy}
                onChange={(e) => setDraft(e.target.value.slice(0, MAX_QUESTION_LENGTH))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }} />
              <button type="button" data-testid="chat-send"
                onClick={() => void send()}
                disabled={busy || !draft.trim()}
                className="rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
                Send
              </button>
            </div>
            {remaining <= 100 && (
              <p data-testid="char-counter"
                className={`mt-1 text-right text-xs ${remaining <= 20 ? 'font-semibold text-red-600' : 'text-ink-faint'}`}>
                {draft.length}/{MAX_QUESTION_LENGTH}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
