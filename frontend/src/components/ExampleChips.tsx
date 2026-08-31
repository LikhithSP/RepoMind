import React from 'react';
import { Sparkles } from 'lucide-react';

interface ExampleChipsProps {
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}

const EXAMPLES = [
  "How does the Session class coordinate connection pooling and request preparation?",
  "Where is the HTTPAdapter defined and how does it interact with urllib3 PoolManager?",
  "How is HTTP Basic Authentication implemented?",
  "What is the discussion around supporting HTTP/2 connection pooling?"
];

export const ExampleChips: React.FC<ExampleChipsProps> = ({ onSelect, disabled }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '780px', margin: '0 auto 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600 }}>
        <Sparkles size={14} color="var(--accent-cyan)" />
        <span>SUGGESTED ENGINEERING QUERIES</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {EXAMPLES.map((ex, i) => (
          <button
            key={i}
            onClick={() => onSelect(ex)}
            disabled={disabled}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)',
              borderRadius: '8px',
              padding: '8px 14px',
              fontSize: '13px',
              cursor: disabled ? 'not-allowed' : 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease',
            }}
            onMouseOver={(e) => {
              if (!disabled) {
                e.currentTarget.style.borderColor = 'var(--accent-cyan)';
                e.currentTarget.style.color = 'var(--text-primary)';
                e.currentTarget.style.background = 'var(--bg-card-hover)';
              }
            }}
            onMouseOut={(e) => {
              if (!disabled) {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.color = 'var(--text-secondary)';
                e.currentTarget.style.background = 'var(--bg-card)';
              }
            }}
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
};
