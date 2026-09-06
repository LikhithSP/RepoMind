'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Terminal, GitBranch, RefreshCw, Layers, PlusCircle, Plus, ArrowRight, ShieldCheck, Sparkles, Database, Sun, Moon, PanelLeft, PanelLeftClose } from 'lucide-react';
import { ChatMessage, SourceChunk, TraceInfo, ChatSession } from '../lib/types';
import { MessageBubble } from '../components/MessageBubble';
import { ModelSelector } from '../components/ModelSelector';
import { RepoIngestModal } from '../components/RepoIngestModal';
import { Sidebar } from '../components/Sidebar';

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [provider, setProvider] = useState('groq');
  const [model, setModel] = useState('qwen/qwen3.8-27b');
  const [repoName, setRepoName] = useState<string | null>(null);
  const [commitSha, setCommitSha] = useState<string | null>(null);
  const [indexedPoints, setIndexedPoints] = useState<number | null>(null);
  const [isIngestOpen, setIsIngestOpen] = useState(false);
  const [hasEnvGroqKey, setHasEnvGroqKey] = useState(false);
  const [userApiKey, setUserApiKey] = useState('');

  // Check backend health and .env GROQ key status on load
  useEffect(() => {
    fetch('http://localhost:8000/health')
      .then((res) => res.json())
      .then((data) => {
        if (data.has_groq_key) {
          setHasEnvGroqKey(true);
        }
      })
      .catch(() => {});

    try {
      const savedKey = localStorage.getItem('repomind_user_groq_key') || '';
      setUserApiKey(savedKey);
    } catch (_) {}
  }, []);

  // Sidebar & Chat Sessions Cache State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Load chat sessions from localStorage cache on initial load
  useEffect(() => {
    try {
      const cached = localStorage.getItem('repomind_chat_sessions');
      if (cached) {
        const parsed: ChatSession[] = JSON.parse(cached);
        setSessions(parsed);
      }
    } catch (_) {}
  }, []);

  // Save sessions to localStorage whenever sessions state changes
  const saveSessionsToCache = (newSessions: ChatSession[]) => {
    setSessions(newSessions);
    try {
      localStorage.setItem('repomind_chat_sessions', JSON.stringify(newSessions));
    } catch (_) {}
  };

  // Switch to or load an existing session from history
  const handleSelectSession = (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;
    setCurrentSessionId(session.id);
    setMessages(session.messages || []);
    if (session.repoName) setRepoName(session.repoName);
    if (session.commitSha) setCommitSha(session.commitSha);
  };

  // Start fresh chat session
  const handleNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
    setInput('');
  };

  // Delete an individual chat session
  const handleDeleteSession = (sessionId: string) => {
    const updated = sessions.filter((s) => s.id !== sessionId);
    saveSessionsToCache(updated);
    if (currentSessionId === sessionId) {
      handleNewChat();
    }
  };

  // Clear all chat sessions
  const handleClearAllSessions = () => {
    saveSessionsToCache([]);
    handleNewChat();
  };

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('repomind_theme') as 'dark' | 'light' | null;
      const initial = savedTheme || 'dark';
      setTheme(initial);
      document.documentElement.setAttribute('data-theme', initial);
    } catch (_) {}
  }, []);

  // For first-time users, automatically show the ingest repository popup
  useEffect(() => {
    try {
      const hasVisited = localStorage.getItem('repomind_has_visited');
      const savedRepo = localStorage.getItem('coderag_custom_repo');
      if (!hasVisited || !savedRepo) {
        setIsIngestOpen(true);
        localStorage.setItem('repomind_has_visited', 'true');
      }
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

  // Load custom repository chosen by the user from localStorage
  useEffect(() => {
    try {
      const savedRepo = localStorage.getItem('coderag_custom_repo');
      if (savedRepo) {
        const parsed = JSON.parse(savedRepo);
        if (parsed.repoName) setRepoName(parsed.repoName);
        if (parsed.commitSha) setCommitSha(parsed.commitSha);
        if (parsed.indexedPoints !== undefined) setIndexedPoints(parsed.indexedPoints);
      }
    } catch (_) {}
  }, []);

  const handleSubmit = async (queryText?: string) => {
    const query = (queryText || input).trim();
    if (!query || isStreaming) return;

    if (!repoName) {
      setIsIngestOpen(true);
      return;
    }

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
          top_k: 5,
          api_key: userApiKey || undefined,
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

      // Sync finalized conversation into chat session cache
      setMessages((prev) => {
        const finalized = prev.map((msg) =>
          msg.id === assistantPlaceholderId
            ? { ...msg, isStreaming: false }
            : msg
        );

        // Update or create session
        const now = Date.now();
        const firstUserMsg = finalized.find((m) => m.role === 'user');
        const sessionTitle = firstUserMsg ? firstUserMsg.content.slice(0, 42) + (firstUserMsg.content.length > 42 ? '...' : '') : 'New Session';
        
        let targetId = currentSessionId;
        if (!targetId) {
          targetId = `session_${now}`;
          setCurrentSessionId(targetId);
        }

        setSessions((prevSessions) => {
          const existingIdx = prevSessions.findIndex((s) => s.id === targetId);
          let updated: ChatSession[];
          if (existingIdx >= 0) {
            updated = [...prevSessions];
            updated[existingIdx] = {
              ...updated[existingIdx],
              messages: finalized,
              repoName: repoName || updated[existingIdx].repoName,
              commitSha: commitSha || updated[existingIdx].commitSha,
              updatedAt: now,
            };
          } else {
            const newSession: ChatSession = {
              id: targetId!,
              title: sessionTitle,
              repoName: repoName,
              commitSha: commitSha,
              messages: finalized,
              createdAt: now,
              updatedAt: now,
            };
            updated = [newSession, ...prevSessions];
          }

          try {
            localStorage.setItem('repomind_chat_sessions', JSON.stringify(updated));
          } catch (_) {}

          return updated;
        });

        return finalized;
      });
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

  const hasStartedChat = messages.length > 0;

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {/* ChatGPT / Gemini style Collapsible History Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        onDeleteSession={handleDeleteSession}
        onClearAll={handleClearAllSessions}
      />

      {/* Main Content Area */}
      <div 
        className={hasStartedChat ? "ambient-bg chat-active" : "ambient-bg"} 
        style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', minWidth: 0 }}
      >
        {/* Top Navbar */}
        <header className="glass-panel" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 20px',
          borderBottom: '1px solid var(--border-color)',
          zIndex: 10,
        }}>
          {/* Brand & Sidebar Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              title={isSidebarOpen ? "Collapse sidebar" : "Open sidebar"}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--accent-cyan)';
                e.currentTarget.style.borderColor = 'var(--border-focus)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-secondary)';
                e.currentTarget.style.borderColor = 'var(--border-color)';
              }}
            >
              {isSidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
            </button>

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
          {/* Active Repo Badge / Select Repo Button */}
          {repoName ? (
            <>
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
              {commitSha && (
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: '11px' }}>
                  @{commitSha}
                </span>
              )}
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

            {/* Ingest New Repo Button */}
            <button
              onClick={() => setIsIngestOpen(true)}
              title="Ingest a new GitHub repository"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                background: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid var(--accent-cyan-subtle)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '12px',
                color: 'var(--accent-cyan)',
                cursor: 'pointer',
                fontWeight: 500,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(56, 189, 248, 0.15)';
                e.currentTarget.style.borderColor = 'var(--border-focus)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(56, 189, 248, 0.08)';
                e.currentTarget.style.borderColor = 'var(--accent-cyan-subtle)';
              }}
            >
              <Plus size={13} strokeWidth={2.5} />
              <span>Ingest Repo</span>
            </button>
            </>
          ) : (
            <button
              onClick={() => setIsIngestOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                background: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid var(--accent-cyan-subtle)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '12px',
                color: 'var(--accent-cyan)',
                cursor: 'pointer',
                fontWeight: 500,
                transition: 'all 0.15s ease'
              }}
            >
              <GitBranch size={13} color="var(--accent-cyan)" />
              <span>Ingest Repository</span>
            </button>
          )}

          {/* New Chat Button (shown only when sidebar is closed to avoid duplicate) */}
          {hasStartedChat && !isSidebarOpen && (
            <button
              onClick={handleNewChat}
              title="Start a new chat session"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
                borderRadius: 'var(--radius-sm)',
                padding: '5px 9px',
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--text-primary)';
                e.currentTarget.style.borderColor = 'var(--border-focus)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-secondary)';
                e.currentTarget.style.borderColor = 'var(--border-color)';
              }}
            >
              <Plus size={13} strokeWidth={2.5} />
              <span>New Chat</span>
            </button>
          )}

          {/* Dark / Light Mode Toggle (Icon only) */}
          <button
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)',
              borderRadius: 'var(--radius-sm)',
              padding: '7px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
          >
            {theme === 'dark' ? <Sun size={15} color="#f59e0b" /> : <Moon size={15} color="var(--accent-cyan)" />}
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
              {repoName ? (
                <>
                  Ask anything about <span style={{ marginLeft: '6px', color: 'var(--accent-cyan)' }}>{repoName}</span>
                </>
              ) : (
                <>
                  Ask anything about <span style={{ marginLeft: '6px', color: 'var(--accent-cyan)' }}>your codebase</span>
                </>
              )}
            </h1>

            <p style={{
              color: 'var(--text-secondary)',
              fontSize: '15px',
              maxWidth: '560px',
              margin: '0 auto 84px',
              lineHeight: 1.65,
            }}>
              Accurate, verified answers grounded directly in the codebase with exact file lines, function definitions, and interactive citations.
            </p>

            {/* Centered Large Search Bar on Home Page */}
            <div className="search-container-transition" style={{ width: '100%', maxWidth: '780px' }}>
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
                  padding: '10px 14px 10px 18px',
                  gap: '12px',
                  boxShadow: 'var(--input-shadow)',
                  transition: 'border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent-cyan)';
                  e.currentTarget.style.boxShadow = '0 6px 30px -2px rgba(56, 189, 248, 0.25)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--input-border)';
                  e.currentTarget.style.boxShadow = 'var(--input-shadow)';
                }}
              >
                {/* Clean Simple '+' Ingest Action Button */}
                <button
                  type="button"
                  onClick={() => setIsIngestOpen(true)}
                  disabled={isStreaming}
                  title="Ingest new repository (start new session)"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '6px',
                    cursor: isStreaming ? 'not-allowed' : 'pointer',
                    flexShrink: 0,
                    transition: 'color 0.15s ease, transform 0.1s ease',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                >
                  <Plus size={22} strokeWidth={2.2} />
                </button>

                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask RepoMind..."
                  disabled={isStreaming}
                  autoFocus
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '16px',
                    fontWeight: 400,
                    outline: 'none',
                    padding: '8px 0',
                    fontFamily: 'var(--font-sans)',
                  }}
                />
                
                {/* Embedded Model Selector with Groq API Key configuration */}
                <ModelSelector
                  provider={provider}
                  model={model}
                  compact={true}
                  hasEnvGroqKey={hasEnvGroqKey}
                  userApiKey={userApiKey}
                  onApiKeyChange={(k) => setUserApiKey(k)}
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
                    background: isStreaming || !input.trim() ? 'transparent' : 'var(--accent-cyan)',
                    border: 'none',
                    color: isStreaming || !input.trim() ? 'var(--text-muted)' : '#07080c',
                    cursor: isStreaming || !input.trim() ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    flexShrink: 0,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {isStreaming ? (
                    <RefreshCw size={18} className="animate-pulse-slow" color="var(--accent-cyan)" />
                  ) : (
                    <Send size={18} strokeWidth={2.2} />
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
              <MessageBubble key={msg.id} message={msg} repoName={repoName || undefined} />
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
                padding: '6px 10px 6px 12px',
                gap: '8px',
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
              {/* Clean Simple '+' Ingest Action Button */}
              <button
                type="button"
                onClick={() => setIsIngestOpen(true)}
                disabled={isStreaming}
                title="Ingest new repository (start new session)"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px',
                  cursor: isStreaming ? 'not-allowed' : 'pointer',
                  flexShrink: 0,
                  transition: 'color 0.15s ease, transform 0.1s ease',
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
              >
                <Plus size={18} strokeWidth={2} />
              </button>

              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask RepoMind..."
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

              {/* Embedded Model Selector with Groq API Key configuration */}
              <ModelSelector
                provider={provider}
                model={model}
                compact={true}
                hasEnvGroqKey={hasEnvGroqKey}
                userApiKey={userApiKey}
                onApiKeyChange={(k) => setUserApiKey(k)}
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
    </div>
  );
}
