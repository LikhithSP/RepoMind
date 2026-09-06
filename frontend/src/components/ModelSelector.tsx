import React, { useState, useEffect } from 'react';
import { Cpu, ChevronDown, Key, Check, AlertCircle, X, ShieldAlert, Sparkles, ExternalLink } from 'lucide-react';

interface ModelSelectorProps {
  provider: string;
  model: string;
  onChange: (provider: string, model: string) => void;
  disabled?: boolean;
  compact?: boolean;
  hasEnvGroqKey?: boolean;
  userApiKey?: string;
  onApiKeyChange?: (key: string) => void;
}

const GROQ_MODELS = [
  { provider: 'groq', model: 'qwen/qwen3.8-27b', label: 'Qwen 3.8 27B', tag: 'Fast' },
  { provider: 'groq', model: 'qwen/qwen3.6-27b', label: 'Qwen 3.6 27B', tag: 'Balanced' },
  { provider: 'groq', model: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', tag: 'Versatile' },
  { provider: 'groq', model: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B', tag: 'Instant' },
  { provider: 'mock', model: 'mock-code-expert', label: 'Offline Assistant', tag: 'Local/Free' },
];

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  provider,
  model,
  onChange,
  disabled,
  compact,
  hasEnvGroqKey = false,
  userApiKey = '',
  onApiKeyChange,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(userApiKey);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    setApiKeyInput(userApiKey);
  }, [userApiKey]);

  const hasActiveKey = hasEnvGroqKey || Boolean(userApiKey && userApiKey.trim().length > 5);

  const handleSaveKey = () => {
    const trimmed = apiKeyInput.trim();
    if (onApiKeyChange) {
      onApiKeyChange(trimmed);
    }
    try {
      localStorage.setItem('repomind_user_groq_key', trimmed);
    } catch (_) {}
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      setIsModalOpen(false);
    }, 900);
  };

  const handleClearKey = () => {
    setApiKeyInput('');
    if (onApiKeyChange) {
      onApiKeyChange('');
    }
    try {
      localStorage.removeItem('repomind_user_groq_key');
    } catch (_) {}
  };

  const activeModelObj = GROQ_MODELS.find(m => m.provider === provider && m.model === model) || GROQ_MODELS[0];

  return (
    <>
      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        
        {/* Model Dropdown Pill */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: compact ? '4px 8px' : '5px 10px',
          background: compact ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-color)',
          borderRadius: compact ? '999px' : 'var(--radius-sm)',
          transition: 'all 0.15s ease',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}>
          {/* Status Indicator (Green if env or user key is set, Amber if none) */}
          <div 
            title={hasActiveKey ? "Groq API ready" : "No Groq API Key set - click key icon"}
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: hasActiveKey ? 'var(--accent-emerald)' : 'var(--accent-amber)',
              boxShadow: hasActiveKey ? '0 0 8px var(--accent-emerald)' : '0 0 8px var(--accent-amber)',
              flexShrink: 0,
            }} 
          />
          
          <Cpu size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />

          <select
            value={`${provider}:${model}`}
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
            {GROQ_MODELS.map((item) => (
              <option
                key={`${item.provider}:${item.model}`}
                value={`${item.provider}:${item.model}`}
                style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
              >
                {item.label} · {item.tag}
              </option>
            ))}
          </select>
          <ChevronDown size={11} color="var(--text-muted)" style={{ position: 'absolute', right: '32px', pointerEvents: 'none' }} />
        </div>

        {/* API Key Modal Trigger Icon */}
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          title={hasActiveKey ? "Configure Groq API Key (Active)" : "Set Groq API Key"}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '5px 7px',
            background: hasActiveKey ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.1)',
            border: hasActiveKey ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '999px',
            color: hasActiveKey ? 'var(--accent-emerald)' : 'var(--accent-amber)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <Key size={12} strokeWidth={2.2} />
        </button>
      </div>

      {/* API Key Dialog Modal */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.45)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
        }}
        onClick={() => setIsModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '460px',
              background: 'rgba(15, 18, 25, 0.96)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 'var(--radius-lg)',
              padding: '24px',
              boxShadow: '0 24px 60px -8px rgba(0, 0, 0, 0.8), 0 0 1px 1px rgba(255, 255, 255, 0.05)',
              position: 'relative',
              animation: 'fadeIn 0.2s ease',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(56, 189, 248, 0.1)',
                  border: '1px solid var(--accent-cyan-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-cyan)',
                }}>
                  <Key size={16} />
                </div>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                    Groq API Key
                  </h3>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    LLM acceleration for ultra-fast generation
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Status Info Card */}
            {hasEnvGroqKey ? (
              <div style={{
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 14px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                color: 'var(--text-primary)',
              }}>
                <Check size={14} color="var(--accent-emerald)" strokeWidth={2.5} />
                <span>
                  <strong>Server key detected:</strong> A valid <code style={{ fontSize: '11px' }}>GROQ_API_KEY</code> is configured in <code style={{ fontSize: '11px' }}>.env</code>.
                </span>
              </div>
            ) : (
              <div style={{
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 14px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                color: 'var(--text-primary)',
              }}>
                <AlertCircle size={14} color="var(--accent-amber)" strokeWidth={2} />
                <span>No key found in server <code style={{ fontSize: '11px' }}>.env</code>. Paste your personal key below.</span>
              </div>
            )}

            {/* Input Form */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--text-secondary)',
                marginBottom: '6px',
              }}>
                {hasEnvGroqKey ? "Custom Key Override (Optional)" : "Enter your Groq API Key"}
              </label>
              
              <input
                type="password"
                placeholder="gsk_..."
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '9px 12px',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  fontFamily: 'var(--font-mono)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--accent-cyan)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
              />

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: '8px',
                fontSize: '11.5px',
                color: 'var(--text-muted)',
              }}>
                <span>Stored securely in browser local storage.</span>
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    color: 'var(--accent-cyan)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    textDecoration: 'none',
                  }}
                >
                  <span>Get API key</span>
                  <ExternalLink size={11} />
                </a>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
              {userApiKey && (
                <button
                  type="button"
                  onClick={handleClearKey}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--border-color)',
                    color: 'var(--accent-rose)',
                    padding: '7px 12px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Remove Key
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-secondary)',
                  padding: '7px 12px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>

              <button
                type="button"
                onClick={handleSaveKey}
                style={{
                  background: savedSuccess ? 'var(--accent-emerald)' : 'var(--accent-cyan)',
                  border: 'none',
                  color: '#07080c',
                  fontWeight: 600,
                  padding: '7px 16px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  transition: 'background-color 0.15s ease',
                }}
              >
                {savedSuccess ? (
                  <>
                    <Check size={14} strokeWidth={2.5} />
                    <span>Saved!</span>
                  </>
                ) : (
                  <span>Save Key</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
