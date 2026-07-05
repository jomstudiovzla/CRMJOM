'use client';

import React, { useMemo } from 'react';
import Image from 'next/image';
import { TIER_S_NICHOS } from '@/lib/nichos';
import './CompanyProfile.css';

const PRO_MODULES = [
  { id: 'mails', icon: '📬', title: 'Mails', desc: 'Smart Feed + IA Extractor', pro: true },
  { id: 'leads', icon: '👥', title: 'Leads', desc: 'Scraper Upwork + filtros', pro: true },
  { id: 'dashboard', icon: '📊', title: 'Dashboard', desc: 'KPIs y funnel en vivo', pro: true },
  { id: 'playbook', icon: '📚', title: 'Playbook', desc: '6 bloques + plantillas JOM', pro: true },
];

const COMPANY = {
  name: 'JOM Studio',
  tagline: 'Digital Alchemy',
  description:
    'Fusión de arquitectura técnica y dirección artística. Desarrollo creativo full-stack: WebGL, e-commerce, RPA, inmobiliaria y branding.',
  web: 'https://jomstudiovzla.github.io/Jomstudiopage/',
  portfolio: 'https://jomstudiovzla.github.io/Jomstudiopage/repository.html',
  email: 'jomstudiovzla@gmail.com',
  market: 'Venezuela · LatAm · Remoto · Global',
  director: 'Jesús Omar Martínez',
};

function leadPaquete(lead) {
  return lead.paquete_jom || lead.paquete || '';
}

export default function CompanyProfile({ user, leads, onNavigate }) {
  const tierStats = useMemo(() => {
    const counts = {};
    for (const key of Object.keys(TIER_S_NICHOS)) {
      counts[key] = leads.filter((l) => leadPaquete(l) === key).length;
    }
    return counts;
  }, [leads]);

  const pending = leads.filter((l) => l.estado_pipeline === 'nuevo').length;
  const interesados = leads.filter((l) => l.estado_pipeline === 'interesado' || l.categoria_ia === 'interesado').length;
  const scraped = leads.filter((l) => l.origen === 'Upwork Scraper').length;
  const tierSTotal = Object.values(tierStats).reduce((a, b) => a + b, 0);

  return (
    <div className="company-profile animate-fade-in">
      <header className="company-hero glass-panel">
        <div className="hero-left">
          <Image
            src="/logo_jom_square.jpg"
            alt="JOM Studio"
            width={80}
            height={80}
            className="company-avatar"
            priority
          />
          <div>
            <div className="hero-badges">
              <span className="badge-pro">PRO ADMIN</span>
              <span className="badge-live">Fase 2 · Autonomía IA</span>
            </div>
            <h1>{COMPANY.name}</h1>
            <p className="hero-tagline">{COMPANY.tagline}</p>
            <p className="hero-desc">{COMPANY.description}</p>
            <div className="hero-links">
              <a href={COMPANY.web} target="_blank" rel="noopener noreferrer">Web</a>
              <a href={COMPANY.portfolio} target="_blank" rel="noopener noreferrer">Portfolio 19 cases</a>
              <span>{COMPANY.market}</span>
            </div>
          </div>
        </div>

        <div className="hero-admin glass-panel-inner">
          {user?.picture ? (
            <Image
              src={user.picture}
              alt=""
              width={56}
              height={56}
              className="admin-photo"
              referrerPolicy="no-referrer"
            />
          ) : (
            <Image
              src="/logo_jom_square.jpg"
              alt="JOM"
              width={56}
              height={56}
              className="admin-photo"
            />
          )}
          <div>
            <p className="admin-label">Administrador</p>
            <h3>{user?.name || COMPANY.director}</h3>
            <p className="admin-email">{user?.email || COMPANY.email}</p>
            <span className="admin-role">👑 Acceso completo Pro</span>
          </div>
        </div>
      </header>

      <div className="company-stats">
        <div className="stat-card glass-panel">
          <span className="stat-num">{leads.length}</span>
          <span className="stat-label">Leads totales</span>
        </div>
        <div className="stat-card glass-panel">
          <span className="stat-num">{tierSTotal}</span>
          <span className="stat-label">Tier S (vivo)</span>
        </div>
        <div className="stat-card glass-panel">
          <span className="stat-num">{scraped}</span>
          <span className="stat-label">Upwork RSS</span>
        </div>
        <div className="stat-card glass-panel accent">
          <span className="stat-num">{interesados}</span>
          <span className="stat-label">IA: Interesados</span>
        </div>
        <div className="stat-card glass-panel">
          <span className="stat-num">{pending}</span>
          <span className="stat-label">Pendientes</span>
        </div>
      </div>

      <section className="pro-modules glass-panel">
        <h2>Módulos Pro — Fase 2</h2>
        <div className="modules-grid">
          {PRO_MODULES.map((mod) => (
            <button
              key={mod.id}
              className="module-card"
              onClick={() => onNavigate(mod.id)}
            >
              <span className="module-icon">{mod.icon}</span>
              <div>
                <h4>{mod.title}</h4>
                <p>{mod.desc}</p>
              </div>
              {mod.pro && <span className="module-pro">PRO</span>}
            </button>
          ))}
        </div>
      </section>

      <section className="company-nichos glass-panel">
        <h2>Nichos Tier S — métricas en vivo</h2>
        <div className="nichos-list">
          {Object.values(TIER_S_NICHOS).map((n) => (
            <div key={n.id} className="nicho-row">
              <strong>{n.label}</strong>
              <span>{n.case}</span>
              <span className="paquete">{n.id}</span>
              <span className="nicho-count">{tierStats[n.id] || 0} leads</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}