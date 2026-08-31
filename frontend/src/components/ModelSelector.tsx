import React from 'react';
import { Cpu } from 'lucide-react';

interface ModelSelectorProps {
  provider: string;
  model: string;
  onChange: (provider: string, model: string) => void;
  disabled?: boolean;
}

const MODELS = [
  { provider: 'groq', model: 'qwen/qwen3.8-27b', label: 'Groq — Qwen 3.8 27B (Live AI Assistant ⚡ Recommended)' },
  { provider: 'groq', model: 'qwen/qwen3.6-27b', label: 'Groq — Qwen 3.6 27B' },
  { provider: 'mock', model: 'mock-code-expert', label: 'Local Mock Expert (Offline Template)' },
  { provider: 'openai', model: 'gpt-4o-mini', label: 'OpenAI — GPT-4o-mini' },
  { provider: 'anthropic', model: 'claude-3-5-haiku-latest', label: 'Anthropic — Claude 3.5 Haiku' },
];

export const ModelSelector: React.FC<ModelSelectorProps> = ({ provider, model, onChange, disabled }) => {
  const currentKey = `${provider}:${model}`;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <Cpu size={14} color="var(--text-muted)" />
      <select
        value={currentKey}
        disabled={disabled}
        onChange={(e) => {
          const [p, m] = e.target.value.split(':');
          onChange(p, m);
        }}
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          color: 'var(--text-primary)',
          borderRadius: '6px',
          padding: '4px 8px',
          fontSize: '12px',
          fontFamily: 'var(--font-mono)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          outline: 'none'
        }}
      >
        {MODELS.map((item) => (
          <option key={`${item.provider}:${item.model}`} value={`${item.provider}:${item.model}`}>
            {item.label}
          </option>
        ))}
      </select>
    </div>
  );
};
