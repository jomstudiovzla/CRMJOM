'use client';

import React, { useState, useEffect } from 'react';
import { TIER_S_NICHOS, AI_CATEGORIES, AI_CATEGORY_KEYS } from '@/lib/nichos';
import GmailSetupBanner from './GmailSetupBanner';
import AiStatusBanner from './AiStatusBanner';

import AddLeadModal from './AddLeadModal';
import './LeadManager.css';

const PIPELINE_FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'alta', label: 'Prioridad Alta' },
  { id: 'pendientes', label: 'Pendientes' },
  { id: 'contactados', label: 'Contactados' },
];

const NICHE_FILTERS = [
  { id: 'all', label: 'Todos los nichos' },
  ...Object.values(TIER_S_NICHOS).map((n) => ({ id: n.id, label: n.id })),
];

const LANG_FILTERS = [
  { id: 'all', label: 'Todos idiomas' },
  { id: 'es', label: '🇪🇸 ES' },
  { id: 'en', label: '🇺🇸 EN' },
];

const AI_FILTERS = [
  { id: 'all', label: 'Todas IA' },
  ...AI_CATEGORY_KEYS.map((k) => ({ id: k, label: AI_CATEGORIES[k].label })),
];

function getAiPill(lead) {
  const cat = lead.categoria_ia || (AI_CATEGORY_KEYS.includes(lead.estado_pipeline) ? lead.estado_pipeline : null);
  if (!cat || !AI_CATEGORIES[cat]) return null;
  return (
    <span className={`ai-pill ${AI_CATEGORIES[cat].className}`}>
      {AI_CATEGORIES[cat].label}
    </span>
  );
}

function getPaquete(lead) {
  return lead.paquete_jom || lead.paquete || '';
}

