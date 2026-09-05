import React, { useState, useRef } from 'react';
import { GitPullRequest, CheckCircle2, AlertCircle, X, GitBranch, Cpu, Database, Zap, PackageCheck } from 'lucide-react';

interface RepoIngestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (repoName: string, commitSha: string, totalChunks: number) => void;
}

type Stage = 'idle' | 'cloning' | 'chunking' | 'indexing' | 'embedding' | 'storing' | 'done' | 'error';

interface ProgressState {
  stage: Stage;
  message: string;
  progress: number;
}

const STAGE_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  cloning:   { label: 'Cloning Repo',    icon: <GitBranch size={14} />,    color: '#38bdf8' },
  chunking:  { label: 'Parsing AST',     icon: <Cpu size={14} />,          color: '#a78bfa' },
  indexing:  { label: 'Building BM25',   icon: <Zap size={14} />,          color: '#fb923c' },
  embedding: { label: 'Embedding',       icon: <PackageCheck size={14} />, color: '#34d399' },
  storing:   { label: 'Storing Vectors', icon: <Database size={14} />,     color: '#f472b6' },
  done:      { label: 'Complete',        icon: <CheckCircle2 size={14} />, color: '#10b981' },
  error:     { label: 'Error',           icon: <AlertCircle size={14} />,  color: '#f43f5e' },
};

const PIPELINE_STAGES: Stage[] = ['cloning', 'chunking', 'indexing', 'embedding', 'storing', 'done'];

