'use client';

import React, { useMemo, useEffect, useState } from 'react';
import Image from 'next/image';
import { TIER_S_NICHOS } from '@/lib/nichos';
import './CompanyProfile.css';

const PRO_MODULES = [
  { id: 'mails', icon: '📬', title: 'Mails', desc: 'Gmail IMAP + Ghostwriter IA', pro: true },
  { id: 'leads', icon: '👥', title: 'Leads', desc: 'Scraper Upwork + Deep Audit', pro: true },
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
  whatsapp: '+58 416-5159067',
  market: 'Venezuela · LatAm · Remoto · Global',
  director: 'Jesús Omar Martínez',
};

function leadPaquete(lead) {
  return lead.paquete_jom || lead.paquete || '';
}

const MODULE_LABELS = {
  login: 'Login Google',
  gmail: 'Gmail SMTP',
  gmailImap: 'Gmail IMAP',
  gemini: 'Gemini IA',
  ghostwriter: 'Ghostwriter',
  deepScraper: 'Scraper Profundo',
  upworkScraper: 'Upwork RSS',
  websockets: 'WebSockets',
  imapIdle: 'IMAP IDLE',
  playbook: 'Playbook MD',
};

export default function CompanyProfile({ user, leads, onNavigate }) {
  const [systemStatus, setSystemStatus] = useState(null);
  const [credentials, setCredentials] = useState({
    computrabajo: { user: '', pass: '' },
    linkedin: { user: '', pass: '' },
    fiverr: { user: '', pass: '' },
  });
  const [savingCreds, setSavingCreds] = useState(false);
  const [credsMessage, setCredsMessage] = useState(null);

  useEffect(() => {
    fetch('/api/system/status')
      .then((r) => r.json())
      .then((data) => { if (data.success) setSystemStatus(data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/settings/credentials')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setCredentials((prev) => ({
            ...prev,
            ...data.data,
          }));
        }
      })
      .catch(() => {});
  }, []);

  const handleSaveCredentials = async (e) => {
    e.preventDefault();
    setSavingCreds(true);
    setCredsMessage(null);
    try {
      const res = await fetch('/api/settings/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      const data = await res.json();
      if (data.success) {
        setCredsMessage({ type: 'success', text: '✅ Credenciales guardadas y aplicadas al Auto-Postulador.' });
      } else {
        setCredsMessage({ type: 'error', text: data.error });
      }
    } catch (err) {
      setCredsMessage({ type: 'error', text: err.message });
    } finally {
      setSavingCreds(false);
    }
  };

  const handleCredChange = (platform, field, value) => {
    setCredentials((prev) => ({
      ...prev,
      [platform]: {
        ...prev[platform],
        [field]: value,
      },
    }));
  };

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
              <span className="badge-live">Local · Motor Completo</span>
            </div>
            <h1>{COMPANY.name}</h1>
            <p className="hero-tagline">{COMPANY.tagline}</p>
            <p className="hero-desc">{COMPANY.description}</p>
            <div className="hero-links">
              <a href={COMPANY.web} target="_blank" rel="noopener noreferrer">Web</a>
              <a href={COMPANY.portfolio} target="_blank" rel="noopener noreferrer">Portfolio 19 cases</a>
              <a href="https://wa.me/584165159067" target="_blank" rel="noopener noreferrer" style={{color: '#4ade80'}}>💬 WhatsApp Business</a>
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

      {systemStatus?.modules && (
        <section className="company-nichos glass-panel">
          <h2>🖥️ Estado del motor local</h2>
          <div className="nichos-list">
            {Object.entries(systemStatus.modules)
              .filter(([key]) => MODULE_LABELS[key])
              .map(([key, val]) => {
                const active = typeof val === 'number' ? val > 0 : Boolean(val);
                const detail = typeof val === 'number' && val > 0 ? ` (${val})` : '';
                return (
                  <div key={key} className="nicho-row">
                    <strong>{MODULE_LABELS[key]}</strong>
                    <span className={active ? 'nicho-count' : 'paquete'}>
                      {active ? `🟢 Activo${detail}` : '🔴 Configurar'}
                    </span>
                  </div>
                );
              })}
          </div>
          {systemStatus.hints?.length > 0 && (
            <p style={{ marginTop: 12, fontSize: 13, opacity: 0.8 }}>
              {systemStatus.hints.join(' · ')}
            </p>
          )}
        </section>
      )}

      <section className="pro-modules glass-panel">
        <h2>Módulos Pro — Localhost</h2>
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

      <section className="company-nichos glass-panel">
        <h2>🔑 Credenciales de Automatización</h2>
        <p style={{ opacity: 0.8, fontSize: 13, marginBottom: 16 }}>
          Configura tus accesos para que las postulaciones automáticas (Computrabajo, LinkedIn, Fiverr) se realicen con tus cuentas sin salir del CRM.
        </p>

        <form onSubmit={handleSaveCredentials}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '16px' }}>
            <div className="glass-panel-inner" style={{ padding: '12px', borderRadius: '8px' }}>
              <h4 style={{ color: '#60a5fa' }}>💼 Computrabajo</h4>
              <div style={{ marginTop: '8px' }}>
                <label style={{ fontSize: '11px', display: 'block', opacity: 0.8 }}>Email:</label>
                <input
                  type="email"
                  value={credentials.computrabajo?.user || ''}
                  onChange={(e) => handleCredChange('computrabajo', 'user', e.target.value)}
                  style={{ width: '100%', padding: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', marginTop: '4px' }}
                />
              </div>
              <div style={{ marginTop: '8px' }}>
                <label style={{ fontSize: '11px', display: 'block', opacity: 0.8 }}>Contraseña:</label>
                <input
                  type="password"
                  value={credentials.computrabajo?.pass || ''}
                  onChange={(e) => handleCredChange('computrabajo', 'pass', e.target.value)}
                  style={{ width: '100%', padding: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', marginTop: '4px' }}
                />
              </div>
            </div>

            <div className="glass-panel-inner" style={{ padding: '12px', borderRadius: '8px' }}>
              <h4 style={{ color: '#60a5fa' }}>🔗 LinkedIn</h4>
              <div style={{ marginTop: '8px' }}>
                <label style={{ fontSize: '11px', display: 'block', opacity: 0.8 }}>Email:</label>
                <input
                  type="email"
                  value={credentials.linkedin?.user || ''}
                  onChange={(e) => handleCredChange('linkedin', 'user', e.target.value)}
                  style={{ width: '100%', padding: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', marginTop: '4px' }}
                />
              </div>
              <div style={{ marginTop: '8px' }}>
                <label style={{ fontSize: '11px', display: 'block', opacity: 0.8 }}>Contraseña:</label>
                <input
                  type="password"
                  value={credentials.linkedin?.pass || ''}
                  onChange={(e) => handleCredChange('linkedin', 'pass', e.target.value)}
                  style={{ width: '100%', padding: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', marginTop: '4px' }}
                />
              </div>
            </div>

            <div className="glass-panel-inner" style={{ padding: '12px', borderRadius: '8px' }}>
              <h4 style={{ color: '#60a5fa' }}>🎨 Fiverr</h4>
              <div style={{ marginTop: '8px' }}>
                <label style={{ fontSize: '11px', display: 'block', opacity: 0.8 }}>Usuario/Email:</label>
                <input
                  type="text"
                  value={credentials.fiverr?.user || ''}
                  onChange={(e) => handleCredChange('fiverr', 'user', e.target.value)}
                  style={{ width: '100%', padding: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', marginTop: '4px' }}
                />
              </div>
              <div style={{ marginTop: '8px' }}>
                <label style={{ fontSize: '11px', display: 'block', opacity: 0.8 }}>Contraseña:</label>
                <input
                  type="password"
                  value={credentials.fiverr?.pass || ''}
                  onChange={(e) => handleCredChange('fiverr', 'pass', e.target.value)}
                  style={{ width: '100%', padding: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', marginTop: '4px' }}
                />
              </div>
            </div>
          </div>

          {credsMessage && (
            <p style={{ 
              padding: '10px', 
              borderRadius: '6px', 
              background: credsMessage.type === 'success' ? 'rgba(74, 222, 128, 0.1)' : 'rgba(248, 113, 113, 0.1)', 
              color: credsMessage.type === 'success' ? '#4ade80' : '#f87171',
              fontSize: '13px',
              border: `1px solid ${credsMessage.type === 'success' ? 'rgba(74, 222, 128, 0.2)' : 'rgba(248, 113, 113, 0.2)'}`,
              marginTop: '12px'
            }}>
              {credsMessage.text}
            </p>
          )}

          <button
            type="submit"
            disabled={savingCreds}
            className="btn-primary"
            style={{ 
              marginTop: '8px', 
              background: '#2563eb', 
              borderColor: '#2563eb', 
              width: '100%', 
              padding: '10px', 
              borderRadius: '6px', 
              fontWeight: 'bold', 
              cursor: 'pointer' 
            }}
          >
            {savingCreds ? '💾 Guardando...' : '💾 Guardar Credenciales'}
          </button>
        </form>
      </section>
    </div>
  );
}