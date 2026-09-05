'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Terminal, GitBranch, RefreshCw, Layers, PlusCircle, ArrowRight, ShieldCheck, Sparkles, Sun, Moon } from 'lucide-react';
import { ChatMessage, SourceChunk, TraceInfo } from '../lib/types';
import { MessageBubble } from '../components/MessageBubble';
import { ModelSelector } from '../components/ModelSelector';
import { RepoIngestModal } from '../components/RepoIngestModal';

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [provider, setProvider] = useState('groq');
  const [model, setModel] = useState('qwen/qwen3.8-27b');
  const [repoName, setRepoName] = useState('psf/requests');
  const [commitSha, setCommitSha] = useState('8d3f9b2');
  const [indexedPoints, setIndexedPoints] = useState<number | null>(null);
  const [isIngestOpen, setIsIngestOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Sync theme with document element and localStorage
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('repomind_theme') as 'dark' | 'light' | null;
      if (savedTheme) {
        setTheme(savedTheme);
        document.documentElement.setAttribute('data-theme', savedTheme);
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
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
        try {
          localStorage.setItem('coderag_custom_repo', JSON.stringify({
            repoName: data.repo_name || repoName,
            commitSha: data.commit_sha || commitSha,
            indexedPoints: data.indexed_points
          }));
        } catch (_) {}
      })
      .catch(() => {});
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-main)' }}>
      {/* Top Navbar */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 20px',
        borderBottom: '1px solid var(--border-color)',
        background: 'var(--bg-main)',
        zIndex: 10,
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '26px',
            height: '26px',
            borderRadius: '6px',
            background: 'var(--accent-cyan)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
          }}>
            <Terminal size={14} strokeWidth={2.5} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 600, fontSize: '14.5px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              RepoMind
            </span>
          </div>
        </div>

        {/* Action Controls & Active Repo Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Active Repo Badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '7px',
            padding: '4px 10px',
            background: 'var(--bg-surface)',
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
                fontSize: '10.5px',
                background: 'var(--accent-cyan-subtle)',
                color: 'var(--accent-cyan)',
                padding: '0 6px',
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
              background: 'transparent',
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)',
              borderRadius: 'var(--radius-sm)',
              padding: '5px 12px',
              fontSize: '12px',
              fontWeight: 500,
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

          {/* Model Selector */}
          <ModelSelector
            provider={provider}
            model={model}
            onChange={(p, m) => {
              setProvider(p);
              setModel(m);
            }}
            disabled={isStreaming}
          />

          {/* Theme Toggle Button (Light/Dark) */}
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
            style={{
              background: 'transparent',
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)',
              borderRadius: 'var(--radius-sm)',
              padding: '6px 8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
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
          <div style={{ margin: 'auto', padding: '40px 24px', maxWidth: '680px', textAlign: 'center' }}>
            <h1 style={{
              fontSize: '28px',
              fontWeight: 600,
              marginBottom: '10px',
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
            }}>
              What can I help you explore in {repoName}?
            </h1>

            <p style={{
              color: 'var(--text-secondary)',
              fontSize: '14px',
              maxWidth: '500px',
              margin: '0 auto 28px',
              lineHeight: 1.5,
            }}>
              Grounded answers with cited code snippets, AST parsing, and cross-encoder re-ranking.
            </p>

            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <button
                onClick={() => setIsIngestOpen(true)}
                disabled={isStreaming}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-secondary)',
                  borderRadius: 'var(--radius-pill)',
                  padding: '8px 18px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: isStreaming ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.15s ease',
                }}
              >
                <PlusCircle size={14} color="var(--accent-cyan)" />
                <span>Switch to another repository</span>
                <ArrowRight size={13} color="var(--text-muted)" />
              </button>
            </div>
          </div>
        ) : (
          <div style={{ paddingBottom: '32px' }}>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} repoName={repoName} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      {/* Bottom Floating Prompt Bar (ChatGPT / Notion style) */}
      <footer style={{
        padding: '16px 20px 24px',
        background: 'var(--bg-main)',
      }}>
        <div style={{ maxWidth: '768px', margin: '0 auto' }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              borderRadius: '24px',
              padding: '8px 14px 8px 18px',
              gap: '10px',
              boxShadow: 'var(--shadow-input)',
              transition: 'all 0.15s ease',
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Message RepoMind about ${repoName}…`}
              disabled={isStreaming}
              autoFocus
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontSize: '14px',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={isStreaming || !input.trim()}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: isStreaming || !input.trim() ? 'transparent' : 'var(--text-primary)',
                color: isStreaming || !input.trim() ? 'var(--text-muted)' : 'var(--bg-main)',
                border: 'none',
                cursor: isStreaming || !input.trim() ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
                flexShrink: 0,
              }}
            >
              {isStreaming ? <RefreshCw size={14} className="animate-pulse-slow" /> : <Send size={14} />}
            </button>
          </form>
          <div style={{
            textAlign: 'center',
            fontSize: '11px',
            color: 'var(--text-muted)',
            marginTop: '8px',
          }}>
            RepoMind answers can be cross-referenced with cited repository files.
          </div>
        </div>
      </footer>
    </div>
  );
}