export default function LeadManager({ leads, onUpdate }) {
  const [pipelineFilter, setPipelineFilter] = useState('all');
  const [nicheFilter, setNicheFilter] = useState('all');
  const [langFilter, setLangFilter] = useState('all');
  const [aiFilter, setAiFilter] = useState('all');
  const [loadingAction, setLoadingAction] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [emailStatus, setEmailStatus] = useState(null);
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
  const [localLeads, setLocalLeads] = useState(leads);

  useEffect(() => {
    setLocalLeads(leads);
  }, [leads]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/email/status');
        const data = await res.json();
        if (!cancelled && data.success) setEmailStatus(data);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const filteredLeads = localLeads.filter((lead) => {
    const paquete = getPaquete(lead);
    const aiCat = lead.categoria_ia || lead.estado_pipeline;

    if (pipelineFilter === 'alta' && lead.calidad_lead !== 'alta' && lead.prioridad !== 'alta') return false;
    if (pipelineFilter === 'pendientes' && !['nuevo', 'mas_informacion'].includes(lead.estado_pipeline)) return false;
    if (pipelineFilter === 'contactados' && !['contactado', 'interesado'].includes(lead.estado_pipeline)) return false;

    if (nicheFilter !== 'all' && paquete !== nicheFilter) return false;
    if (langFilter !== 'all' && lead.idioma && lead.idioma !== langFilter) return false;
    if (aiFilter !== 'all' && aiCat !== aiFilter) return false;

    return true;
  });

  const runScraper = async () => {
    setLoadingAction('scraper');
    setFeedback(null);
    try {
      const res = await fetch('/api/scraper');
      const data = await res.json();
      if (data.success) {
        setFeedback({ type: 'success', text: data.message || `${data.added} leads agregados` });
        onUpdate();
      } else {
        setFeedback({ type: 'error', text: data.error });
      }
    } catch (e) {
      setFeedback({ type: 'error', text: e.message });
    }
    setLoadingAction(null);
  };

  const auditLeadWeb = async (lead) => {
    const url = lead.web || lead.link;
    if (!url) return;
    setLoadingAction(lead.nombre_negocio);
    setFeedback(null);
    try {
      const res = await fetch('/api/scraper/deep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, nombre_negocio: lead.nombre_negocio }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({ type: 'success', text: `🕵️ Gap actualizado: ${data.data.gap_detectado.slice(0, 80)}…` });
        onUpdate();
      } else {
        setFeedback({ type: 'error', text: data.error });
      }
    } catch (e) {
      setFeedback({ type: 'error', text: e.message });
    }
    setLoadingAction(null);
  };

  const updateState = async (nombre_negocio, nuevo_estado) => {
    // Optimistic UI update
    setLocalLeads(prev => prev.map(l => l.nombre_negocio === nombre_negocio ? { ...l, estado_pipeline: nuevo_estado } : l));
    
    try {
      const res = await fetch('/api/leads/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre_negocio, nuevo_estado }),
      });
      if (res.ok) {
        // Trigger background refresh without blocking
        onUpdate();
      } else {
        // Revert on error
        setLocalLeads(leads);
      }
    } catch (e) {
      console.error(e);
      setLocalLeads(leads);
    }
  };

  return (
    <div className="lead-manager animate-fade-in glass-panel">
      <div className="lm-header">
        <div className="lm-title-row">
          <h2>Gestor de Leads</h2>
          <div className="ai-actions">
            <button
              className="btn-primary"
              onClick={runScraper}
              disabled={loadingAction === 'scraper'}
            >
              {loadingAction === 'scraper' ? '⏳ Buscando...' : '🌐 Buscar en Upwork'}
            </button>
            <button
              className="btn-secondary"
              onClick={() => setIsAddLeadOpen(true)}
            >
              ➕ Añadir Lead
            </button>
          </div>
        </div>

        <GmailSetupBanner status={emailStatus} />
        <AiStatusBanner status={emailStatus} />

        {feedback && (
          <div className={`lm-feedback lm-feedback-${feedback.type}`}>{feedback.text}</div>
        )}

        <div className="filter-group">
          <span className="filter-label">Pipeline</span>
          <div className="filters">
            {PIPELINE_FILTERS.map((f) => (
              <button
                key={f.id}
                className={pipelineFilter === f.id ? 'btn-primary' : 'btn-secondary'}
                onClick={() => setPipelineFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <span className="filter-label">Nicho Tier S</span>
          <div className="filters">
            {NICHE_FILTERS.map((f) => (
              <button
                key={f.id}
                className={nicheFilter === f.id ? 'btn-primary' : 'btn-secondary'}
                onClick={() => setNicheFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <span className="filter-label">Idioma / IA</span>
          <div className="filters">
            {LANG_FILTERS.map((f) => (
              <button
                key={f.id}
                className={langFilter === f.id ? 'btn-primary' : 'btn-secondary'}
                onClick={() => setLangFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
            {AI_FILTERS.map((f) => (
              <button
                key={f.id}
                className={aiFilter === f.id ? 'btn-primary' : 'btn-secondary'}
                onClick={() => setAiFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Negocio / Oferta</th>
              <th>Contacto</th>
              <th>Nicho</th>
              <th>Estado</th>
              <th>IA</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {filteredLeads.map((lead) => (
              <tr key={lead.link || lead.nombre_negocio}>
                <td>
                  <strong>{lead.nombre_negocio}</strong>
                  {lead.gap_detectado && <div className="gap-info">{lead.gap_detectado}</div>}
                  {lead.link && (
                    <a href={lead.link} target="_blank" rel="noopener noreferrer" className="lead-link">
                      Ver oferta ↗
                    </a>
                  )}
                </td>
                <td>
                  {lead.email && <div>✉️ {lead.email}</div>}
                  {lead.telefono && <div>📱 {lead.telefono}</div>}
                  {lead.web && (
                    <a href={lead.web} target="_blank" rel="noopener noreferrer" className="lead-link">
                      🌐 Web ↗
                    </a>
                  )}
                  {lead.idioma && <div className="lang-tag">{lead.idioma.toUpperCase()}</div>}
                </td>
                <td>
                  {getPaquete(lead) && (
                    <span className="nicho-pill">{getPaquete(lead)}</span>
                  )}
                </td>
                <td>
                  <span className={`status-pill ${lead.estado_pipeline}`}>
                    {lead.estado_pipeline}
                  </span>
                </td>
                <td>{getAiPill(lead)}</td>
                <td className="action-cell">
                  {(lead.web || lead.link) && (
                    <button
                      className="btn-secondary btn-sm"
                      onClick={() => auditLeadWeb(lead)}
                      disabled={loadingAction === lead.nombre_negocio}
                      title="Auditar web con IA"
                    >
                      {loadingAction === lead.nombre_negocio ? '🕵️…' : '🕵️ Auditar'}
                    </button>
                  )}
                  {lead.email && (
                    <a
                      className="btn-secondary btn-sm mail-link"
                      href={`/?tab=mails&lead=${encodeURIComponent(lead.nombre_negocio)}`}
                    >
                      📧 Email
                    </a>
                  )}
                  {lead.link && !lead.email && (
                    <a
                      className="btn-secondary btn-sm"
                      href={lead.link}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      🔗 Upwork
                    </a>
                  )}
                  {!AI_CATEGORY_KEYS.includes(lead.estado_pipeline) &&
                    lead.estado_pipeline !== 'contactado' &&
                    lead.estado_pipeline !== 'respondio' && (
                    <button
                      className="btn-primary btn-sm"
                      onClick={() => updateState(lead.nombre_negocio, 'contactado')}
                      disabled={loadingAction === lead.nombre_negocio}
                    >
                      {loadingAction === lead.nombre_negocio ? '⏳' : '✅ Contactado'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filteredLeads.length === 0 && (
              <tr>
                <td colSpan="6" className="empty-state">No hay leads con este filtro</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AddLeadModal
        isOpen={isAddLeadOpen}
        onClose={() => setIsAddLeadOpen(false)}
        onSaved={onUpdate}
      />
    </div>
  );
}