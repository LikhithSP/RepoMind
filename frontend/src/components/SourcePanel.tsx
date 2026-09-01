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

  const handleCopy = () => {
    navigator.clipboard.writeText(chunk.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getGitHubUrl = () => {
    if (chunk.url) return chunk.url;
    return `https://github.com/${repoName}/blob/main/${chunk.file_path}#L${chunk.start_line}-L${chunk.end_line}`;
  };

  return (
    <div style={{
      background: 'var(--code-bg)',
      border: '1px solid var(--border-color)',
      borderRadius: '6px',
      overflow: 'hidden',
      marginTop: '6px',
      fontFamily: 'var(--font-mono)',
      fontSize: '11px'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '4px 10px',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-color)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            background: 'rgba(56, 189, 248, 0.2)',
            color: 'var(--accent-cyan)',
            padding: '0 5px',
            borderRadius: '10px',
            fontSize: '10px',
            fontWeight: 700
          }}>
            {sourceIndex}
          </span>
          <span style={{ color: 'var(--text-secondary)' }}>
            {chunk.file_path} (L{chunk.start_line}–{chunk.end_line})
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={handleCopy}
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
            {copied ? <Check size={11} color="var(--accent-emerald)" /> : <Copy size={11} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <a
            href={getGitHubUrl()}
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
            GitHub <ExternalLink size={10} />
          </a>
        </div>
      </div>
      <pre style={{
        padding: '8px 10px',
        overflowX: 'auto',
        color: '#e2e8f0',
        lineHeight: 1.45,
        maxHeight: '180px',
        margin: 0,
        fontSize: '11px'
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
      default: return <Code2 size={12} />;
    }
  };

  const toggleSnippet = (idx: number) => {
    setSelectedIdx(selectedIdx === idx ? null : idx);
  };

  return (
    <div style={{
      marginTop: '12px',
      padding: '8px 12px',
      background: 'rgba(20, 23, 33, 0.6)',
      border: '1px solid rgba(40, 47, 69, 0.6)',
      borderRadius: '8px',
      fontSize: '12px',
    }}>
      {/* Notebook-style Minimal Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '6px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          <BookOpen size={12} color="var(--accent-cyan)" />
          <span>Cited Sources ({sources.length})</span>
        </div>
      </div>

      {/* Small compact pills corresponding to [1], [2], [3] */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px',
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
                gap: '5px',
                padding: '2px 8px',
                borderRadius: '6px',
                background: isSelected ? 'rgba(56, 189, 248, 0.18)' : 'rgba(255, 255, 255, 0.04)',
                border: isSelected ? '1px solid var(--accent-cyan)' : '1px solid var(--border-color)',
                color: isSelected ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title={`${s.file_path} (Lines ${s.start_line}-${s.end_line})`}
            >
              <span style={{
                fontSize: '10px',
                fontWeight: 700,
                color: isSelected ? 'var(--accent-cyan)' : 'var(--text-muted)'
              }}>
                [{idx + 1}]
              </span>
              {getTypeIcon(s.type)}
              <span style={{ fontWeight: 500 }}>{fileName}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                L{s.start_line}-{s.end_line}
              </span>
              {isSelected ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
          );
        })}
      </div>

      {/* Display preview of chosen snippet right below */}
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
