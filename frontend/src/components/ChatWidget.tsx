import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import {
  Bot,
  CheckCircle2,
  HelpCircle,
  Home,
  MessageCircle,
  Send,
  Sparkles,
  X,
} from 'lucide-react';

import * as chatApi from '../api/chatApi';
import { getApiError } from '../api/client';
import { MAX_QUESTION_LENGTH } from '../api/chatApi';

interface Message {
  role: 'user' | 'assistant' | 'error';
  text: string;
}


const QUICK_QUESTIONS = [
  {
    label: 'Trust score',
    question: "What's my trust score?",
    Icon: Sparkles,
  },
  {
    label: 'Applications',
    question: 'How many applications do I have pending?',
    Icon: Home,
  },
  {
    label: 'Documents',
    question: 'What is the status of my documents?',
    Icon: CheckCircle2,
  },
];


export default function ChatWidget() {

  const [open, setOpen] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);

  const [draft, setDraft] = useState('');

  const [busy, setBusy] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);


  /* =============================================================
     AUTO SCROLL
  ============================================================= */

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, busy]);


  /* =============================================================
     SEND MESSAGE
  ============================================================= */

  const send = async (questionOverride?: string) => {

    const question = (questionOverride ?? draft).trim();

    if (
        !question ||
        busy ||
        question.length > MAX_QUESTION_LENGTH
    ) {
      return;
    }


    setMessages((m) => [
      ...m,
      {
        role: 'user',
        text: question,
      },
    ]);


    setDraft('');

    setBusy(true);


    try {

      const answer = await chatApi.askAssistant(question);

      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          text: answer,
        },
      ]);

    } catch (err) {

      let text = getApiError(err);


      if (axios.isAxiosError(err)) {

        if (err.response?.status === 503) {

          text =
              'NestMate is temporarily unavailable. Please try again in a little while.';

        } else if (err.response?.status === 429) {

          text =
              'You’ve reached the hourly question limit. Please try again later.';

        }

      }


      setMessages((m) => [
        ...m,
        {
          role: 'error',
          text,
        },
      ]);

    } finally {

      setBusy(false);

    }
  };


  const remaining =
      MAX_QUESTION_LENGTH - draft.length;


  return (
      <>
        {/* =========================================================
          FLOATING BUTTON
      ========================================================== */}

        <button
            type="button"
            data-testid="chat-fab"
            aria-label={
              open
                  ? 'Close NestMate'
                  : 'Open NestMate'
            }
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="group fixed bottom-5 right-5 z-50 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-600 via-indigo-600 to-violet-700 text-white shadow-[0_12px_35px_rgba(79,70,229,0.35)] transition-all duration-300 hover:-translate-y-1 hover:scale-105 hover:shadow-[0_18px_45px_rgba(79,70,229,0.45)] focus:outline-none focus:ring-4 focus:ring-primary-500/20"
        >

          {/* Glow */}
          <span className="absolute inset-0 rounded-2xl bg-primary-400/20 opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-100" />


          {/* Icon */}
          <span className="relative">

          {open ? (
              <X
                  className="h-6 w-6 transition-transform duration-300 group-hover:rotate-90"
                  aria-hidden="true"
              />
          ) : (
              <MessageCircle
                  className="h-7 w-7 transition-transform duration-300 group-hover:scale-110"
                  aria-hidden="true"
              />
          )}

        </span>


          {/* Online indicator */}
          {!open && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-emerald-500 dark:border-slate-950">

            <span className="h-1.5 w-1.5 rounded-full bg-white" />

          </span>
          )}

        </button>


        {/* =========================================================
          CHAT PANEL
      ========================================================== */}

        {open && (

            <div
                data-testid="chat-panel"
                className="fixed bottom-24 right-4 z-50 flex h-[min(42rem,calc(100vh-8rem))] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_25px_80px_rgba(15,23,42,0.18)] transition-colors duration-300 dark:border-white/10 dark:bg-slate-900 sm:right-5 sm:w-96"
            >


              {/* =====================================================
              HEADER
          ====================================================== */}

              <div className="relative overflow-hidden bg-gradient-to-br from-primary-600 via-indigo-600 to-violet-700 px-5 py-4 text-white">

                {/* Background decoration */}
                <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />

                <div className="pointer-events-none absolute -bottom-16 -left-10 h-32 w-32 rounded-full bg-white/5 blur-2xl" />


                <div className="relative flex items-center gap-3">

                  {/* Avatar */}
                  <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 shadow-lg ring-1 ring-inset ring-white/20 backdrop-blur">

                    <Bot
                        className="h-6 w-6"
                        aria-hidden="true"
                    />

                    <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-primary-600 bg-emerald-400" />

                  </div>


                  <div className="min-w-0 flex-1">

                    <div className="flex items-center gap-2">

                      <p className="text-sm font-black tracking-tight">
                        NestMate
                      </p>

                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary-100">
                    AI
                  </span>

                    </div>

                    <p className="mt-0.5 text-[11px] text-primary-100">
                      Your VeriNest rental companion
                    </p>

                  </div>


                  {/* Close */}
                  <button
                      type="button"
                      aria-label="Close NestMate"
                      onClick={() => setOpen(false)}
                      className="flex h-8 w-8 items-center justify-center rounded-xl text-white/70 transition hover:bg-white/10 hover:text-white"
                  >

                    <X
                        className="h-4 w-4"
                        aria-hidden="true"
                    />

                  </button>

                </div>

              </div>


              {/* =====================================================
              CHAT BODY
          ====================================================== */}

              <div
                  ref={scrollRef}
                  className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50/70 p-4 dark:bg-slate-950/50"
              >

                {/* Empty state */}
                {messages.length === 0 && (

                    <div className="flex min-h-full flex-col justify-center py-5">

                      {/* Bot icon */}
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-primary-50 to-indigo-100 text-primary-600 shadow-sm ring-1 ring-primary-100 dark:from-primary-500/10 dark:to-indigo-500/10 dark:text-primary-300 dark:ring-primary-500/20">

                        <Bot className="h-8 w-8" />

                      </div>


                      <div className="mt-5 text-center">

                        <h3 className="text-base font-black text-slate-900 dark:text-white">
                          Hi! I'm NestMate 👋
                        </h3>

                        <p className="mx-auto mt-2 max-w-[270px] text-xs leading-5 text-slate-500 dark:text-slate-400">
                          I can help you understand your VeriNest account,
                          applications, documents and trust score.
                        </p>

                      </div>


                      {/* Quick questions */}
                      <div className="mt-6 space-y-2">

                        <p className="px-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                          Try asking
                        </p>


                        {QUICK_QUESTIONS.map(
                            ({ label, question, Icon }) => (

                                <button
                                    key={label}
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void send(question)}
                                    className="group flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary-200 hover:bg-primary-50/50 hover:shadow-sm dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-primary-500/20 dark:hover:bg-primary-500/5"
                                >

                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600 transition group-hover:bg-primary-100 dark:bg-primary-500/10 dark:text-primary-300 dark:group-hover:bg-primary-500/15">

                          <Icon className="h-4 w-4" />

                        </span>


                                  <span className="min-w-0 flex-1">

                          <span className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                            {label}
                          </span>

                          <span className="mt-0.5 block truncate text-[10px] text-slate-400">
                            {question}
                          </span>

                        </span>


                                  <ArrowRightIcon />

                                </button>

                            )
                        )}

                      </div>

                    </div>
                )}


                {/* =================================================
                MESSAGES
            ================================================== */}

                {messages.map((m, i) => (

                    <div
                        key={i}
                        data-testid={`chat-${m.role}`}
                        className={`flex ${
                            m.role === 'user'
                                ? 'justify-end'
                                : 'justify-start'
                        }`}
                    >

                      <div
                          className={`group max-w-[88%] ${
                              m.role === 'user'
                                  ? ''
                                  : 'flex items-start gap-2'
                          }`}
                      >

                        {/* Assistant avatar */}
                        {m.role !== 'user' && (

                            <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-300">

                      {m.role === 'error' ? (
                          <HelpCircle className="h-3.5 w-3.5" />
                      ) : (
                          <Bot className="h-3.5 w-3.5" />
                      )}

                    </span>

                        )}


                        <div
                            className={`whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-6 shadow-sm ${
                                m.role === 'user'
                                    ? 'rounded-br-md bg-gradient-to-br from-primary-600 to-indigo-600 text-white'
                                    : m.role === 'assistant'
                                        ? 'rounded-bl-md border border-slate-200/80 bg-white text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200'
                                        : 'rounded-bl-md border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200'
                            }`}
                        >
                          {m.text}
                        </div>

                      </div>

                    </div>

                ))}


                {/* =================================================
                LOADING
            ================================================== */}

                {busy && (

                    <div
                        className="flex items-start gap-2"
                        data-testid="chat-loading"
                    >

                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-300">

                  <Bot className="h-3.5 w-3.5" />

                </span>


                      <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-slate-200/80 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-slate-900">

                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary-400" />

                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary-400 [animation-delay:120ms]" />

                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary-400 [animation-delay:240ms]" />

                      </div>

                    </div>

                )}

              </div>


              {/* =====================================================
              INPUT
          ====================================================== */}

              <div className="border-t border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-900">

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-1.5 transition focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-500/10 dark:border-white/10 dark:bg-slate-950/60">

                  <div className="flex items-end gap-2">

                <textarea
                    rows={1}
                    data-testid="chat-input"
                    className="max-h-24 min-h-[40px] flex-1 resize-none bg-transparent px-2.5 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500"
                    placeholder="Ask NestMate something…"
                    value={draft}
                    maxLength={MAX_QUESTION_LENGTH}
                    disabled={busy}
                    onChange={(e) =>
                        setDraft(
                            e.target.value.slice(
                                0,
                                MAX_QUESTION_LENGTH
                            )
                        )
                    }
                    onKeyDown={(e) => {

                      if (
                          e.key === 'Enter' &&
                          !e.shiftKey
                      ) {

                        e.preventDefault();

                        void send();

                      }

                    }}
                />


                    <button
                        type="button"
                        data-testid="chat-send"
                        aria-label="Send message"
                        onClick={() => void send()}
                        disabled={busy || !draft.trim()}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600 to-indigo-600 text-white shadow-md shadow-primary-600/20 transition-all duration-200 hover:scale-105 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
                    >

                      <Send className="h-4 w-4" />

                    </button>

                  </div>


                  {/* Character counter */}
                  {remaining <= 100 && (

                      <div className="px-2.5 pb-1 pt-0.5">

                        <p
                            data-testid="char-counter"
                            className={`text-right text-[10px] ${
                                remaining <= 20
                                    ? 'font-bold text-red-500'
                                    : 'text-slate-400'
                            }`}
                        >
                          {draft.length}/{MAX_QUESTION_LENGTH}
                        </p>

                      </div>

                  )}

                </div>


                <p className="mt-2 text-center text-[9px] text-slate-400 dark:text-slate-500">
                  NestMate only answers questions about your VeriNest account.
                </p>

              </div>

            </div>
        )}

      </>
  );
}


/* ================================================================
   SMALL ARROW COMPONENT
================================================================ */

function ArrowRightIcon() {
  return (
      <span className="text-slate-300 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary-500">
      →
    </span>
  );
}