export const RepoIngestModal: React.FC<RepoIngestModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [repoUrl, setRepoUrl] = useState('');
  const [progress, setProgress] = useState<ProgressState>({ stage: 'idle', message: '', progress: 0 });
  const [logs, setLogs] = useState<string[]>([]);
  const [resultInfo, setResultInfo] = useState<string | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null);
  const isRunning = progress.stage !== 'idle' && progress.stage !== 'done' && progress.stage !== 'error';

  if (!isOpen) return null;

  const addLog = (msg: string) => setLogs(prev => [...prev.slice(-8), msg]);

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = repoUrl.trim();
    if (!trimmed || isRunning) return;

    setProgress({ stage: 'cloning', message: 'Starting…', progress: 5 });
    setLogs([]);
    setResultInfo(null);

    try {
      const res = await fetch('http://localhost:8000/reindex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_url: trimmed }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Server error: ${res.status}`);
      }

      const reader = res.body.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let buffer = '';

      const processBlock = (block: string) => {
        if (!block.trim()) return;
        const lines = block.split(/\r?\n/);
        let eventType = '';
        let eventData = '';

        for (const line of lines) {
          if (line.startsWith('event:')) eventType = line.slice(6).trim();
          else if (line.startsWith('data:')) eventData = line.slice(5).trim();
        }

        if (!eventData) return;

        try {
          const parsed = JSON.parse(eventData);
          const stage = (parsed.stage || eventType || 'cloning') as Stage;
          const message = parsed.message || '';
          const pct = parsed.progress || 0;

          setProgress({ stage, message, progress: pct });
          addLog(message);

          if (stage === 'done') {
            const total = parsed.chunks_ingested?.total || 0;
            const sha = (parsed.commit_sha || '').slice(0, 7);
            const repoName = parsed.repo_name || trimmed.split('/').pop() || 'repo';
            setResultInfo(`✓ Indexed ${total} chunks from ${repoName} (${parsed.elapsed_seconds}s)`);
            onSuccess(repoName, sha, total);
            setTimeout(() => {
              handleClose();
            }, 2500);
          }
        } catch (_) {}
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop() || '';

        for (const block of blocks) {
          processBlock(block);
        }
      }

      // Process any trailing event in the remaining buffer
      if (buffer.trim()) {
        processBlock(buffer);
      }
    } catch (err) {
      const msg = (err as Error).message || 'Connection failed';
      setProgress({ stage: 'error', message: msg, progress: 0 });
      addLog(`Error: ${msg}`);
    }
  };

  const handleClose = () => {
    readerRef.current?.cancel().catch(() => {});
    readerRef.current = null;
    setProgress({ stage: 'idle', message: '', progress: 0 });
    setLogs([]);
    setResultInfo(null);
    onClose();
  };

  const currentStageIdx = PIPELINE_STAGES.indexOf(progress.stage as Stage);
  const stageMeta = STAGE_META[progress.stage] || STAGE_META['cloning'];

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.38)',
      backdropFilter: 'blur(2px)',
      WebkitBackdropFilter: 'blur(2px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-color)',
        borderRadius: '14px',
        width: '100%',
        maxWidth: '520px',
        padding: '26px',
        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.6)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Animated top gradient accent */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: '2px',
          background: isRunning
            ? `linear-gradient(90deg, transparent ${100 - progress.progress}%, ${stageMeta.color} ${100 - progress.progress}%)`
            : progress.stage === 'done'
            ? 'var(--accent-emerald)'
            : progress.stage === 'error'
            ? 'var(--accent-rose)'
            : 'var(--border-color)',
          transition: 'background 0.5s ease'
        }} />

        {/* Header */}
        <button
          onClick={handleClose}
          disabled={isRunning}
          style={{
            position: 'absolute', top: '16px', right: '16px',
            background: 'transparent', border: 'none',
            color: 'var(--text-muted)', cursor: isRunning ? 'not-allowed' : 'pointer',
            opacity: isRunning ? 0.4 : 1
          }}
        >
          <X size={18} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <div style={{
            background: 'rgba(56, 189, 248, 0.12)',
            padding: '8px', borderRadius: '8px', color: 'var(--accent-cyan)'
          }}>
            <GitPullRequest size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: '17px', fontWeight: 700, margin: 0 }}>Ingest GitHub Repository</h2>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
              Clone · AST Parse · Embed · Vector Index
            </p>
          </div>
        </div>

        {/* URL form — hide once running */}
        {!isRunning && progress.stage === 'idle' && (
          <form onSubmit={handleIngest} style={{ marginTop: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px', letterSpacing: '0.06em' }}>
                GITHUB REPOSITORY URL
              </label>
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/owner/repository"
                autoFocus
                style={{
                  width: '100%',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '7px',
                  padding: '10px 13px',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={handleClose}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-secondary)',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!repoUrl.trim()}
                style={{
                  background: repoUrl.trim() ? 'var(--accent-cyan)' : 'var(--bg-card)',
                  color: repoUrl.trim() ? '#000' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 20px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: repoUrl.trim() ? 'pointer' : 'not-allowed'
                }}
              >
                Ingest &amp; Index →
              </button>
            </div>
          </form>
        )}

        {/* Progress UI — shown while running or done/error */}
        {progress.stage !== 'idle' && (
          <div style={{ marginTop: '18px' }}>
            {/* Stage pills */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
              {PIPELINE_STAGES.filter(s => s !== 'done').map((stage, idx) => {
                const meta = STAGE_META[stage];
                const isPast = currentStageIdx > idx;
                const isCurrent = progress.stage === stage;
                const isFuture = !isPast && !isCurrent && progress.stage !== 'error';
                return (
                  <div
                    key={stage}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 9px',
                      borderRadius: '99px',
                      fontSize: '11px',
                      fontWeight: 600,
                      border: `1px solid ${isCurrent ? meta.color : isPast ? 'rgba(16,185,129,0.4)' : 'var(--border-color)'}`,
                      background: isCurrent
                        ? `${meta.color}18`
                        : isPast
                        ? 'rgba(16,185,129,0.08)'
                        : 'transparent',
                      color: isCurrent ? meta.color : isPast ? '#10b981' : 'var(--text-muted)',
                      transition: 'all 0.3s ease',
                      opacity: isFuture ? 0.45 : 1
                    }}
                  >
                    {isPast ? <CheckCircle2 size={11} /> : meta.icon}
                    <span>{meta.label}</span>
                  </div>
                );
              })}
            </div>

            {/* Big progress bar */}
            <div style={{
              height: '6px',
              background: 'var(--bg-card)',
              borderRadius: '99px',
              overflow: 'hidden',
              marginBottom: '10px'
            }}>
              <div style={{
                height: '100%',
                width: `${progress.progress}%`,
                background: progress.stage === 'error'
                  ? 'var(--accent-rose)'
                  : progress.stage === 'done'
                  ? 'var(--accent-emerald)'
                  : `linear-gradient(90deg, #38bdf8, ${stageMeta.color})`,
                borderRadius: '99px',
                transition: 'width 0.6s cubic-bezier(0.25, 1, 0.5, 1)',
                boxShadow: isRunning ? `0 0 12px ${stageMeta.color}55` : 'none'
              }} />
            </div>

            {/* Current message */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '14px'
            }}>
              <span style={{
                fontSize: '12px',
                color: progress.stage === 'error' ? 'var(--accent-rose)'
                     : progress.stage === 'done' ? 'var(--accent-emerald)'
                     : 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                {isRunning && (
                  <span style={{
                    display: 'inline-block',
                    width: '6px', height: '6px',
                    borderRadius: '50%',
                    background: stageMeta.color,
                    animation: 'pulse-dot 1.2s ease-in-out infinite'
                  }} />
                )}
                {progress.message}
              </span>
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                {progress.progress}%
              </span>
            </div>

            {/* Live log */}
            {logs.length > 0 && (
              <div style={{
                background: 'var(--bg-card)',
                borderRadius: '7px',
                border: '1px solid var(--border-color)',
                padding: '10px 12px',
                maxHeight: '110px',
                overflowY: 'auto',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: 'var(--text-muted)',
                lineHeight: 1.7
              }}>
                {logs.map((log, i) => (
                  <div key={i} style={{
                    color: i === logs.length - 1 ? 'var(--text-secondary)' : 'var(--text-muted)',
                    fontWeight: i === logs.length - 1 ? 500 : 400
                  }}>
                    <span style={{ color: 'var(--accent-cyan)', marginRight: '6px' }}>›</span>
                    {log}
                  </div>
                ))}
              </div>
            )}

            {/* Done / Error actions */}
            {(progress.stage === 'done' || progress.stage === 'error') && (
              <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                {progress.stage === 'error' && (
                  <button
                    onClick={() => {
                      setProgress({ stage: 'idle', message: '', progress: 0 });
                      setLogs([]);
                    }}
                    style={{
                      background: 'rgba(244,63,94,0.12)',
                      border: '1px solid rgba(244,63,94,0.3)',
                      color: 'var(--accent-rose)',
                      borderRadius: '6px',
                      padding: '7px 14px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Try Again
                  </button>
                )}
                <button
                  onClick={handleClose}
                  style={{
                    background: progress.stage === 'done' ? 'var(--accent-emerald)' : 'transparent',
                    color: progress.stage === 'done' ? '#000' : 'var(--text-secondary)',
                    border: progress.stage === 'done' ? 'none' : '1px solid var(--border-color)',
                    borderRadius: '6px',
                    padding: '7px 16px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {progress.stage === 'done' ? 'Done ✓' : 'Close'}
                </button>
              </div>
            )}
          </div>
        )}

        <style>{`
          @keyframes pulse-dot {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.4; transform: scale(0.7); }
          }
        `}</style>
      </div>
    </div>
  );
};
