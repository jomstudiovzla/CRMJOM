'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Dashboard from './components/Dashboard';
import LeadManager from './components/LeadManager';
import MailsViewer from './components/MailsViewer';
import PlaybookViewer from './components/PlaybookViewer';
import CompanyProfile from './components/CompanyProfile';
import UserMenu from './components/UserMenu';
import styles from './page.module.css';

const VALID_TABS = new Set(['company', 'leads', 'mails', 'dashboard', 'playbook']);

export default function Home() {
  const [leads, setLeads] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('company');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [leadsRes, sessionRes] = await Promise.all([
          fetch('/api/leads'),
          fetch('/api/auth/session'),
        ]);
        const [leadsData, sessionData] = await Promise.all([
          leadsRes.json(),
          sessionRes.json(),
        ]);

        if (cancelled) return;

        if (leadsData.success) setLeads(leadsData.data);
        if (sessionData.isLoggedIn) setUser(sessionData.user);

        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        if (tab && VALID_TABS.has(tab)) setActiveTab(tab);
      } catch (error) {
        console.error('Error iniciando portal:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const fetchLeads = async () => {
    try {
      const res = await fetch('/api/leads');
      const data = await res.json();
      if (data.success) setLeads(data.data);
    } catch (error) {
      console.error('Error fetching leads:', error);
    }
  };

  const navigate = (tab) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    window.history.replaceState({}, '', url);
  };

  const tabs = [
    { id: 'company', label: '🏢 Empresa', pro: true },
    { id: 'leads', label: '👥 Leads', pro: true },
    { id: 'mails', label: '📬 Mails', pro: true },
    { id: 'dashboard', label: '📊 Dashboard', pro: true },
    { id: 'playbook', label: '📚 Playbook', pro: true },
  ];

  return (
    <main className={`${styles.main} ${activeTab === 'mails' ? styles.mainWide : ''}`}>
      <nav className={`${styles.nav} glass-panel`}>
        <div className={styles.logo}>
          <Image
            src="/logo_jom_square.jpg"
            alt="JOM STUDIO"
            width={64}
            height={64}
            className={styles.logoImg}
            priority
          />
          <span className={styles.tag}>JOM Studio · Pro</span>
        </div>
        <div className={styles.tabs}>
          {tabs.map((t) => (
            <button
              key={t.id}
              className={`${styles.tabBtn} ${activeTab === t.id ? styles.active : ''}`}
              onClick={() => navigate(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <UserMenu user={user} />
      </nav>

      <div className={styles.content}>
        {loading && activeTab === 'company' && <div className={styles.loading}>Iniciando portal JOM Studio...</div>}
        
        {(!loading || activeTab !== 'company') && (
          <>
            {activeTab === 'company' && (
              <CompanyProfile user={user} leads={leads} onNavigate={navigate} />
            )}
            {activeTab === 'leads' && <LeadManager leads={leads} onUpdate={fetchLeads} />}
            {activeTab === 'mails' && (
              <MailsViewer leads={leads} onUpdate={fetchLeads} />
            )}
            {activeTab === 'dashboard' && <Dashboard leads={leads} />}
            {activeTab === 'playbook' && <PlaybookViewer />}
          </>
        )}
      </div>
    </main>
  );
}