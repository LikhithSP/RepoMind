import React, { useState } from 'react';
import { Activity, Zap, CheckCircle2, XCircle, ChevronDown, ChevronUp, Clock, Filter, ShieldCheck } from 'lucide-react';
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
      background: 'rgba(255, 255, 255, 0.015)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-md)',
      padding: '8px 12px',
      fontSize: '11.5px',
      fontFamily: 'var(--font-mono)',
      transition: 'border-color 0.15s ease',
    }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <Activity size={13} color="var(--accent-cyan)" />
          <span style={{ fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.02em' }}>
            PIPELINE TRACE
          </span>
          <span style={{
            fontSize: '10px',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid var(--border-color)',
            color: 'var(--accent-cyan)',
            padding: '1px 5px',
            borderRadius: '4px',
          }}>
            {trace.latency_ms}ms
          </span>
          <span style={{
            fontSize: '10px',
            background: trace.guardrail_passed ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
            border: `1px solid ${trace.guardrail_passed ? 'rgba(16, 185, 129, 0.25)' : 'rgba(244, 63, 94, 0.25)'}`,
            color: trace.guardrail_passed ? 'var(--accent-emerald)' : 'var(--accent-rose)',
            padding: '1px 6px',
            borderRadius: '4px',
            fontWeight: 600,
          }}>
            {trace.guardrail_passed ? 'Grounded' : 'Guardrail Flagged'}
          </span>
        </div>
        <div style={{ color: 'var(--text-muted)' }}>
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </div>
      </div>

      {expanded && (
        <div style={{
          marginTop: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: '10px',
          color: 'var(--text-secondary)',
          lineHeight: '1.5',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <Filter size={12} color="var(--text-muted)" style={{ marginTop: '2px' }} />
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Router: </span>
              <strong style={{ color: 'var(--accent-cyan)' }}>{trace.intent.toUpperCase()}</strong>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '1px' }}>
                {trace.router_reason}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={12} color="var(--text-muted)" />
            <span>
              Top-{trace.retrieved_count} Hybrid hits &rarr; Top-{trace.reranked_count} Re-ranked (ms-marco)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {trace.guardrail_passed ? (
              <CheckCircle2 size={12} color="var(--accent-emerald)" />
            ) : (
              <XCircle size={12} color="var(--accent-rose)" />
            )}
            <span style={{ color: trace.guardrail_passed ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
              {trace.guardrail_reason}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={12} color="var(--text-muted)" />
            <span>
              {trace.model} ({trace.provider})
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
