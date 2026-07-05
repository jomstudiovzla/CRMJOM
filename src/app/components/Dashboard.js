'use client';

import React from 'react';
import './Dashboard.css';

export default function Dashboard({ leads }) {
  const total = leads.length;
  const alta = leads.filter(l => l.calidad_lead === 'alta').length;
  const contactados = leads.filter(l => l.estado_pipeline === 'contactado').length;
  const respondieron = leads.filter(l => l.estado_pipeline === 'respondio').length;
  const ganados = leads.filter(l => l.estado_pipeline === 'ganado').length;
  const pendientes = Math.max(0, total - contactados - respondieron - ganados);
  const pct = (n) => (total > 0 ? (n / total) * 100 : 0);

  const kpis = [
    { label: 'Total Leads', value: total, status: total > 20 ? 'green' : 'yellow' },
    { label: 'Pendientes', value: pendientes, status: pendientes > 0 ? 'yellow' : 'green' },
    { label: 'Prioridad Alta', value: alta, status: 'blue' },
    { label: 'Contactados', value: contactados, status: contactados > 0 ? 'green' : 'red' },
    { label: 'Respuestas', value: respondieron, status: respondieron >= 3 ? 'green' : (respondieron > 0 ? 'yellow' : 'red') },
    { label: 'Ganados', value: ganados, status: ganados > 0 ? 'green' : 'yellow' },
  ];

  return (
    <div className="dashboard animate-fade-in">
      <div className="header-box glass-panel">
        <h2>Dashboard Semanal</h2>
        <p className="subtitle">Campaña Activa: CAMP-01-inmobiliarias-caracas</p>
      </div>
      <div className="kpi-grid">
        {kpis.map((kpi, index) => (
          <div key={index} className={`kpi-card glass-panel kpi-status-${kpi.status}`}>
            <h3>{kpi.label}</h3>
            <div className="kpi-value">{kpi.value}</div>
          </div>
        ))}
      </div>

      <div className="funnel glass-panel">
        <h3>Funnel de Conversión</h3>
        <div className="funnel-bar">
          <div className="funnel-step" style={{ width: '100%' }}>
            <span>Leads ({total})</span>
          </div>
          <div className="funnel-step contactado" style={{ width: `${pct(contactados)}%` }}>
            <span>Contactado ({contactados})</span>
          </div>
          <div className="funnel-step respondio" style={{ width: `${pct(respondieron)}%` }}>
            <span>Respondió ({respondieron})</span>
          </div>
        </div>
      </div>
    </div>
  );
}
