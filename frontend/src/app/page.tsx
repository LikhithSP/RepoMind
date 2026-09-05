'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Terminal, GitBranch, RefreshCw, Layers, PlusCircle, ArrowRight, ShieldCheck, Sparkles, Database, Sun, Moon } from 'lucide-react';
import { ChatMessage, SourceChunk, TraceInfo } from '../lib/types';
import { MessageBubble } from '../components/MessageBubble';
import { ModelSelector } from '../components/ModelSelector';
import { RepoIngestModal } from '../components/RepoIngestModal';

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [provider, setProvider] = useState('groq');
  const [model, setModel] = useState('qwen/qwen3.8-27b');
  const [repoName, setRepoName] = useState('psf/requests');
  const [commitSha, setCommitSha] = useState('8d3f9b2');
  const [indexedPoints, setIndexedPoints] = useState<number | null>(null);
  const [isIngestOpen, setIsIngestOpen] = useState(false);

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('repomind_theme') as 'dark' | 'light' | null;
      const initial = savedTheme || 'dark';
      setTheme(initial);
      document.documentElement.setAttribute('data-theme', initial);
    } catch (_) {}
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    try {
      localStorage.setItem('repomind_theme', nextTheme);
    } catch (_) {}
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load custom repository from localStorage if available
  useEffect(() => {
    try {
      const savedRepo = localStorage.getItem('coderag_custom_repo');
      if (savedRepo) {
        const parsed = JSON.parse(savedRepo);
        if (parsed.repoName) setRepoName(parsed.repoName);
        if (parsed.commitSha) setCommitSha(parsed.commitSha);
        if (parsed.indexedPoints) setIndexedPoints(parsed.indexedPoints);
      }
    } catch (_) {}
  }, []);

  // Fetch health and index status from backend to sync real active state
  useEffect(() => {
    fetch('http://localhost:8000/health')
      .then((res) => res.json())
      .then((data) => {
        if (data.indexed_points !== undefined && data.indexed_points !== null) {
          setIndexedPoints(data.indexed_points);
        }
        if (data.repo_name) {
          setRepoName(data.repo_name);
        }
        if (data.commit_sha) {
          setCommitSha(data.commit_sha);
        }
        // Save synced active repository
        try {
          localStorage.setItem('coderag_custom_repo', JSON.stringify({
            repoName: data.repo_name || repoName,
            commitSha: data.commit_sha || commitSha,
            indexedPoints: data.indexed_points
          }));
        } catch (_) {}
      })
      .catch(() => {
        // Fallback demo state if backend not running
      });
  }, []);

  const handleSubmit = async (queryText?: string) => {
    const query = (queryText || input).trim();
    if (!query || isStreaming) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: query,
    };

    const assistantPlaceholderId = (Date.now() + 1).toString();
    const assistantMessage: ChatMessage = {
      id: assistantPlaceholderId,
      role: 'assistant',
      content: '',
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput('');
    setIsStreaming(true);

    try {
      const response = await fetch('http://localhost:8000/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          provider,
          model,
          top_k: 5
        }),
      });

      if (!response.body) {
        throw new Error('No readable body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop() || '';

        for (const block of blocks) {
          if (!block.trim()) continue;
          const blockLines = block.split(/\r?\n/);
          let eventType = '';
          let eventData = '';

          for (const line of blockLines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('event:')) {
              eventType = trimmedLine.replace('event:', '').trim();
            } else if (trimmedLine.startsWith('data:')) {
              const dataIdx = line.indexOf('data:');
              eventData = line.slice(dataIdx + 5).trim();
            }
          }

          if (eventType === 'token' && eventData) {
            try {
              const parsed = JSON.parse(eventData);
              const tokenText = parsed.token || '';
              accumulatedContent += tokenText;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantPlaceholderId
                    ? { ...msg, content: accumulatedContent, isStreaming: true }
                    : msg
                )
              );
            } catch (e) {}
          } else if (eventType === 'done' && eventData) {
            try {
              const parsed = JSON.parse(eventData);
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantPlaceholderId
                    ? {
                        ...msg,
                        content: parsed.answer || accumulatedContent,
                        sources: parsed.sources || [],
                        trace: parsed.trace,
                        isStreaming: false,
                      }
                    : msg
                )
              );
            } catch (e) {}
          }
        }
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantPlaceholderId
            ? { ...msg, isStreaming: false }
            : msg
        )
      );
    } catch (err) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantPlaceholderId
            ? {
                ...msg,
                content: `Error communicating with CodeRAG backend: ${(err as Error).message}. Ensure \`uvicorn coderag.api:app\` is running on port 8000.`,
                isStreaming: false,
              }
            : msg
        )
      );
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="ambient-bg" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Top Navbar */}
      <header className="glass-panel" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 24px',
        borderBottom: '1px solid var(--border-color)',
        zIndex: 10,
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--accent-cyan-subtle)',
            border: '1px solid var(--accent-cyan)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-cyan)',
            boxShadow: '0 0 12px var(--accent-cyan-glow)',
          }}>
            <Terminal size={15} strokeWidth={2.5} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 700, fontSize: '14.5px', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              RepoMind
            </span>
            <span style={{
              fontSize: '10.5px',
              fontWeight: 500,
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-muted)',
              padding: '1px 6px',
              borderRadius: '4px',
              fontFamily: 'var(--font-mono)',
            }}>
              v0.1
            </span>
          </div>
        </div>

        {/* Action Controls & Active Repo Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Active Repo Badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 10px',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '12px',
          }}>
            <GitBranch size={13} color="var(--accent-emerald)" />
            <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{repoName}</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: '11px' }}>
              @{commitSha}
            </span>
            {indexedPoints !== null && (
              <span style={{
                fontSize: '10px',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                color: 'var(--accent-emerald)',
                padding: '1px 6px',
                borderRadius: '99px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
              }}>
                {indexedPoints} chunks
              </span>
            )}
          </div>

          {/* Ingest Button */}
          <button
            onClick={() => setIsIngestOpen(true)}
            disabled={isStreaming}
            style={{
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              color: 'var(--accent-cyan)',
              borderRadius: 'var(--radius-sm)',
              padding: '5px 12px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: isStreaming ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <PlusCircle size={13} />
            <span>Ingest Repo</span>
          </button>

          {/* Dark / Light Mode Toggle */}
          <button
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)',
              borderRadius: 'var(--radius-sm)',
              padding: '6px 9px',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            {theme === 'dark' ? <Sun size={14} color="#f59e0b" /> : <Moon size={14} color="var(--accent-cyan)" />}
            <span style={{ fontSize: '11px', textTransform: 'capitalize' }}>{theme}</span>
          </button>
        </div>
      </header>

      {/* Ingest Modal */}
      <RepoIngestModal
        isOpen={isIngestOpen}
        onClose={() => setIsIngestOpen(false)}
        onSuccess={(newName, newSha, count) => {
          setRepoName(newName);
          setCommitSha(newSha);
          setIndexedPoints(count);
          setMessages([]);
          try {
            localStorage.setItem('coderag_custom_repo', JSON.stringify({
              repoName: newName,
              commitSha: newSha,
              indexedPoints: count
            }));
          } catch (_) {}
        }}
      />

      {/* Main Chat Area */}
      <main style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {messages.length === 0 ? (
          <div style={{
            margin: 'auto',
            padding: '20px 24px 60px',
            maxWidth: '740px',
            width: '100%',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            transform: 'translateY(-20px)',
          }}>
            <h1 style={{
              fontSize: '34px',
              fontWeight: 700,
              marginBottom: '16px',
              letterSpacing: '-0.03em',
              color: 'var(--text-primary)',
            }}>
              Ask anything about <span style={{ marginLeft: '6px', color: 'var(--accent-cyan)' }}>{repoName}</span>
            </h1>

            <p style={{
              color: 'var(--text-secondary)',
              fontSize: '15px',
              maxWidth: '560px',
              margin: '0 auto 36px',
              lineHeight: 1.65,
            }}>
              Accurate, verified answers grounded directly in the codebase with exact file lines, function definitions, and interactive citations.
            </p>

            {/* Quick Ingest Button */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: '48px',
            }}>
              <button
                onClick={() => setIsIngestOpen(true)}
                disabled={isStreaming}
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-secondary)',
                  borderRadius: 'var(--radius-md)',
                  padding: '9px 18px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: isStreaming ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.15s ease',
                }}
              >
                <PlusCircle size={15} color="var(--accent-cyan)" />
                <span>Ingest another repository</span>
                <ArrowRight size={13} color="var(--text-muted)" />
              </button>
            </div>

            {/* Centered Search Bar positioned right below Ingest button */}
            <div className="search-container-transition" style={{ width: '100%', maxWidth: '700px' }}>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSubmit();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'var(--input-bg)',
                  border: '1px solid var(--input-border)',
                  borderRadius: '9999px',
                  padding: '6px 10px 6px 20px',
                  gap: '10px',
                  boxShadow: 'var(--input-shadow)',
                  transition: 'border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent-cyan)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--input-border)';
                }}
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Query architecture, functions, files, or flow..."
                  disabled={isStreaming}
                  autoFocus
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    outline: 'none',
                    padding: '6px 0',
                    fontFamily: 'var(--font-sans)',
                  }}
                />
                
                {/* Embedded Model Selector */}
                <ModelSelector
                  provider={provider}
                  model={model}
                  compact={true}
                  onChange={(p, m) => {
                    setProvider(p);
                    setModel(m);
                  }}
                  disabled={isStreaming}
                />

                <button
                  type="submit"
                  disabled={isStreaming || !input.trim()}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: isStreaming || !input.trim() ? 'var(--text-muted)' : 'var(--accent-cyan)',
                    cursor: isStreaming || !input.trim() ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '6px',
                    borderRadius: '50%',
                    transition: 'color 0.15s ease, transform 0.1s ease',
                  }}
                >
                  {isStreaming ? (
                    <RefreshCw size={15} className="animate-pulse-slow" color="var(--accent-cyan)" />
                  ) : (
                    <Send size={15} />
                  )}
                </button>
              </form>
              <div style={{
                textAlign: 'center',
                fontSize: '11px',
                color: 'var(--text-muted)',
                marginTop: '10px',
                letterSpacing: '0.01em',
              }}>
                RepoMind answers can be cross-referenced with cited repository files.
              </div>
            </div>
          </div>
        ) : (
          <div style={{ paddingBottom: '24px' }}>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} repoName={repoName} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      {/* Floating Bottom Query Input (shown after first search/message, with Google-like slide-up transition) */}
      {messages.length > 0 && (
        <div
          className="search-container-transition animate-fade-in"
          style={{
            padding: '12px 24px 20px',
            background: 'transparent',
            borderTop: 'none',
          }}
        >
          <div style={{ maxWidth: '820px', margin: '0 auto' }}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'var(--input-bg)',
                border: '1px solid var(--input-border)',
                borderRadius: '9999px',
                padding: '6px 10px 6px 20px',
                gap: '10px',
                boxShadow: 'var(--input-shadow)',
                transition: 'border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-cyan)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--input-border)';
              }}
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Query architecture, functions, files, or flow..."
                disabled={isStreaming}
                autoFocus
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '13.5px',
                  outline: 'none',
                  padding: '7px 0',
                  fontFamily: 'var(--font-sans)',
                }}
              />

              {/* Embedded Model Selector */}
              <ModelSelector
                provider={provider}
                model={model}
                compact={true}
                onChange={(p, m) => {
                  setProvider(p);
                  setModel(m);
                }}
                disabled={isStreaming}
              />

              <button
                type="submit"
                disabled={isStreaming || !input.trim()}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: isStreaming || !input.trim() ? 'var(--text-muted)' : 'var(--accent-cyan)',
                  cursor: isStreaming || !input.trim() ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '6px',
                  borderRadius: '50%',
                  transition: 'color 0.15s ease, transform 0.1s ease',
                }}
              >
                {isStreaming ? (
                  <RefreshCw size={15} className="animate-pulse-slow" color="var(--accent-cyan)" />
                ) : (
                  <Send size={15} />
                )}
              </button>
            </form>
            <div style={{
              textAlign: 'center',
              fontSize: '11px',
              color: 'var(--text-muted)',
              marginTop: '8px',
              letterSpacing: '0.01em',
            }}>
              RepoMind answers can be cross-referenced with cited repository files.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
