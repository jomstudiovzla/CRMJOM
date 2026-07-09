'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import './PostulacionesPanel.css';

// ── Constantes ────────────────────────────────────────────────────────────────
const PLATAFORMA = {
  computrabajo: { icon: '💼', label: 'Computrabajo', color: '#f59e0b' },
  linkedin:     { icon: '🔗', label: 'LinkedIn',     color: '#0ea5e9' },
  upwork:       { icon: '🟢', label: 'Upwork',       color: '#22c55e' },
  fiverr:       { icon: '🟣', label: 'Fiverr',       color: '#a855f7' },
  workana:      { icon: '🔵', label: 'Workana',      color: '#3b82f6' },
  freelancer:   { icon: '🟠', label: 'Freelancer',   color: '#f97316' },
};

const ESTADOS = {
  enviada:    { label: 'Enviada',    color: '#22c55e', icon: '✅' },
  pendiente:  { label: 'Pendiente', color: '#f59e0b', icon: '⏳' },
  vista:      { label: 'Vista',     color: '#3b82f6', icon: '👁️' },
  entrevista: { label: 'Entrevista',color: '#a855f7', icon: '🎙️' },
  rechazada:  { label: 'Rechazada', color: '#ef4444', icon: '❌' },
  error:      { label: 'Error',     color: '#6b7280', icon: '⚠️' },
};

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-VE', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

