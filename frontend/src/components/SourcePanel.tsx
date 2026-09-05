import React, { useState } from 'react';
import { ExternalLink, Code2, FileText, AlertCircle, Copy, Check, ChevronDown, ChevronUp, BookOpen, Layers } from 'lucide-react';
import { SourceChunk } from '../lib/types';

interface SourceSnippetProps {
  chunk: SourceChunk;
  repoName?: string;
  sourceIndex: number;
}

export const SourceSnippet: React.FC<SourceSnippetProps> = ({ chunk, repoName = "psf/requests", sourceIndex }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(chunk.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getGitHubUrl = () => {
    if (chunk.url) return chunk.url;
    return `https://github.com/${repoName}/blob/main/${chunk.file_path}#L${chunk.start_line}-L${chunk.end_line}`;
  };

  return (
    <div
      className="animate-fade-in"
      style={{
        background: 'var(--code-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        marginTop: '10px',
        fontFamily: 'var(--font-mono)',
        fontSize: '12px',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 14px',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-color)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            background: 'var(--accent-cyan-subtle)',
            color: 'var(--accent-cyan)',
            padding: '2px 7px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 700,
          }}>
            Source [{sourceIndex}]
          </span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
            {chunk.file_path}
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
            Lines {chunk.start_line}–{chunk.end_line}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={handleCopy}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              transition: 'color 0.15s ease',
            }}
          >
            {copied ? <Check size={12} color="var(--accent-emerald)" /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <a
            href={getGitHubUrl()}
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
            GitHub <ExternalLink size={11} />
          </a>
        </div>
      </div>
      <pre style={{
        padding: '12px 16px',
        overflowX: 'auto',
        color: 'var(--text-primary)',
        lineHeight: 1.6,
        maxHeight: '220px',
        margin: 0,
        fontSize: '12px',
        background: 'var(--code-bg)',
        border: 'none',
        borderRadius: 0,
      }}>
        <code>{chunk.text}</code>
      </pre>
    </div>
  );
};

interface SourcePanelProps {
  sources: SourceChunk[];
  repoName?: string;
}

export const SourcePanel: React.FC<SourcePanelProps> = ({ sources, repoName }) => {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  if (!sources || sources.length === 0) return null;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'code': return <Code2 size={12} color="var(--accent-cyan)" />;
      case 'doc': return <FileText size={12} color="var(--accent-emerald)" />;
      case 'issue': return <AlertCircle size={12} color="var(--accent-amber)" />;
      default: return <Code2 size={12} color="var(--accent-cyan)" />;
    }
  };

  const toggleSnippet = (idx: number) => {
    setSelectedIdx(selectedIdx === idx ? null : idx);
  };

  return (
    <div style={{ marginTop: '16px' }}>
      {/* Sleek Minimalist Label */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        marginBottom: '8px',
        fontSize: '11px',
        fontWeight: 600,
        color: 'var(--text-muted)',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}>
        <BookOpen size={12} color="var(--accent-cyan)" />
        <span>Sources ({sources.length})</span>
      </div>

      {/* Perplexity/Google-style horizontal card badges */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        alignItems: 'center',
      }}>
        {sources.map((s, idx) => {
          const isSelected = selectedIdx === idx;
          const fileName = s.file_path.split('/').pop() || s.file_path;
          return (
            <button
              key={idx}
              onClick={() => toggleSnippet(idx)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                padding: '5px 12px',
                borderRadius: '999px',
                background: isSelected ? 'var(--accent-cyan-subtle)' : 'var(--bg-card)',
                border: isSelected ? '1px solid var(--accent-cyan)' : '1px solid var(--border-color)',
                color: isSelected ? 'var(--accent-cyan)' : 'var(--text-primary)',
                fontSize: '12px',
                fontFamily: 'var(--font-sans)',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                boxShadow: isSelected ? '0 0 12px var(--accent-cyan-glow)' : 'var(--shadow-sm)',
              }}
              title={`${s.file_path} (Lines ${s.start_line}-${s.end_line})`}
            >
              <span style={{
                fontSize: '10.5px',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                color: isSelected ? 'var(--accent-cyan)' : 'var(--text-muted)',
              }}>
                {idx + 1}
              </span>
              <span style={{
                display: 'flex',
                alignItems: 'center',
                opacity: 0.85,
              }}>
                {getTypeIcon(s.type)}
              </span>
              <span style={{
                fontWeight: 500,
                maxWidth: '180px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {fileName}
              </span>
              <span style={{
                color: 'var(--text-muted)',
                fontSize: '10.5px',
                fontFamily: 'var(--font-mono)',
              }}>
                L{s.start_line}
              </span>
              {isSelected ? (
                <ChevronUp size={12} color="var(--accent-cyan)" />
              ) : (
                <ChevronDown size={12} color="var(--text-muted)" />
              )}
            </button>
          );
        })}
      </div>

      {/* Expanded Snippet Inspector */}
      {selectedIdx !== null && sources[selectedIdx] && (
        <SourceSnippet
          chunk={sources[selectedIdx]}
          repoName={repoName}
          sourceIndex={selectedIdx + 1}
        />
      )}
    </div>
  );
};
