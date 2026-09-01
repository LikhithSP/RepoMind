import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Bot, User, ExternalLink, Copy, Check, FileText, Code2, AlertCircle, Sparkles } from 'lucide-react';
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

  // Transform content text: replace raw file citations [filepath:start-end] or [n] with special citation tags
  // Also maps citations to source index if possible
  const formatContentWithCitations = (content: string, sources: SourceChunk[] = []) => {
    if (!content) return '';

    // If text already has raw file paths like [src/requests/api.py:24-71] or [README.md:1-29]
    // replace them with matching [1], [2], etc. or clean numbered badge
    let processed = content;

    // Build map from filepath to source 1-based index
    const sourcePathMap: Record<string, number> = {};
    sources.forEach((s, idx) => {
      const fileName = s.file_path.split('/').pop() || s.file_path;
      sourcePathMap[s.file_path] = idx + 1;
      sourcePathMap[fileName] = idx + 1;
    });

    // Replace bracketed filepath citations with numeric badges e.g. [src/api.py:10-20] -> [1]
    processed = processed.replace(/\[([a-zA-Z0-9_\-\.\/]+)(?::(\d+)(?:-(\d+))?)?\]/g, (match, path, start, end) => {
      // Check if it's already a small number like [1] or [2]
      if (/^\d+$/.test(path)) {
        return match;
      }
      const fileName = path.split('/').pop() || path;
      const foundIdx = sourcePathMap[path] || sourcePathMap[fileName];
      if (foundIdx) {
        return `[${foundIdx}]`;
      }
      // If we couldn't match a source, check if we can make it a clean [1] fallback or keep it compact
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
    <div style={{
      display: 'flex',
      gap: '14px',
      padding: '18px 24px',
      background: isUser ? 'transparent' : 'rgba(20, 23, 33, 0.45)',
      borderBottom: '1px solid rgba(40, 47, 69, 0.5)',
      maxWidth: '860px',
      margin: '0 auto',
      width: '100%',
      position: 'relative'
    }}>
      {/* Avatar Icon */}
      <div style={{
        width: '32px',
        height: '32px',
        borderRadius: '8px',
        background: isUser ? 'var(--bg-surface)' : 'rgba(56, 189, 248, 0.12)',
        border: `1px solid ${isUser ? 'var(--border-color)' : 'rgba(56, 189, 248, 0.4)'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        marginTop: '2px'
      }}>
        {isUser ? <User size={16} color="var(--text-secondary)" /> : <Sparkles size={16} color="var(--accent-cyan)" />}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Author Label */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px',
          fontSize: '13px',
          fontWeight: 600,
          color: isUser ? 'var(--text-secondary)' : 'var(--accent-cyan)'
        }}>
          <span>{isUser ? 'You' : 'CodeRAG Assistant'}</span>
          {message.isStreaming && (
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }} className="animate-pulse-slow">
              generating response...
            </span>
          )}
        </div>

        {/* Chatbot Text with Gemini Notebook-style interactive citation pills */}
        <div style={{
          color: 'var(--text-primary)',
          lineHeight: 1.7,
          fontSize: '14px',
          wordBreak: 'break-word',
        }} className="markdown-content">
          <ReactMarkdown
            components={{
              // Custom text renderer to render [1], [2] as Gemini Notebook style citation pills
              p: ({ children }) => {
                return (
                  <p style={{ marginBottom: '12px' }}>
                    {React.Children.map(children, (child) => {
                      if (typeof child === 'string') {
                        // Match bracket numbers like [1] or [2]
                        const parts = child.split(/(\[\d+\])/g);
                        return parts.map((part, pIdx) => {
                          const numMatch = part.match(/^\[(\d+)\]$/);
                          if (numMatch) {
                            const citationNum = parseInt(numMatch[1], 10);
                            const hasSource = message.sources && message.sources.length >= citationNum;
                            const isSelected = activeCitation === citationNum;

                            return (
                              <button
                                key={pIdx}
                                onClick={() => setActiveCitation(isSelected ? null : citationNum)}
                                title={hasSource ? `View source ${citationNum}: ${message.sources![citationNum - 1].file_path}` : `Source ${citationNum}`}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  minWidth: '18px',
                                  height: '18px',
                                  padding: '0 5px',
                                  margin: '0 2px',
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  fontFamily: 'var(--font-mono)',
                                  borderRadius: '10px',
                                  background: isSelected 
                                    ? 'var(--accent-cyan)' 
                                    : 'rgba(255, 255, 255, 0.08)',
                                  color: isSelected 
                                    ? '#000' 
                                    : 'var(--text-secondary)',
                                  border: isSelected 
                                    ? '1px solid var(--accent-cyan)' 
                                    : '1px solid rgba(255, 255, 255, 0.12)',
                                  cursor: 'pointer',
                                  verticalAlign: 'super',
                                  transform: 'translateY(-2px)',
                                  lineHeight: 1,
                                  transition: 'all 0.15s ease'
                                }}
                                onMouseEnter={(e) => {
                                  if (!isSelected) {
                                    e.currentTarget.style.background = 'rgba(56, 189, 248, 0.2)';
                                    e.currentTarget.style.color = 'var(--accent-cyan)';
                                    e.currentTarget.style.borderColor = 'var(--accent-cyan)';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!isSelected) {
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                                    e.currentTarget.style.color = 'var(--text-secondary)';
                                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                                  }
                                }}
                              >
                                {citationNum}
                              </button>
                            );
                          }
                          return part;
                        });
                      }
                      return child;
                    })}
                  </p>
                );
              }
            }}
          >
            {processedContent}
          </ReactMarkdown>
        </div>

        {/* Notebook-style interactive Citation Popover/Card on Click */}
        {activeSourceChunk && (
          <div style={{
            marginTop: '10px',
            marginBottom: '14px',
            padding: '10px 14px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--accent-cyan)',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
            animation: 'fadeIn 0.15s ease'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '6px',
              borderBottom: '1px solid var(--border-color)',
              paddingBottom: '6px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{
                  background: 'var(--accent-cyan)',
                  color: '#000',
                  borderRadius: '10px',
                  padding: '1px 6px',
                  fontWeight: 700,
                  fontSize: '10px'
                }}>
                  Source {activeCitation}
                </span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                  {activeSourceChunk.file_path}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                  (L{activeSourceChunk.start_line}–{activeSourceChunk.end_line})
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  onClick={() => handleCopySnippet(activeSourceChunk.text)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px'
                  }}
                >
                  {copied ? <Check size={12} color="var(--accent-emerald)" /> : <Copy size={12} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <a
                  href={`https://github.com/${repoName}/blob/main/${activeSourceChunk.file_path}#L${activeSourceChunk.start_line}-L${activeSourceChunk.end_line}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    color: 'var(--accent-cyan)',
                    fontSize: '11px'
                  }}
                >
                  GitHub <ExternalLink size={11} />
                </a>
              </div>
            </div>
            <pre style={{
              padding: '8px 10px',
              background: 'var(--code-bg)',
              borderRadius: '6px',
              color: '#e2e8f0',
              lineHeight: 1.45,
              maxHeight: '160px',
              overflowX: 'auto',
              margin: 0,
              fontSize: '11px'
            }}>
              <code>{activeSourceChunk.text}</code>
            </pre>
          </div>
        )}

        {/* Small Bottom Resources Box (Gemini Notebook-like) */}
        {message.sources && message.sources.length > 0 && (
          <SourcePanel sources={message.sources} repoName={repoName} />
        )}

        {/* Trace */}
        {message.trace && (
          <TraceView trace={message.trace} />
        )}
      </div>
    </div>
  );
};
