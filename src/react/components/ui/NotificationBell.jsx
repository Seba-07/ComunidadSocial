import { useState, useEffect, useRef, useCallback } from 'react';
import { apiService } from '@services/ApiService.js';
import { useAuthStore } from '../../stores/authStore';

const POLL_INTERVAL = 30000; // 30 seconds

function timeAgo(date) {
  const now = new Date();
  const d = new Date(date);
  const seconds = Math.floor((now - d) / 1000);
  if (seconds < 60) return 'Ahora';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Hace ${days}d`;
  return d.toLocaleDateString('es-CL');
}

const TYPE_ICONS = {
  status_change: '🔄',
  ministro_assigned: '👤',
  organization_approved: '✅',
  organization_rejected: '❌',
  correction_required: '📝',
  new_assignment: '📋',
  schedule_change: '📅',
  election_announced: '🗳️',
  assembly_reminder: '📢',
  deletion_requested: '🗑️',
  organization_deleted: '🗑️',
  general: '📌',
};

export default function NotificationBell() {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef(null);
  const intervalRef = useRef(null);

  const isMinistro = user?.role === 'MINISTRO_FE';
  const ministroId = user?._id;

  const fetchCount = useCallback(async () => {
    try {
      const data = isMinistro
        ? await apiService.getMinistroUnreadCount(ministroId)
        : await apiService.getUnreadCount();
      setUnreadCount(data.count || 0);
    } catch { /* silent */ }
  }, [isMinistro, ministroId]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const data = isMinistro
        ? await apiService.getMinistroNotifications(ministroId)
        : await apiService.getNotifications();
      const list = Array.isArray(data) ? data : data.notifications || [];
      setNotifications(list);
      setUnreadCount(list.filter(n => !n.read).length);
    } catch { /* silent */ }
    setLoading(false);
  }, [isMinistro, ministroId]);

  // Poll for unread count
  useEffect(() => {
    fetchCount();
    intervalRef.current = setInterval(fetchCount, POLL_INTERVAL);
    return () => clearInterval(intervalRef.current);
  }, [fetchCount]);

  // Fetch all when panel opens
  useEffect(() => {
    if (open) fetchAll();
  }, [open, fetchAll]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  async function markRead(id) {
    try {
      isMinistro
        ? await apiService.markMinistroNotificationRead(id)
        : await apiService.markNotificationRead(id);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch { /* silent */ }
  }

  async function markAllRead() {
    try {
      isMinistro
        ? await apiService.markAllMinistroNotificationsRead(ministroId)
        : await apiService.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch { /* silent */ }
  }

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Notificaciones"
        style={{
          position: 'relative', background: 'none', border: 'none',
          cursor: 'pointer', padding: 6, borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#e2e8f0' }}>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 0, right: 0,
            background: '#ef4444', color: 'white', fontSize: 10, fontWeight: 700,
            padding: '1px 5px', borderRadius: 10, minWidth: 16, textAlign: 'center',
            lineHeight: '16px', animation: 'pulse 2s infinite',
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 8,
          width: 'min(380px, calc(100vw - 32px))', maxHeight: 480, background: 'white', borderRadius: 12,
          boxShadow: '0 12px 40px rgba(0,0,0,0.18)', border: '1px solid #e5e7eb',
          display: 'flex', flexDirection: 'column', zIndex: 10000,
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 16px', borderBottom: '1px solid #e5e7eb',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>Notificaciones</span>
              {unreadCount > 0 && (
                <span style={{
                  background: '#ef4444', color: 'white', fontSize: 11, fontWeight: 700,
                  padding: '2px 8px', borderRadius: 10,
                }}>
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button onClick={markAllRead} style={{
                background: 'none', border: 'none', color: '#2563eb', fontSize: 12,
                fontWeight: 600, cursor: 'pointer',
              }}>
                Marcar todas como leídas
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading && notifications.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                Cargando...
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                No hay notificaciones
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n._id}
                  onClick={() => !n.read && markRead(n._id)}
                  style={{
                    padding: '12px 16px', borderBottom: '1px solid #f3f4f6',
                    cursor: n.read ? 'default' : 'pointer',
                    background: n.read ? 'white' : '#eff6ff',
                    borderLeft: n.read ? 'none' : '3px solid #2563eb',
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', gap: 10 }}>
                    <span style={{ fontSize: 18, flexShrink: 0, marginTop: 2 }}>
                      {TYPE_ICONS[n.type] || '📌'}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, fontWeight: n.read ? 500 : 700, color: '#111827',
                        marginBottom: 2,
                      }}>
                        {n.title}
                      </div>
                      <div style={{
                        fontSize: 12, color: '#6b7280', lineHeight: 1.4,
                        overflow: 'hidden', textOverflow: 'ellipsis',
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      }}>
                        {n.message}
                      </div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                        {timeAgo(n.createdAt)}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
