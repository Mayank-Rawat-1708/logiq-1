import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Bot, User, Sparkles, FileText } from 'lucide-react';
import { chatApi } from '../../api/chat';
import { useAuthStore } from '../../store/authStore';
import { Spinner } from '../ui/Spinner';
import { LevelBadge } from '../ui/Badge';
import type { ChatMessage, LogLevel } from '../../types';

const SUGGESTED_PROMPTS = [
  'Why did the server crash?',
  'Show me all database errors',
  'What is the most common error pattern?',
  'Summarize the anomalies detected',
];

interface ContextEntry {
  line_number: number;
  level: string;
  message: string;
}

interface ChatPanelProps {
  sessionId: string;
  onLineClick?: (lineNumber: number) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ sessionId, onLineClick }) => {
  const accessToken = useAuthStore((s) => s.accessToken)!;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [contextEntries, setContextEntries] = useState<ContextEntry[]>([]);
  const [initialized, setInitialized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load chat history on mount
  useEffect(() => {
    if (initialized) return;
    setInitialized(true);
    chatApi.getChatHistory(sessionId, accessToken).then((history) => {
      if (history.length > 0) setMessages(history);
    });
  }, [sessionId, accessToken, initialized]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || streaming) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setStreamingContent('');
    setStreaming(true);
    setContextEntries([]);

    let accumulated = '';

    await chatApi.streamMessage(
      sessionId,
      text,
      messages,
      accessToken,
      (token) => {
        accumulated += token;
        setStreamingContent(accumulated);
      },
      (ctx) => {
        setContextEntries(ctx);
        setMessages((prev) => [...prev, { role: 'assistant', content: accumulated }]);
        setStreamingContent('');
        setStreaming(false);
      },
      (err) => {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `Error: ${err}` },
        ]);
        setStreamingContent('');
        setStreaming(false);
      }
    );
  }, [sessionId, messages, accessToken, streaming]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // Parse line citations from assistant messages and make them clickable
  const renderAssistantContent = (content: string) => {
    // Replace "Line XXXX" with clickable spans
    const parts = content.split(/(Line \d+)/g);
    return (
      <div className="prose prose-invert prose-sm max-w-none">
        <ReactMarkdown
          components={{
            p: ({ children }) => <p className="mb-2 last:mb-0 text-[#F1F5F9] text-sm leading-relaxed">{children}</p>,
            code: ({ children }) => (
              <code className="bg-[#0A0A0F] border border-[#2A2A3A] rounded px-1 py-0.5 font-mono text-xs text-[#22D3EE]">
                {children}
              </code>
            ),
            pre: ({ children }) => (
              <pre className="bg-[#0A0A0F] border border-[#2A2A3A] rounded-lg p-3 overflow-x-auto mb-2">
                {children}
              </pre>
            ),
            ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
            li: ({ children }) => <li className="text-sm text-[#F1F5F9]">{children}</li>,
            strong: ({ children }) => <strong className="text-[#F1F5F9] font-semibold">{children}</strong>,
            h3: ({ children }) => <h3 className="text-[#F1F5F9] font-mono font-semibold text-sm mb-1 mt-3">{children}</h3>,
          }}
        >
          {content.replace(/Line (\d+)/g, (match, num) => `**${match}**`)}
        </ReactMarkdown>
        {/* Overlay clickable line references */}
        <div className="mt-1 flex flex-wrap gap-1">
          {[...content.matchAll(/Line (\d+)/g)].map(([, num], i) => (
            <button
              key={i}
              onClick={() => onLineClick?.(parseInt(num))}
              className="text-xs font-mono text-[#6366F1] hover:text-[#818CF8] underline decoration-dotted"
            >
              → Line {num}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const isEmpty = messages.length === 0 && !streaming;

  return (
    <div className="flex h-full gap-4">
      {/* Chat area — 60% */}
      <div className="flex flex-col flex-[3] min-w-0 bg-[#111118] border border-[#2A2A3A] rounded-xl overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isEmpty && (
            <div className="flex flex-col items-center justify-center h-full py-12 gap-6">
              <div className="w-12 h-12 bg-[#6366F1]/20 rounded-full flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-[#6366F1]" />
              </div>
              <div className="text-center">
                <h3 className="font-mono font-semibold text-[#F1F5F9] mb-1">Ask anything about your logs</h3>
                <p className="text-xs text-[#475569]">Powered by GPT-4o mini + semantic search over your log data</p>
              </div>
              <div className="grid grid-cols-2 gap-2 w-full max-w-md">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    className="text-xs text-left px-3 py-2.5 bg-[#1A1A24] border border-[#2A2A3A] rounded-lg text-[#94A3B8] hover:border-[#6366F1]/50 hover:text-[#F1F5F9] transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 bg-[#6366F1]/20 rounded-full flex items-center justify-center shrink-0 mt-1">
                  <Bot className="w-4 h-4 text-[#6366F1]" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-[#6366F1]/20 border border-[#6366F1]/30 text-[#F1F5F9] text-sm'
                    : 'bg-[#1A1A24] border border-[#2A2A3A]'
                }`}
              >
                {msg.role === 'user' ? (
                  <p className="text-sm font-medium">{msg.content}</p>
                ) : (
                  renderAssistantContent(msg.content)
                )}
              </div>
              {msg.role === 'user' && (
                <div className="w-7 h-7 bg-[#2A2A3A] rounded-full flex items-center justify-center shrink-0 mt-1">
                  <User className="w-4 h-4 text-[#94A3B8]" />
                </div>
              )}
            </div>
          ))}

          {/* Streaming response */}
          {streaming && (
            <div className="flex gap-3 justify-start">
              <div className="w-7 h-7 bg-[#6366F1]/20 rounded-full flex items-center justify-center shrink-0 mt-1">
                <Bot className="w-4 h-4 text-[#6366F1]" />
              </div>
              <div className="max-w-[80%] bg-[#1A1A24] border border-[#2A2A3A] rounded-xl px-4 py-3">
                {streamingContent ? (
                  <div className="text-sm text-[#F1F5F9] leading-relaxed">
                    {streamingContent}
                    <span className="inline-block w-1.5 h-4 bg-[#6366F1] animate-pulse ml-0.5 align-middle rounded-sm" />
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Spinner size="sm" />
                    <span className="text-xs text-[#475569]">Thinking…</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-[#2A2A3A] p-3">
          <div className="flex items-end gap-2 bg-[#1A1A24] border border-[#2A2A3A] rounded-xl px-3 py-2 focus-within:border-[#6366F1]/50 transition-colors">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your logs… (Enter to send, Shift+Enter for newline)"
              rows={1}
              className="flex-1 bg-transparent text-sm text-[#F1F5F9] placeholder-[#475569] resize-none outline-none max-h-32 font-sans"
              style={{ lineHeight: '1.5' }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || streaming}
              className="flex items-center justify-center w-8 h-8 bg-[#6366F1] hover:bg-[#818CF8] disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-colors shrink-0"
            >
              {streaming ? <Spinner size="sm" className="border-white border-t-transparent" /> : <Send className="w-3.5 h-3.5 text-white" />}
            </button>
          </div>
          <p className="text-xs text-[#475569] mt-1.5 px-1">
            ↵ Send · Shift+↵ New line · Powered by GPT-4o mini with RAG
          </p>
        </div>
      </div>

      {/* Context panel — 40% */}
      <div className="flex-[2] min-w-0 bg-[#111118] border border-[#2A2A3A] rounded-xl overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-[#2A2A3A]">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#475569]" />
            <span className="font-mono text-sm font-semibold text-[#94A3B8]">Referenced Logs</span>
            {contextEntries.length > 0 && (
              <span className="text-xs text-[#475569] bg-[#1A1A24] px-1.5 py-0.5 rounded-full border border-[#2A2A3A]">
                {contextEntries.length}
              </span>
            )}
          </div>
          <p className="text-xs text-[#475569] mt-0.5">Log entries used as context for the last response</p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {contextEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <FileText className="w-10 h-10 text-[#2A2A3A] mb-3" />
              <p className="text-xs text-[#475569]">Context entries will appear here after each AI response</p>
            </div>
          ) : (
            contextEntries.map((entry, i) => (
              <div
                key={i}
                onClick={() => onLineClick?.(entry.line_number)}
                className="bg-[#1A1A24] border border-[#2A2A3A] rounded-lg px-3 py-2 cursor-pointer hover:border-[#6366F1]/40 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs text-[#475569]">Line {entry.line_number}</span>
                  <LevelBadge level={entry.level as LogLevel} />
                </div>
                <p className="font-mono text-xs text-[#94A3B8] line-clamp-2">{entry.message}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
