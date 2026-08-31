import React, { useState } from 'react';
import { Activity, Zap, CheckCircle2, XCircle, ChevronDown, ChevronUp, Clock, Filter } from 'lucide-react';
import { TraceInfo } from '../lib/types';

interface TraceViewProps {
  trace?: TraceInfo;
}

export const TraceView: React.FC<TraceViewProps> = ({ trace }) => {
  const [expanded, setExpanded] = useState(false);

  if (!trace) return null;

  return (
    <div style={{
      marginTop: '12px',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-color)',
      borderRadius: '8px',
      padding: '10px 14px',
      fontSize: '12px',
      fontFamily: 'var(--font-mono)'
    }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          userSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={14} color="var(--accent-cyan)" />
          <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>PIPELINE TRACE & REASONING</span>
          <span style={{
            fontSize: '10px',
            background: 'var(--bg-card)',
            color: 'var(--accent-cyan)',
            padding: '2px 6px',
            borderRadius: '4px'
          }}>
            {trace.latency_ms} ms
          </span>
          <span style={{
            fontSize: '10px',
            background: trace.guardrail_passed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
            color: trace.guardrail_passed ? 'var(--accent-emerald)' : 'var(--accent-rose)',
            padding: '2px 6px',
            borderRadius: '4px',
            fontWeight: 600
          }}>
            {trace.guardrail_passed ? 'Grounded' : 'Declined (Guardrail)'}
          </span>
        </div>
        <div>
          {expanded ? <ChevronUp size={14} color="var(--text-muted)" /> : <ChevronDown size={14} color="var(--text-muted)" />}
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <Filter size={13} color="var(--text-muted)" style={{ marginTop: '2px' }} />
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Query Router: </span>
              <strong style={{ color: 'var(--accent-cyan)' }}>{trace.intent.toUpperCase()}</strong>
              <div style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '2px' }}>
                {trace.router_reason}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={13} color="var(--text-muted)" />
            <span style={{ color: 'var(--text-muted)' }}>Retrieval & Re-ranking: </span>
            <span style={{ color: 'var(--text-secondary)' }}>
              Top-{trace.retrieved_count} Hybrid candidates &rarr; Top-{trace.reranked_count} Re-ranked (ms-marco-MiniLM)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {trace.guardrail_passed ? (
              <CheckCircle2 size={13} color="var(--accent-emerald)" />
            ) : (
              <XCircle size={13} color="var(--accent-rose)" />
            )}
            <span style={{ color: 'var(--text-muted)' }}>Guardrail Status: </span>
            <span style={{ color: trace.guardrail_passed ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
              {trace.guardrail_reason}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={13} color="var(--text-muted)" />
            <span style={{ color: 'var(--text-muted)' }}>Model Configuration: </span>
            <span style={{ color: 'var(--text-secondary)' }}>
              {trace.model} ({trace.provider})
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
