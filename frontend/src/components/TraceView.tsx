import React, { useState } from 'react';
import { Activity, Zap, CheckCircle2, XCircle, ChevronDown, ChevronUp, Clock, Filter, ShieldCheck, Cpu } from 'lucide-react';
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
      fontSize: '12px',
      fontFamily: 'var(--font-sans)',
    }}>
      {/* Sleek Accordion Trigger */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '999px',
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'all 0.15s ease',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <Activity size={13} color="var(--accent-cyan)" />
        <span style={{ fontWeight: 600, fontSize: '11.5px', color: 'var(--text-secondary)', letterSpacing: '0.02em' }}>
          Pipeline Trace
        </span>
        <span style={{
          fontSize: '10.5px',
          fontFamily: 'var(--font-mono)',
          color: 'var(--accent-cyan)',
          fontWeight: 600,
        }}>
          {trace.latency_ms}ms
        </span>
        <span style={{
          fontSize: '10px',
          background: trace.guardrail_passed ? 'var(--accent-emerald-subtle)' : 'rgba(244, 63, 94, 0.12)',
          border: `1px solid ${trace.guardrail_passed ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
          color: trace.guardrail_passed ? 'var(--accent-emerald)' : 'var(--accent-rose)',
          padding: '1px 6px',
          borderRadius: '99px',
          fontWeight: 600,
          fontFamily: 'var(--font-sans)',
        }}>
          {trace.guardrail_passed ? 'Grounded' : 'Flagged'}
        </span>
        <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </span>
      </div>

      {/* Expanded Pipeline Telemetry Details */}
      {expanded && (
        <div
          className="animate-fade-in"
          style={{
            marginTop: '10px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            maxWidth: '680px',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          {/* Step 1: Query Router */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <div style={{
              width: '24px',
              height: '24px',
              borderRadius: '6px',
              background: 'var(--accent-cyan-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Filter size={12} color="var(--accent-cyan)" />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Query Router
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--text-primary)', fontWeight: 600, marginTop: '1px' }}>
                Intent: <span style={{ color: 'var(--accent-cyan)' }}>{trace.intent.toUpperCase()}</span>
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '11.5px', marginTop: '2px', lineHeight: 1.5 }}>
                {trace.router_reason}
              </div>
            </div>
          </div>

          {/* Step 2: Hybrid Retrieval & Reranker */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <div style={{
              width: '24px',
              height: '24px',
              borderRadius: '6px',
              background: 'rgba(245, 158, 11, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Zap size={12} color="var(--accent-amber)" />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Retrieval &amp; Re-ranking
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--text-primary)', fontWeight: 500, marginTop: '1px' }}>
                Top-{trace.retrieved_count} Hybrid Candidates &rarr; Top-{trace.reranked_count} Cross-Encoder Re-ranked
              </div>
            </div>
          </div>

          {/* Step 3: Semantic Grounding & Guardrail */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <div style={{
              width: '24px',
              height: '24px',
              borderRadius: '6px',
              background: trace.guardrail_passed ? 'var(--accent-emerald-subtle)' : 'rgba(244, 63, 94, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              {trace.guardrail_passed ? (
                <ShieldCheck size={12} color="var(--accent-emerald)" />
              ) : (
                <XCircle size={12} color="var(--accent-rose)" />
              )}
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Verification Guardrail
              </div>
              <div style={{
                fontSize: '12.5px',
                color: trace.guardrail_passed ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                fontWeight: 600,
                marginTop: '1px'
              }}>
                {trace.guardrail_passed ? 'Grounded & Verified' : 'Guardrail Flagged'}
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '11.5px', marginTop: '2px' }}>
                {trace.guardrail_reason}
              </div>
            </div>
          </div>

          {/* Step 4: Model Engine Telemetry */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <div style={{
              width: '24px',
              height: '24px',
              borderRadius: '6px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Cpu size={12} color="var(--text-muted)" />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Inference Engine
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', marginTop: '1px' }}>
                {trace.model} ({trace.provider}) &middot; {trace.latency_ms}ms total
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
