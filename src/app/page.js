'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import Dashboard from './components/Dashboard';
import LeadManager from './components/LeadManager';
import MailsViewer from './components/MailsViewer';
import PlaybookViewer from './components/PlaybookViewer';
import CompanyProfile from './components/CompanyProfile';
import UserMenu from './components/UserMenu';
import styles from './page.module.css';

const VALID_TABS = new Set(['company', 'leads', 'mails', 'dashboard', 'playbook']);

// Polling intervals
const LEADS_POLL_MS   = 4 * 60 * 60 * 1000; // cada 4 horas (Firestore lo cuida en tiempo real)
const EMAIL_POLL_MS   = 30 * 1000;           // correos cada 30 segundos
const SESSION_POLL_MS = 5 * 60 * 1000;       // sesión cada 5 minutos

export default function Home() {
  const [leads, setLeads]     = useState([]);
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('company');
  const [emailSyncTs, setEmailSyncTs] = useState(0); // señal para que MailsViewer recargue

  const emailTimerRef   = useRef(null);
  const leadsTimerRef   = useRef(null);
  const sessionTimerRef = useRef(null);

  // ── fetch helpers ────────────────────────────────────────────────────────────

  const fetchLeads = useCallback(async () => {
    try {
      const res  = await fetch('/api/leads');
      const data = await res.json();
      if (data.success) setLeads(data.data);
    } catch (err) {
      console.warn('[JOM] fetchLeads error:', err.message);
    }
  }, []);

  const triggerEmailSync = useCallback(async () => {
    try {
      await fetch('/api/email/sync');
      setEmailSyncTs(Date.now()); // notifica a MailsViewer que recargue
    } catch (err) {
      console.warn('[JOM] emailSync error:', err.message);
    }
  }, []);

  const fetchSession = useCallback(async () => {
    try {
      const res  = await fetch('/api/auth/session');
      const data = await res.json();
      if (data.isLoggedIn) setUser(data.user);
    } catch (err) {
      console.warn('[JOM] fetchSession error:', err.message);
    }
  }, []);

  // ── arranque inicial ─────────────────────────────────────────────────────────

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
        if (leadsData.success)   setLeads(leadsData.data);
        if (sessionData.isLoggedIn) setUser(sessionData.user);

        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        if (tab && VALID_TABS.has(tab)) setActiveTab(tab);
      } catch (err) {
        console.error('[JOM] Error iniciando portal:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }

      if (!cancelled) {
        triggerEmailSync().catch(() => {});
      }
    })();

    return () => { cancelled = true; };
  }, [triggerEmailSync]);

  // ── timers de tiempo real ────────────────────────────────────────────────────

  useEffect(() => {
    // Correos: cada 30 segundos
    emailTimerRef.current = setInterval(triggerEmailSync, EMAIL_POLL_MS);

    // Leads: cada 4 horas (además de Firestore live si se migra)
    leadsTimerRef.current = setInterval(fetchLeads, LEADS_POLL_MS);

    // Sesión: cada 5 min para detectar expiración
    sessionTimerRef.current = setInterval(fetchSession, SESSION_POLL_MS);

    return () => {
      clearInterval(emailTimerRef.current);
      clearInterval(leadsTimerRef.current);
      clearInterval(sessionTimerRef.current);
    };
  }, [triggerEmailSync, fetchLeads, fetchSession]);

  // ── Firestore real-time listener para leads ──────────────────────────────────

  useEffect(() => {
    // Solo en el cliente y solo si Firebase está disponible
    let unsubscribe = null;

    (async () => {
      try {
        const { initializeApp, getApps, getApp } = await import('firebase/app');
        const { getFirestore, collection, onSnapshot, orderBy, query } = await import('firebase/firestore');

        const firebaseConfig = {
          apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
          authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
          projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
          appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
        };

        if (!firebaseConfig.apiKey) return;

        const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
        const db  = getFirestore(app);

        const q = query(collection(db, 'leads'), orderBy('fecha_actualizacion', 'desc'));

        unsubscribe = onSnapshot(q, (snapshot) => {
          const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
          if (docs.length > 0) {
            setLeads(docs);
          }
        }, (err) => {
          console.warn('[JOM] Firestore onSnapshot error:', err.message);
        });
      } catch (err) {
        console.warn('[JOM] Firestore listener no disponible:', err.message);
      }
    })();

    return () => { if (unsubscribe) unsubscribe(); };
  }, []);

  // ── navegación ───────────────────────────────────────────────────────────────

  const navigate = (tab) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    window.history.replaceState({}, '', url);
  };

  const tabs = [
    { id: 'company',   label: '🏢 Empresa'   },
    { id: 'leads',     label: '👥 Leads'     },
    { id: 'mails',     label: '📬 Mails'     },
    { id: 'dashboard', label: '📊 Dashboard' },
    { id: 'playbook',  label: '📚 Playbook'  },
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
        {loading && activeTab === 'company' && (
          <div className={styles.loading}>Iniciando portal JOM Studio...</div>
        )}

        {(!loading || activeTab !== 'company') && (
          <>
            {activeTab === 'company'   && <CompanyProfile user={user} leads={leads} onNavigate={navigate} />}
            {activeTab === 'leads'     && <LeadManager leads={leads} onUpdate={fetchLeads} />}
            {activeTab === 'mails'     && <MailsViewer leads={leads} onUpdate={fetchLeads} syncTrigger={emailSyncTs} />}
            {activeTab === 'dashboard' && <Dashboard leads={leads} />}
            {activeTab === 'playbook'  && <PlaybookViewer />}
          </>
        )}
      </div>
    </main>
  );
}