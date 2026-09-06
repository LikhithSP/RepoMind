import React, { useState } from 'react';
import { 
  Trash2, 
  MoreVertical,
} from 'lucide-react';
import { ChatSession } from '../lib/types';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
  onClearAll: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onToggle,
  sessions,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onClearAll,
}) => {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const filteredSessions = sessions;

  return (
    <aside
      style={{
        width: isOpen ? '250px' : '0px',
        minWidth: isOpen ? '250px' : '0px',
        height: '100%',
        backgroundColor: 'var(--sidebar-bg)',
        borderRight: isOpen ? '1px solid var(--sidebar-border)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.22s cubic-bezier(0.16, 1, 0.3, 1), min-width 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        overflow: 'hidden',
        zIndex: 30,
        position: 'relative',
        userSelect: 'none',
        fontFamily: 'var(--font-google)',
      }}
    >
      <div style={{ width: '250px', height: '100%', display: 'flex', flexDirection: 'column', padding: '12px 10px 10px' }}>
        
        {/* Top "New chat" Rounded Oval Button */}
        <button
          onClick={onNewChat}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            width: '100%',
            padding: '10px 16px',
            borderRadius: '24px',
            background: 'var(--sidebar-hover)',
            border: 'none',
            color: 'var(--sidebar-text)',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'background-color 0.15s ease',
            marginBottom: '6px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--sidebar-active)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)';
          }}
        >
          {/* Custom Edit/Pencil Pen Icon from Screenshot */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M12 20h9"/>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
          <span style={{ letterSpacing: '0.01em' }}>New chat</span>
        </button>

        {/* Recent Section Header */}
        <div style={{
          padding: '14px 14px 6px',
          fontSize: '12px',
          fontWeight: 500,
          color: 'var(--sidebar-faint)',
          letterSpacing: '0.01em',
        }}>
          Recent
        </div>

        {/* Scrollable Conversation List */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          paddingRight: '2px',
        }}>
          {filteredSessions.length === 0 ? (
            <div style={{
              padding: '16px 14px',
              color: 'var(--sidebar-faint)',
              fontSize: '12.5px',
            }}>
              No conversations found
            </div>
          ) : (
            filteredSessions.map((s) => {
              const isActive = s.id === currentSessionId;
              const isMenuOpen = activeMenuId === s.id;

              return (
                <div
                  key={s.id}
                  onClick={() => onSelectSession(s.id)}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 14px',
                    borderRadius: '20px',
                    backgroundColor: isActive ? 'var(--sidebar-active)' : 'transparent',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: isActive ? 500 : 400,
                    color: isActive ? 'var(--sidebar-text)' : 'var(--sidebar-text)',
                    transition: 'background-color 0.12s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)';
                    const trigger = e.currentTarget.querySelector('.chat-menu-trigger') as HTMLElement;
                    if (trigger) trigger.style.opacity = '1';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                    if (!isMenuOpen) {
                      const trigger = e.currentTarget.querySelector('.chat-menu-trigger') as HTMLElement;
                      if (trigger) trigger.style.opacity = isActive ? '1' : '0';
                    }
                  }}
                >
                  <span style={{
                    flex: 1,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    paddingRight: '6px',
                    letterSpacing: '0.01em',
                  }}>
                    {s.title || 'Untitled conversation'}
                  </span>

                  {/* Gemini-style 3 Vertical Dots menu */}
                  <button
                    className="chat-menu-trigger"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuId(isMenuOpen ? null : s.id);
                    }}
                    title="Options"
                    style={{
                      opacity: isActive || isMenuOpen ? 1 : 0,
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--sidebar-text)',
                      padding: '2px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '50%',
                      transition: 'opacity 0.12s ease',
                    }}
                  >
                    <MoreVertical size={15} strokeWidth={2} />
                  </button>

                  {/* Dropdown Menu */}
                  {isMenuOpen && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '34px',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '12px',
                        padding: '4px',
                        zIndex: 50,
                        boxShadow: '0 4px 18px rgba(0,0,0,0.3)',
                        minWidth: '120px',
                      }}
                    >
                      <button
                        onClick={() => {
                          onDeleteSession(s.id);
                          setActiveMenuId(null);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          width: '100%',
                          padding: '6px 10px',
                          borderRadius: '8px',
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--accent-rose)',
                          fontSize: '12px',
                          cursor: 'pointer',
                          fontFamily: 'var(--font-google)',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(244, 63, 94, 0.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <Trash2 size={13} />
                        <span>Delete chat</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Pill: Guest Profile + Clear Option */}
        <div style={{
          paddingTop: '10px',
          borderTop: '1px solid var(--sidebar-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: 'var(--accent-cyan-subtle)',
              border: '1px solid var(--accent-cyan-glow)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-cyan)',
              fontSize: '11px',
              fontWeight: 600,
            }}>
              G
            </div>
            <span style={{ fontSize: '13px', color: 'var(--sidebar-text)', fontWeight: 500 }}>
              Guest
            </span>
          </div>

          {sessions.length > 0 && (
            confirmClear ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  onClick={() => {
                    onClearAll();
                    setConfirmClear(false);
                  }}
                  style={{
                    background: 'var(--accent-rose)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '2px 6px',
                    fontSize: '10px',
                    cursor: 'pointer',
                  }}
                >
                  Clear
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  style={{
                    background: 'transparent',
                    color: 'var(--sidebar-muted)',
                    border: 'none',
                    fontSize: '10px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmClear(true)}
                title="Clear all conversations"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--sidebar-faint)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-rose)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--sidebar-faint)'}
              >
                <Trash2 size={13} />
              </button>
            )
          )}
        </div>
      </div>
    </aside>
  );
};
