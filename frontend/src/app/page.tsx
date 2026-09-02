'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Terminal, GitBranch, RefreshCw, Layers, PlusCircle } from 'lucide-react';
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
              // Strip only the leading 'data:' prefix so content whitespace is preserved
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

      // Ensure stream is finalized
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
        padding: '12px 24px',
        borderBottom: '1px solid var(--border-color)',
        background: 'var(--bg-surface)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            background: 'var(--accent-cyan)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#000'
          }}>
            <Terminal size={16} />
          </div>
          <span style={{ fontWeight: 700, fontSize: '15px', letterSpacing: '-0.2px' }}>CodeRAG</span>
          <span style={{
            fontSize: '11px',
            background: 'var(--bg-card)',
            color: 'var(--accent-cyan)',
            padding: '2px 8px',
            borderRadius: '4px',
            fontFamily: 'var(--font-mono)'
          }}>
            Agentic Codebase Copilot
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            onClick={() => setIsIngestOpen(true)}
            disabled={isStreaming}
            style={{
              background: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid var(--accent-cyan)',
              color: 'var(--accent-cyan)',
              borderRadius: '6px',
              padding: '5px 10px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: isStreaming ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <PlusCircle size={14} />
            <span>Ingest Repo</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <GitBranch size={13} color="var(--accent-emerald)" />
            <span>{repoName}</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>@{commitSha}</span>
            {indexedPoints !== null && (
              <span style={{
                fontSize: '10px',
                background: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--accent-emerald)',
                padding: '2px 6px',
                borderRadius: '4px',
                fontFamily: 'var(--font-mono)'
              }}>
                {indexedPoints} chunks
              </span>
            )}
          </div>
          <ModelSelector
            provider={provider}
            model={model}
            onChange={(p, m) => {
              setProvider(p);
              setModel(m);
            }}
            disabled={isStreaming}
          />
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
          <div style={{ margin: 'auto', padding: '40px 20px', maxWidth: '780px', textAlign: 'center' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '12px',
              background: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid var(--accent-cyan)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <Layers size={28} color="var(--accent-cyan)" />
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
              Explore the Codebase with Cited Precision
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '580px', margin: '0 auto 20px' }}>
              CodeRAG combines AST chunking, BM25 sparse search, dense vector embeddings, and cross-encoder re-ranking to answer architecture and implementation queries with verified citations.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '28px' }}>
              <button
                onClick={() => setIsIngestOpen(true)}
                disabled={isStreaming}
                style={{
                  background: 'var(--accent-cyan)',
                  color: '#000',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: isStreaming ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <PlusCircle size={15} />
                <span>Ingest a Different GitHub Repo</span>
              </button>
            </div>
          </div>
        ) : (
          <div>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} repoName={repoName} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      {/* Bottom Query Input Box */}
      <footer style={{
        padding: '16px 24px',
        borderTop: '1px solid var(--border-color)',
        background: 'var(--bg-surface)'
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--bg-main)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '6px 12px',
              gap: '8px',
              transition: 'border-color 0.15s ease'
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask an engineering question (e.g. 'How is the Session class implemented?')"
              disabled={isStreaming}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontSize: '14px',
                outline: 'none',
                padding: '6px 0'
              }}
            />
            <button
              type="submit"
              disabled={isStreaming || !input.trim()}
              style={{
                background: isStreaming || !input.trim() ? 'var(--bg-card)' : 'var(--accent-cyan)',
                color: isStreaming || !input.trim() ? 'var(--text-muted)' : '#000',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: isStreaming || !input.trim() ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {isStreaming ? <RefreshCw size={14} className="animate-pulse-slow" /> : <Send size={14} />}
              <span>{isStreaming ? 'Streaming' : 'Ask'}</span>
            </button>
          </form>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '11px',
            color: 'var(--text-muted)',
            marginTop: '8px'
          }}>
            <span>Grounding: Strict AST Context &bull; Hybrid RRF (BM25+Dense) &bull; ms-marco-MiniLM Re-ranking</span>
            <span>Esc to clear &bull; Enter to submit</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
