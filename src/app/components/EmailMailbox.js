'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { buildCamp01Email, buildFollowUpEmail } from '@/lib/emailTemplates';
import GmailSetupBanner from './GmailSetupBanner';
import './EmailMailbox.css';

export default function EmailMailbox({ leads, onUpdate, initialLead }) {
  const [threads, setThreads] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);
  const [folder, setFolder] = useState('inbox');
  const [emailStatus, setEmailStatus] = useState({ gmailConfigured: false, mode: 'mailto' });
  const [compose, setCompose] = useState({ to: '', subject: '', body: '' });
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const getThreadForLead = (nombre) =>
    threads.find((t) => t.nombre_negocio?.toLowerCase() === nombre?.toLowerCase());

  const selectLead = useCallback((lead) => {
    setSelectedLead(lead);
    setFeedback(null);
    const thread = threads.find(
      (t) => t.nombre_negocio?.toLowerCase() === lead.nombre_negocio?.toLowerCase()
    );
    const hasSent = thread?.messages?.some((m) => m.status === 'sent');

    const template = hasSent ? buildFollowUpEmail(lead) : buildCamp01Email(lead);
    setCompose({
      to: lead.email,
      subject: template.subject,
      body: template.body,
    });
  }, [threads]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [threadsRes, statusRes] = await Promise.all([
          fetch('/api/email/threads'),
          fetch('/api/email/status'),
        ]);
        const [threadsData, statusData] = await Promise.all([
          threadsRes.json(),
          statusRes.json(),
        ]);

        if (cancelled) return;
        if (threadsData.success) setThreads(threadsData.data);
        if (statusData.success) setEmailStatus(statusData);
      } catch (error) {
        console.error('Error cargando comunicaciones:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!initialLead || !leads.length || selectedLead) return;

    const found = leads.find(
      (l) => l.nombre_negocio?.toLowerCase() === initialLead.toLowerCase()
    );
    if (!found?.email) return;

    const timer = window.setTimeout(() => selectLead(found), 0);
    return () => window.clearTimeout(timer);
  }, [initialLead, leads, selectedLead, selectLead]);

  const contactableLeads = leads.filter((l) => l.email);

  const pendingLeads = contactableLeads.filter((l) => {
    const t = getThreadForLead(l.nombre_negocio);
    const sent = t?.messages?.some((m) => m.status === 'sent');
    return !sent && l.estado_pipeline !== 'respondio';
  });

  const sentLeads = contactableLeads.filter((l) => {
    const t = getThreadForLead(l.nombre_negocio);
    return t?.messages?.some((m) => m.status === 'sent');
  });

  const listForFolder = () => {
    if (folder === 'pending') return pendingLeads;
    if (folder === 'sent') return sentLeads;
    return contactableLeads;
  };

  const handleSend = async () => {
    if (!selectedLead || !compose.to) return;
    setSending(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre_negocio: selectedLead.nombre_negocio,
          to: compose.to,
          subject: compose.subject,
          body: compose.body,
          telefono: selectedLead.telefono,
          markContacted: true,
        }),
      });
      const data = await res.json();

      if (!data.success) {
        setFeedback({ type: 'error', text: data.error });
        return;
      }

      if (data.deliveryMode === 'mailto' && data.mailto) {
        window.open(data.mailto, '_blank');
        setFeedback({
          type: 'info',
          text: 'Gmail no configurado — se abrió tu cliente de correo. El mensaje quedó guardado en el CRM.',
        });
      } else {
        setFeedback({ type: 'success', text: '✅ Email enviado desde tu Gmail' });
      }

      const threadsRes = await fetch('/api/email/threads');
      const threadsData = await threadsRes.json();
      if (threadsData.success) setThreads(threadsData.data);
      onUpdate?.();
    } catch (e) {
      setFeedback({ type: 'error', text: e.message });
    } finally {
      setSending(false);
    }
  };

  const openWhatsApp = (lead) => {
    if (!lead.telefono) return;
    const phone = lead.telefono.replace(/\D/g, '');
    const gap = lead.gap_detectado?.slice(0, 80) || 'mejorar su captación de visitas';
    const text = `Hola, soy Jesús Omar de JOM Studio 👋 Le escribí sobre ${lead.nombre_negocio} y ${gap}. ¿Recibió el email?`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const currentThread = selectedLead ? getThreadForLead(selectedLead.nombre_negocio) : null;

  return (
    <div className="email-mailbox animate-fade-in">
      <GmailSetupBanner status={emailStatus} compact={emailStatus?.imapReady} />

      <div className="mailbox-status glass-panel">
        <span className={`status-dot ${emailStatus.imapReady || emailStatus.gmailConfigured ? 'connected' : 'mailto'}`} />
        {emailStatus.imapReady || emailStatus.gmailConfigured ? (
          <span>✅ Gmail conectado (SMTP + IMAP) — <strong>{emailStatus.fromEmail}</strong></span>
        ) : (
          <span>
            Modo mailto activo — <strong>{emailStatus.fromEmail || 'jomstudiovzla@gmail.com'}</strong>.
            Añade Contraseña de Aplicación para enviar/leer desde el portal.
          </span>
        )}
      </div>

      <div className="mailbox-layout glass-panel">
        <aside className="mailbox-sidebar">
          <button className="compose-btn" onClick={() => setSelectedLead(null)}>
            ✏️ Redactar
          </button>
          <nav>
            <button
              className={folder === 'inbox' ? 'active' : ''}
              onClick={() => setFolder('inbox')}
            >
              📥 Bandeja <span>{contactableLeads.length}</span>
            </button>
            <button
              className={folder === 'pending' ? 'active' : ''}
              onClick={() => setFolder('pending')}
            >
              ⏳ Pendientes <span>{pendingLeads.length}</span>
            </button>
            <button
              className={folder === 'sent' ? 'active' : ''}
              onClick={() => setFolder('sent')}
            >
              📤 Enviados <span>{sentLeads.length}</span>
            </button>
          </nav>
        </aside>

        <div className="mailbox-list">
          <div className="list-header">
            <h3>
              {folder === 'pending' ? 'Sin contactar' : folder === 'sent' ? 'Contactados' : 'Todos los leads'}
            </h3>
          </div>
          <div className="list-items">
            {listForFolder().map((lead) => {
              const thread = getThreadForLead(lead.nombre_negocio);
              const isActive = selectedLead?.nombre_negocio === lead.nombre_negocio;
              const hasSent = thread?.messages?.some((m) => m.status === 'sent');

              return (
                <button
                  key={lead.nombre_negocio}
                  className={`list-item ${isActive ? 'active' : ''} ${hasSent ? 'sent' : ''}`}
                  onClick={() => selectLead(lead)}
                >
                  <div className="item-top">
                    <strong>{lead.nombre_negocio}</strong>
                    <span className="item-badge">{lead.calidad_lead}</span>
                  </div>
                  <div className="item-email">{lead.email}</div>
                  {thread?.last_preview && (
                    <div className="item-preview">{thread.last_preview}…</div>
                  )}
                  {!hasSent && lead.estado_pipeline === 'nuevo' && (
                    <span className="item-new">Nuevo</span>
                  )}
                </button>
              );
            })}
            {listForFolder().length === 0 && (
              <div className="list-empty">No hay leads en esta carpeta</div>
            )}
          </div>
        </div>

        <div className="mailbox-main">
          {selectedLead ? (
            <>
              <div className="main-header">
                <div>
                  <h2>{selectedLead.nombre_negocio}</h2>
                  <p>{selectedLead.email} {selectedLead.telefono && `· ${selectedLead.telefono}`}</p>
                </div>
                <div className="main-actions">
                  {selectedLead.telefono && (
                    <button className="btn-secondary btn-sm" onClick={() => openWhatsApp(selectedLead)}>
                      💬 WhatsApp
                    </button>
                  )}
                  <button
                    className="btn-secondary btn-sm"
                    onClick={() => {
                      const t = buildCamp01Email(selectedLead);
                      setCompose({ to: selectedLead.email, subject: t.subject, body: t.body });
                    }}
                  >
                    📋 Plantilla CAMP-01
                  </button>
                </div>
              </div>

              {selectedLead.gap_detectado && (
                <div className="gap-banner">
                  <strong>Gap:</strong> {selectedLead.gap_detectado}
                </div>
              )}

              {currentThread?.messages?.length > 0 && (
                <div className="thread-history">
                  <h4>Historial</h4>
                  {currentThread.messages.map((msg) => (
                    <div key={msg.id} className={`thread-msg ${msg.status}`}>
                      <div className="msg-meta">
                        <span>{msg.subject}</span>
                        <span>{new Date(msg.sentAt).toLocaleString('es-VE')}</span>
                        <span className="msg-status">{msg.status}</span>
                      </div>
                      <pre>{msg.body.slice(0, 200)}{msg.body.length > 200 ? '…' : ''}</pre>
                    </div>
                  ))}
                </div>
              )}

              <div className="compose-form">
                <div className="field-row">
                  <label>Para</label>
                  <input
                    value={compose.to}
                    onChange={(e) => setCompose({ ...compose, to: e.target.value })}
                  />
                </div>
                <div className="field-row">
                  <label>Asunto</label>
                  <input
                    value={compose.subject}
                    onChange={(e) => setCompose({ ...compose, subject: e.target.value })}
                  />
                </div>
                <div className="field-row body-row">
                  <label>Mensaje</label>
                  <textarea
                    rows={14}
                    value={compose.body}
                    onChange={(e) => setCompose({ ...compose, body: e.target.value })}
                  />
                </div>

                {feedback && (
                  <div className={`feedback feedback-${feedback.type}`}>{feedback.text}</div>
                )}

                <div className="compose-actions">
                  <button className="btn-primary" onClick={handleSend} disabled={sending}>
                    {sending ? 'Enviando…' : emailStatus.gmailConfigured ? '📧 Enviar desde Gmail' : '📧 Abrir en Gmail / Mail'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="main-empty">
              <p>📬 Portal de comunicaciones JOM</p>
              <p className="hint">Selecciona un lead de la lista para redactar el email de prospección</p>
              <p className="hint">{pendingLeads.length} leads pendientes de primer contacto</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}