// ── Componente Principal ──────────────────────────────────────────────────────
export default function PostulacionesPanel() {
  const [postulaciones, setPostulaciones] = useState([]);
  const [stats, setStats]       = useState({ total: 0, hoy: 0, byEstado: {}, byPlataforma: {} });
  const [loading, setLoading]   = useState(true);
  const [autoApplying, setAutoApplying] = useState(false);
  const [progress, setProgress] = useState(null);   // { current, total, label }
  const [feedback, setFeedback] = useState(null);   // { msg, type }
  const [filterPlat, setFilterPlat]   = useState('todas');
  const [filterEst, setFilterEst]     = useState('todos');
  const [search, setSearch]           = useState('');
  const [sessionOk, setSessionOk]     = useState(null);
  const sseRef      = useRef(null);
  const fbTimer     = useRef(null);

  // ── Feedback ──────────────────────────────────────────────────────────────
  const toast = useCallback((msg, type = 'success', duration = 4000) => {
    setFeedback({ msg, type });
    clearTimeout(fbTimer.current);
    fbTimer.current = setTimeout(() => setFeedback(null), duration);
  }, []);

  // ── Cargar datos ──────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    try {
      const [pRes, sRes, sessRes] = await Promise.all([
        fetch('/api/postulaciones'),
        fetch('/api/postulaciones?stats=1'),
        fetch('/api/session'),
      ]);
      const [p, s, sess] = await Promise.all([pRes.json(), sRes.json(), sessRes.json()]);
      if (p.success)    setPostulaciones(p.data || []);
      if (s.success)    setStats(s.data);
      setSessionOk(sess?.sessions?.computrabajo ?? null);
    } catch (e) {
      console.error('[Postulaciones] Error cargando:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadAll(); }, [loadAll]);

  // ── SSE en tiempo real ────────────────────────────────────────────────────
  useEffect(() => {
    const connect = () => {
      const es = new EventSource('/api/postulaciones/stream');
      sseRef.current = es;

      es.addEventListener('init', (e) => {
        try { setPostulaciones(JSON.parse(e.data)); } catch {}
      });
      es.addEventListener('postulacion_nueva', (e) => {
        try {
          const n = JSON.parse(e.data);
          setPostulaciones(prev => [n, ...prev]);
          setStats(prev => ({ ...prev, total: prev.total + 1, hoy: prev.hoy + 1 }));
          toast(`✅ ${n.puesto} @ ${n.empresa}`, 'success');
        } catch {}
      });
      es.addEventListener('postulacion_actualizada', (e) => {
        try {
          const u = JSON.parse(e.data);
          setPostulaciones(prev => prev.map(p => p.id === u.id ? u : p));
        } catch {}
      });
      es.addEventListener('postulacion_eliminada', (e) => {
        try {
          const { id } = JSON.parse(e.data);
          setPostulaciones(prev => prev.filter(p => p.id !== id));
        } catch {}
      });
      es.addEventListener('postulaciones_updated', () => loadAll());

      es.onerror = () => {
        es.close();
        setTimeout(connect, 4000);
      };
    };
    connect();
    return () => sseRef.current?.close();
  }, [loadAll, toast]);

  // ── Auto-Postular ─────────────────────────────────────────────────────────
  const handleAutoApply = async () => {
    if (!sessionOk) {
      toast('⚠️ Inicia sesión con Google primero. Ve a la pestaña Mails → Abrir con Google', 'warning', 6000);
      return;
    }
    setAutoApplying(true);
    setProgress({ current: 0, total: 0, label: 'Iniciando...' });
    toast('🤖 Buscando ofertas y postulando...', 'info', 30000);
    try {
      const res = await fetch('/api/postulaciones/autoapply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categorias: ['desarrollador-web', 'diseno-grafico', 'marketing-digital', 'director-creativo'],
          maxPerCategoria: 5,
        }),
        signal: AbortSignal.timeout(300000),
      });
      const data = await res.json();
      if (data.success) {
        toast(`✅ ${data.applied} postulaciones enviadas${data.errors > 0 ? ` · ${data.errors} errores` : ''}`, 'success');
        loadAll();
      } else {
        toast('❌ ' + (data.error || 'Error en auto-postulación'), 'error');
      }
    } catch (e) {
      toast('❌ Error: ' + e.message, 'error');
    } finally {
      setAutoApplying(false);
      setProgress(null);
    }
  };

  // ── Cambiar estado ────────────────────────────────────────────────────────
  const handleEstado = async (id, estado) => {
    setPostulaciones(prev => prev.map(p => p.id === id ? { ...p, estado } : p));
    try {
      await fetch('/api/postulaciones', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, estado }),
      });
    } catch { loadAll(); }
  };

  // ── Eliminar ──────────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    setPostulaciones(prev => prev.filter(p => p.id !== id));
    try {
      await fetch('/api/postulaciones', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
    } catch { loadAll(); }
  };

  // ── Filtros ───────────────────────────────────────────────────────────────
  const filtered = postulaciones.filter(p => {
    if (filterPlat !== 'todas' && p.plataforma !== filterPlat) return false;
    if (filterEst  !== 'todos' && p.estado     !== filterEst)  return false;
    if (search) {
      const q = search.toLowerCase();
      if (!p.puesto?.toLowerCase().includes(q) && !p.empresa?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const plataformasUsadas = [...new Set(postulaciones.map(p => p.plataforma).filter(Boolean))];

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="pp-root">

      {/* ── Feedback toast ── */}
      {feedback && (
        <div className={`pp-toast pp-toast--${feedback.type}`}>
          {feedback.msg}
        </div>
      )}

      {/* ── Header ── */}
      <div className="pp-header">
        <div className="pp-header-left">
          <h2 className="pp-title">📋 Postulaciones</h2>
          <span className="pp-live-dot">● LIVE</span>
          {sessionOk === false && (
            <span className="pp-session-warn">⚠️ Sin sesión Computrabajo</span>
          )}
          {sessionOk === true && (
            <span className="pp-session-ok">✅ Sesión activa</span>
          )}
        </div>
        <button
          className={`pp-btn-apply ${autoApplying ? 'pp-btn-apply--busy' : ''}`}
          onClick={handleAutoApply}
          disabled={autoApplying}
        >
          {autoApplying ? (
            <><span className="pp-spinner" />Postulando...</>
          ) : (
            '🤖 Auto-Postular Ahora'
          )}
        </button>
      </div>

      {/* ── Progress bar (durante auto-apply) ── */}
      {autoApplying && (
        <div className="pp-progress-bar">
          <div className="pp-progress-fill" />
        </div>
      )}

      {/* ── Stats ── */}
      <div className="pp-stats">
        {[
          { n: stats.total,                      label: 'Total',        accent: 'default' },
          { n: stats.hoy,                         label: 'Hoy',          accent: 'green'   },
          { n: stats.byEstado?.enviada  || 0,     label: 'Enviadas',     accent: 'blue'    },
          { n: stats.byEstado?.entrevista || 0,   label: 'Entrevistas',  accent: 'purple'  },
          { n: stats.byPlataforma?.computrabajo || 0, label: '💼 CT',    accent: 'orange'  },
          { n: stats.byPlataforma?.linkedin || 0, label: '🔗 LinkedIn',  accent: 'teal'    },
        ].map(({ n, label, accent }) => (
          <div key={label} className={`pp-stat pp-stat--${accent}`}>
            <span className="pp-stat-num">{n}</span>
            <span className="pp-stat-label">{label}</span>
          </div>
        ))}
      </div>

      {/* ── Filtros y búsqueda ── */}
      <div className="pp-filters">
        <input
          className="pp-search"
          type="text"
          placeholder="🔍 Buscar puesto o empresa..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="pp-select"
          value={filterPlat}
          onChange={e => setFilterPlat(e.target.value)}
        >
          <option value="todas">Todas las plataformas</option>
          {plataformasUsadas.map(pl => (
            <option key={pl} value={pl}>
              {PLATAFORMA[pl]?.icon || '🌐'} {PLATAFORMA[pl]?.label || pl}
            </option>
          ))}
        </select>
        <select
          className="pp-select"
          value={filterEst}
          onChange={e => setFilterEst(e.target.value)}
        >
          <option value="todos">Todos los estados</option>
          {Object.entries(ESTADOS).map(([k, v]) => (
            <option key={k} value={k}>{v.icon} {v.label}</option>
          ))}
        </select>
        <span className="pp-count">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* ── Lista ── */}
      {loading ? (
        <div className="pp-empty">
          <span className="pp-spinner pp-spinner--lg" />
          <p>Cargando postulaciones...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="pp-empty">
          <div className="pp-empty-icon">🎯</div>
          <p>No hay postulaciones {search || filterPlat !== 'todas' || filterEst !== 'todos' ? 'con estos filtros' : 'todavía'}.</p>
          {!search && filterPlat === 'todas' && filterEst === 'todos' && (
            <p className="pp-empty-hint">Usa <strong>Auto-Postular Ahora</strong> para comenzar.</p>
          )}
        </div>
      ) : (
        <div className="pp-list">
          {filtered.map(p => {
            const plat = PLATAFORMA[p.plataforma] || { icon: '🌐', label: p.plataforma, color: '#6b7280' };
            const est  = ESTADOS[p.estado] || { label: p.estado, color: '#6b7280', icon: '•' };
            return (
              <div key={p.id} className={`pp-item pp-item--${p.estado}`}>

                {/* Icono plataforma */}
                <div className="pp-item-icon" style={{ background: plat.color + '22', color: plat.color }}>
                  {plat.icon}
                </div>

                {/* Contenido */}
                <div className="pp-item-body">
                  <div className="pp-item-puesto">{p.puesto || 'Sin título'}</div>
                  <div className="pp-item-empresa">{p.empresa || 'Sin empresa'}</div>
                  <div className="pp-item-meta">
                    <span className="pp-tag" style={{ color: plat.color }}>{plat.label}</span>
                    {p.notas && <span className="pp-notes" title={p.notas}>📝 {p.notas}</span>}
                    <span className="pp-date">{formatDate(p.fecha_postulacion)}</span>
                  </div>
                </div>

                {/* Acciones */}
                <div className="pp-item-actions">
                  <span
                    className="pp-estado-badge"
                    style={{ background: est.color + '22', color: est.color, borderColor: est.color + '55' }}
                  >
                    {est.icon} {est.label}
                  </span>
                  <select
                    className="pp-estado-select"
                    value={p.estado}
                    onChange={e => handleEstado(p.id, e.target.value)}
                    title="Cambiar estado"
                  >
                    {Object.entries(ESTADOS).map(([k, v]) => (
                      <option key={k} value={k}>{v.icon} {v.label}</option>
                    ))}
                  </select>
                  {p.link && (
                    <a
                      href={p.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pp-btn-icon"
                      title="Ver oferta"
                    >🔗</a>
                  )}
                  <button
                    className="pp-btn-icon pp-btn-icon--del"
                    onClick={() => handleDelete(p.id)}
                    title="Eliminar"
                  >✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
