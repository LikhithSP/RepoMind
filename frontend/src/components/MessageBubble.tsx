import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Bot, User, ExternalLink, Copy, Check, FileText, Code2, AlertCircle, Sparkles, Terminal } from 'lucide-react';
import { ChatMessage, SourceChunk } from '../lib/types';
import { SourcePanel } from './SourcePanel';
import { TraceView } from './TraceView';

interface MessageBubbleProps {
  message: ChatMessage;
  repoName?: string;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, repoName = "psf/requests" }) => {
  const isUser = message.role === 'user';
  const [activeCitation, setActiveCitation] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  // Transform content text: replace raw file citations [filepath:start-end] or [n] with clean citation pills
  const formatContentWithCitations = (content: string, sources: SourceChunk[] = []) => {
    if (!content) return '';

    let processed = content;
    const sourcePathMap: Record<string, number> = {};
    sources.forEach((s, idx) => {
      const fileName = s.file_path.split('/').pop() || s.file_path;
      sourcePathMap[s.file_path] = idx + 1;
      sourcePathMap[fileName] = idx + 1;
    });

    processed = processed.replace(/\[([a-zA-Z0-9_\-\.\/]+)(?::(\d+)(?:-(\d+))?)?\]/g, (match, path) => {
      if (/^\d+$/.test(path)) {
        return match;
      }
      const fileName = path.split('/').pop() || path;
      const foundIdx = sourcePathMap[path] || sourcePathMap[fileName];
      if (foundIdx) {
        return `[${foundIdx}]`;
      }
      return `[${path}]`;
    });

    return processed;
  };

  const handleCopySnippet = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activeSourceChunk = (activeCitation !== null && message.sources && message.sources[activeCitation - 1]) 
    ? message.sources[activeCitation - 1] 
    : null;

  const processedContent = isUser ? message.content : formatContentWithCitations(message.content, message.sources || []);

  return (
    <div
      className="animate-fade-in"
      style={{
        display: 'flex',
        gap: '16px',
        padding: '24px 28px',
        background: isUser ? 'transparent' : 'rgba(255, 255, 255, 0.015)',
        borderBottom: '1px solid var(--border-subtle)',
        maxWidth: '920px',
        margin: '0 auto',
        width: '100%',
        position: 'relative',
      }}
    >
      {/* Avatar Icon */}
      <div style={{
        width: '32px',
        height: '32px',
        borderRadius: 'var(--radius-sm)',
        background: isUser ? 'var(--bg-surface)' : 'rgba(56, 189, 248, 0.1)',
        border: `1px solid ${isUser ? 'var(--border-color)' : 'rgba(56, 189, 248, 0.25)'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        marginTop: '2px',
        boxShadow: isUser ? 'none' : '0 0 16px -2px rgba(56, 189, 248, 0.15)',
      }}>
        {isUser ? <User size={15} color="var(--text-secondary)" /> : <Sparkles size={15} color="var(--accent-cyan)" />}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Author Label */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '10px',
          fontSize: '12.5px',
        }}>
          <span style={{ fontWeight: 600, color: isUser ? 'var(--text-primary)' : 'var(--accent-cyan)', letterSpacing: '-0.01em' }}>
            {isUser ? 'You' : 'CodeRAG Assistant'}
          </span>
          {!isUser && (
            <span style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-muted)',
              padding: '1px 6px',
              borderRadius: '4px',
            }}>
              AI Grounded
            </span>
          )}
        </div>

        {/* Message Body */}
        <div style={{
          color: isUser ? '#f1f5f9' : '#cbd5e1',
          lineHeight: '1.7',
          fontSize: '14px',
        }}>
          <ReactMarkdown
            components={{
              // Custom text renderer to render citation pills [1], [2] as clickable cards
              text({ children }) {
                if (typeof children !== 'string') return <>{children}</>;
                const citationRegex = /\[(\d+)\]/g;
                const parts = [];
                let lastIndex = 0;
                let match;

                while ((match = citationRegex.exec(children)) !== null) {
                  const pre = children.slice(lastIndex, match.index);
                  if (pre) parts.push(pre);

                  const citationNum = parseInt(match[1], 10);
                  const isHovered = activeCitation === citationNum;

                  parts.push(
                    <span
                      key={match.index}
                      onClick={() => setActiveCitation(isHovered ? null : citationNum)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '1px 5px',
                        margin: '0 3px',
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 600,
                        borderRadius: '4px',
                        cursor: 'pointer',
                        verticalAlign: 'baseline',
                        transition: 'all 0.15s ease',
                        background: isHovered ? 'var(--accent-cyan)' : 'rgba(56, 189, 248, 0.1)',
                        color: isHovered ? '#000' : 'var(--accent-cyan)',
                        border: `1px solid ${isHovered ? 'var(--accent-cyan)' : 'rgba(56, 189, 248, 0.3)'}`,
                      }}
                      title={`View source [${citationNum}]`}
                    >
                      {citationNum}
                    </span>
                  );
                  lastIndex = match.index + match[0].length;
                }

                if (lastIndex < children.length) {
                  parts.push(children.slice(lastIndex));
                }

                return <>{parts}</>;
              },
              p: ({ children }) => <p style={{ marginBottom: '14px', lineHeight: 1.7 }}>{children}</p>,
              ul: ({ children }) => <ul style={{ paddingLeft: '20px', marginBottom: '14px' }}>{children}</ul>,
              ol: ({ children }) => <ol style={{ paddingLeft: '20px', marginBottom: '14px' }}>{children}</ol>,
              li: ({ children }) => <li style={{ marginBottom: '6px' }}>{children}</li>,
              h1: ({ children }) => <h1 style={{ fontSize: '18px', fontWeight: 700, margin: '16px 0 8px', color: 'var(--text-primary)' }}>{children}</h1>,
              h2: ({ children }) => <h2 style={{ fontSize: '16px', fontWeight: 700, margin: '14px 0 6px', color: 'var(--text-primary)' }}>{children}</h2>,
              h3: ({ children }) => <h3 style={{ fontSize: '14px', fontWeight: 600, margin: '12px 0 4px', color: 'var(--text-primary)' }}>{children}</h3>,
            }}
          >
            {processedContent}
          </ReactMarkdown>

          {/* Active Citation Floating Popover */}
          {activeSourceChunk && (
            <div
              className="glass-panel animate-fade-in"
              style={{
                marginTop: '12px',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-lg)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 14px',
                background: 'rgba(56, 189, 248, 0.08)',
                borderBottom: '1px solid var(--border-color)',
                fontSize: '11.5px',
                fontFamily: 'var(--font-mono)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    background: 'var(--accent-cyan)',
                    color: '#000',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    fontWeight: 700,
                  }}>
                    [{activeCitation}]
                  </span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {activeSourceChunk.file_path} (L{activeSourceChunk.start_line}–{activeSourceChunk.end_line})
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    onClick={() => handleCopySnippet(activeSourceChunk.text)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '11px',
                    }}
                  >
                    {copied ? <Check size={12} color="var(--accent-emerald)" /> : <Copy size={12} />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                  <a
                    href={activeSourceChunk.url || `https://github.com/${repoName}/blob/main/${activeSourceChunk.file_path}#L${activeSourceChunk.start_line}-L${activeSourceChunk.end_line}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: 'var(--accent-cyan)',
                      fontSize: '11px',
                      fontWeight: 500,
                    }}
                  >
                    GitHub <ExternalLink size={10} />
                  </a>
                </div>
              </div>
              <pre style={{
                padding: '12px 14px',
                margin: 0,
                maxHeight: '220px',
                overflowY: 'auto',
                fontSize: '12px',
                lineHeight: 1.5,
                background: 'var(--code-bg)',
                border: 'none',
                borderRadius: 0,
              }}>
                <code>{activeSourceChunk.text}</code>
              </pre>
            </div>
          )}

          {/* Inline Streaming Pulse Indicator */}
          {message.isStreaming && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', marginTop: '6px' }}>
              <span style={{
                display: 'inline-block',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: 'var(--accent-cyan)',
                animation: 'pulseGlow 1s infinite alternate'
              }} />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Retrieving &amp; streaming…
              </span>
            </div>
          )}

          {/* Bottom Sources & Trace */}
          {!message.isStreaming && message.sources && message.sources.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <SourcePanel sources={message.sources} repoName={repoName} />
            </div>
          )}

          {!message.isStreaming && message.trace && (
            <TraceView trace={message.trace} />
          )}
        </div>
      </div>
    </div>
  );
};
