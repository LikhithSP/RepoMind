import React from 'react';
import { Cpu, ChevronDown, Sparkles } from 'lucide-react';

interface ModelSelectorProps {
  provider: string;
  model: string;
  onChange: (provider: string, model: string) => void;
  disabled?: boolean;
  compact?: boolean;
}

const MODELS = [
  { provider: 'groq', model: 'qwen/qwen3.8-27b', label: 'Qwen 3.8 27B', tag: 'Fast', isLive: true },
  { provider: 'groq', model: 'qwen/qwen3.6-27b', label: 'Qwen 3.6 27B', tag: 'Groq', isLive: true },
  { provider: 'mock', model: 'mock-code-expert', label: 'Offline Assistant', tag: 'Local', isLive: false },
  { provider: 'openai', model: 'gpt-4o-mini', label: 'GPT-4o Mini', tag: 'OpenAI', isLive: true },
  { provider: 'anthropic', model: 'claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku', tag: 'Anthropic', isLive: true },
];

export const ModelSelector: React.FC<ModelSelectorProps> = ({ provider, model, onChange, disabled, compact }) => {
  const currentKey = `${provider}:${model}`;

  return (
    <div style={{
      position: 'relative',
      display: 'inline-flex',
      alignItems: 'center',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: compact ? '4px 8px' : '5px 10px',
        background: compact ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.03)',
        border: compact ? '1px solid var(--border-color)' : '1px solid var(--border-color)',
        borderRadius: compact ? '999px' : 'var(--radius-sm)',
        transition: 'all 0.15s ease',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}>
        <div style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: 'var(--accent-emerald)',
          boxShadow: '0 0 8px var(--accent-emerald)',
        }} />
        <Cpu size={13} color="var(--text-muted)" />
        <select
          value={currentKey}
          disabled={disabled}
          onChange={(e) => {
            const [p, m] = e.target.value.split(':');
            onChange(p, m);
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-primary)',
            fontSize: '12px',
            fontWeight: 500,
            fontFamily: 'var(--font-sans)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            outline: 'none',
            appearance: 'none',
            paddingRight: '16px',
          }}
        >
          {MODELS.map((item) => (
            <option
              key={`${item.provider}:${item.model}`}
              value={`${item.provider}:${item.model}`}
              style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
            >
              {item.label} · {item.tag}
            </option>
          ))}
        </select>
        <ChevronDown size={11} color="var(--text-muted)" style={{ position: 'absolute', right: '10px', pointerEvents: 'none' }} />
      </div>
    </div>
  );
};
