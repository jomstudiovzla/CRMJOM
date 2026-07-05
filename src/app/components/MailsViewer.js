import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import './MailsViewer.css';
import { buildCamp01Email } from '@/lib/emailTemplates';
import AiStatusBanner from './AiStatusBanner';

const AI_REPLY_STATES = new Set(['mas_informacion', 'interesado', 'contactado']);
function needsAiDraft(lead, messages) {
  const pipeline = lead?.estado_pipeline || lead?.categoria_ia;
  if (AI_REPLY_STATES.has(pipeline)) return true;
  if ((messages || []).length > 0) return true;
  return (messages || []).some((m) => m.status === 'received' || m.direction === 'inbound');
}

export default function MailsViewer({ leads, onUpdate }) {
  // Folder & Data state
  const [activeFolder, setActiveFolder] = useState('inbox'); // 'inbox', 'important', 'spam', 'leads'
  const [inboxEmails, setInboxEmails] = useState([]);
  const [threads, setThreads] = useState([]);
  const [emailStatus, setEmailStatus] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null); // the email or thread object currently open
  const [searchQuery, setSearchQuery] = useState('');

  // Bulk actions state (for Inbox, Important, Spam)
  const [selectedUids, setSelectedUids] = useState(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Actions state
  const [deletingId, setDeletingId] = useState(null);
  const [extractingId, setExtractingId] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [isSyncing, setIsSyncing] = useState(true);
  
  // Ghostwriter / Thread state
  const [compose, setCompose] = useState({ to: '', subject: '', body: '' });
  const [sending, setSending] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [aiGenerated, setAiGenerated] = useState(false);
  const draftCache = useRef(new Map());

  // Deep Audit / Extraction state
  const [pendingLead, setPendingLead] = useState(null);
  const [webUrl, setWebUrl] = useState('');
  const [pipelineStep, setPipelineStep] = useState(null);
  const [auditPreview, setAuditPreview] = useState(null);

  // Fetch all data independently
  const fetchData = useCallback(async () => {
    // 1. Fetch Threads (Fast)
    try {
      const threadsRes = await fetch('/api/email/threads');
      const threadsData = await threadsRes.json();
      if (threadsData.success) {
        setThreads(threadsData.data.sort((a, b) => {
          const aTime = a.messages?.[0]?.sentAt ? new Date(a.messages[0].sentAt) : new Date(0);
          const bTime = b.messages?.[0]?.sentAt ? new Date(b.messages[0].sentAt) : new Date(0);
          return bTime - aTime;
        }));
      }
    } catch (e) { console.error('Error threads:', e); }

    // 2. Fetch Status
    try {
      const statusRes = await fetch('/api/email/status');
      const statusData = await statusRes.json();
      if (statusData.success) setEmailStatus(statusData);
    } catch (e) { console.error('Error status:', e); }

    // 3. Sync Inbox (Slow, might fail)
    setIsSyncing(true);
    try {
      const syncRes = await fetch('/api/email/sync');
      const syncData = await syncRes.json();
      if (syncData.success) {
        setInboxEmails(syncData.inbox || []);
      }
    } catch (e) {
      console.error('Error sync:', e);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle URL 'lead' param for auto-opening
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const leadParam = params.get('lead');
    if (leadParam && threads) {
      if (selectedItem?.nombre_negocio !== leadParam) {
        setActiveFolder('leads');
        const existingThread = threads.find(t => t.nombre_negocio === leadParam);
        const itemToSelect = existingThread || { nombre_negocio: leadParam, messages: [] };
        handleSelectItem(itemToSelect, true);
      }
    }
  }, [threads]);

  // Derived lists based on folder & search
  const filteredList = useMemo(() => {
    let list = [];
    if (activeFolder === 'leads') {
      list = threads;
    } else {
      list = inboxEmails;
      if (activeFolder === 'important') {
        list = list.filter((e) => e.categoria_ia !== 'spam');
      } else if (activeFolder === 'spam') {
        list = list.filter((e) => e.categoria_ia === 'spam');
      }
    }

    const q = searchQuery.toLowerCase();
    if (q) {
      if (activeFolder === 'leads') {
        list = list.filter(t => 
          t.nombre_negocio.toLowerCase().includes(q) || 
          (t.to || '').toLowerCase().includes(q)
        );
      } else {
        list = list.filter(e => 
          e.from.toLowerCase().includes(q) || 
          e.fromName?.toLowerCase().includes(q) || 
          e.subject?.toLowerCase().includes(q)
        );
      }
    }
    return list;
  }, [activeFolder, inboxEmails, threads, searchQuery]);

  // Selection Logic
  const handleSelectItem = async (item, forceAi = false) => {
    setSelectedItem(item);
    setFeedback(null);
    setPipelineStep(null);
    
    // Si abrimos un hilo de lead, intentar autogenerar respuesta
    if (activeFolder === 'leads' || forceAi) {
      const messages = item.messages || [];
      const contactEmail = messages[0]?.to || item.to || 'Sin email';
      const lead = leads.find((l) => l.nombre_negocio === item.nombre_negocio) || { nombre_negocio: item.nombre_negocio, email: contactEmail };
      
      if (forceAi || needsAiDraft(lead, messages)) {
        await fetchAiDraft(item.nombre_negocio, contactEmail, messages, forceAi);
      } else {
        const template = buildCamp01Email(lead);
        setCompose({ to: lead.email || contactEmail || '', subject: template.subject, body: template.body });
        setAiGenerated(false);
        setDrafting(false);
      }
    }
  };

  const toggleSelectAll = () => {
    if (selectedUids.size === filteredList.length && filteredList.length > 0) {
      setSelectedUids(new Set());
    } else {
      setSelectedUids(new Set(filteredList.map(e => e.uid)));
    }
  };

  const toggleSelection = (uid, e) => {
    e.stopPropagation();
    setSelectedUids(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (selectedUids.size === 0) return;
    setIsBulkDeleting(true);
    const uids = Array.from(selectedUids);
    try {
      const res = await fetch('/api/email/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uids }),
      });
      if (res.ok) {
        setInboxEmails((prev) => prev.filter((e) => !uids.includes(e.uid)));
        setSelectedUids(new Set());
        setFeedback({ type: 'success', text: `✅ Eliminados ${uids.length} correos.` });
        if (selectedItem && uids.includes(selectedItem.uid)) setSelectedItem(null);
      }
    } catch (error) {
      setFeedback({ type: 'error', text: 'Error al borrar.' });
    }
    setIsBulkDeleting(false);
  };

  const handleDelete = async (uid) => {
    setDeletingId(uid);
    try {
      const res = await fetch('/api/email/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uids: [uid] }),
      });
      if (res.ok) {
        setInboxEmails((prev) => prev.filter((e) => e.uid !== uid));
        setFeedback({ type: 'success', text: '✅ Correo borrado' });
        if (selectedItem?.uid === uid) setSelectedItem(null);
      }
    } catch (error) {
      setFeedback({ type: 'error', text: 'Error al borrar.' });
    }
    setDeletingId(null);
  };

  // Save Lead & Extract
  const runDeepAudit = async (url, leadData) => {
    setPipelineStep('auditing');
    try {
      const res = await fetch('/api/scraper/deep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, nombre_negocio: leadData.nombre_negocio }),
      });
      const data = await res.json();
      if (data.success) {
        return {
          ...leadData,
          web: data.data.url,
          gap_detectado: data.data.gap_detectado,
          solucion_jom: data.data.solucion_jom,
          gap_from_audit: true,
        };
      }
      setFeedback({ type: 'error', text: data.error || 'Error en auditoría' });
    } catch (error) {
      setFeedback({ type: 'error', text: error.message });
    }
    return { ...leadData, web: url };
  };

  const handleSaveLead = async (leadData, uid) => {
    try {
      const res = await fetch('/api/leads/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...leadData, runDeepAudit: false }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({ type: 'success', text: `✅ ${leadData.nombre_negocio} guardado` });
        setInboxEmails((prev) => prev.filter((e) => e.uid !== uid));
        setPendingLead(null);
        setPipelineStep(null);
        if (selectedItem?.uid === uid) setSelectedItem(null);
        if (onUpdate) onUpdate();
      } else {
        setFeedback({ type: 'error', text: data.error });
      }
    } catch (error) {
      setFeedback({ type: 'error', text: error.message });
    }
  };

  const resolveAndAudit = async (leadData, uid) => {
    setPipelineStep('resolving');
    let url = leadData.web || '';

    if (!url) {
      try {
        const res = await fetch('/api/scraper/resolve-domain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre_negocio: leadData.nombre_negocio }),
        });
        const data = await res.json();
        if (data.success && data.data?.url) url = data.data.url;
      } catch (error) { console.error('Error:', error); }
    }

    if (!url) {
      setPendingLead(leadData);
      setWebUrl('');
      setPipelineStep('awaiting_url');
      setExtractingId(null);
      return;
    }

    const enriched = await runDeepAudit(url, leadData);
    setPipelineStep('preview');
    setExtractingId(null);
    setAuditPreview({ lead: enriched, uid });
  };

  const handleConfirmWeb = async () => {
    if (!pendingLead || !webUrl.trim()) return;
    setPipelineStep('auditing');
    const enriched = await runDeepAudit(webUrl.trim(), pendingLead);
    setPipelineStep('preview');
    setPendingLead(null);
    setAuditPreview({ lead: enriched, uid: selectedItem.uid });
  };

  const handleConfirmPreview = async () => {
    if (!auditPreview) return;
    await handleSaveLead(auditPreview.lead, auditPreview.uid);
    setAuditPreview(null);
    setPipelineStep(null);
  };

  const handleExtract = async (email) => {
    setExtractingId(email.uid);
    setFeedback(null);
    setPipelineStep('extracting');
    try {
      const res = await fetch('/api/email/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailBody: email.body || email.preview }),
      });
      const data = await res.json();
      if (data.success && data.data.nombre_negocio && data.data.nombre_negocio !== 'No detectado') {
        await resolveAndAudit({ ...data.data, origen: 'IA Extractor' }, email.uid);
      } else {
        setFeedback({ type: 'error', text: '🕵️ IA: No encontré empresa oculta.' });
        setExtractingId(null);
        setPipelineStep(null);
      }
    } catch (error) {
      setFeedback({ type: 'error', text: error.message });
      setExtractingId(null);
      setPipelineStep(null);
    }
  };

  // Ghostwriter / Thread methods
  const fetchAiDraft = useCallback(async (leadName, email, messages, force = false) => {
    const cacheKey = `${leadName}:${messages.length}`;
    if (!force && draftCache.current.has(cacheKey)) {
      const cached = draftCache.current.get(cacheKey);
      setCompose(cached.compose);
      setAiGenerated(cached.aiGenerated);
      return;
    }

    const lead = leads.find((l) => l.nombre_negocio === leadName) || { nombre_negocio: leadName, email };
    setDrafting(true);
    setAiGenerated(false);

    try {
      const res = await fetch('/api/email/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre_negocio: leadName, messages, lead }),
      });
      const data = await res.json();

      if (data.success && data.data) {
        const nextCompose = { to: lead.email || email || '', subject: data.data.subject, body: data.data.body };
        setCompose(nextCompose);
        const isAi = data.data.generatedByAi !== false;
        setAiGenerated(isAi);
        draftCache.current.set(cacheKey, { compose: nextCompose, aiGenerated: isAi });
        return;
      }
    } catch (e) {
      console.error('Error fetching AI draft:', e);
    } finally {
      setDrafting(false);
    }

    const template = buildCamp01Email(lead);
    const fallback = { to: lead.email || email || '', subject: template.subject, body: template.body };
    setCompose(fallback);
    setAiGenerated(false);
    draftCache.current.set(cacheKey, { compose: fallback, aiGenerated: false });
  }, [leads]);

  const handleSend = async (leadName) => {
    if (!compose.to) return;
    setSending(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre_negocio: leadName,
          to: compose.to,
          subject: compose.subject,
          body: compose.body,
          markContacted: true,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setFeedback({ type: 'error', text: data.error });
      } else {
        setFeedback({ type: 'success', text: '✅ Enviado.' });
        draftCache.current.delete(`${leadName}:${(threads.find((t) => t.nombre_negocio === leadName)?.messages || []).length}`);
        setCompose({ ...compose, body: '' });
        setAiGenerated(false);
        await fetchData();
        onUpdate && onUpdate();
      }
    } catch (e) {
      setFeedback({ type: 'error', text: e.message });
    }
    setSending(false);
  };

  const renderReadingPane = () => {
    if (!selectedItem) {
      return (
        <div className="reading-empty">
          <span>📬</span>
          <p>Selecciona un correo o hilo para visualizarlo</p>
        </div>
      );
    }

    if (activeFolder === 'leads') {
      const thread = selectedItem;
      const messages = thread.messages || [];
      const contactEmail = messages[0]?.to || thread.to || 'Sin email';
      return (
        <>
          <div className="reading-header">
            <h2 className="reading-subject">Hilo con {thread.nombre_negocio}</h2>
            <div className="reading-sender-info">
              <div>
                <span className="sender-name">{contactEmail}</span>
              </div>
              <div>{messages.length} mensajes</div>
            </div>
          </div>
          <div className="reading-body">
            <div className="timeline">
              {messages.map((msg, idx) => (
                <div key={idx} className={`timeline-msg ${msg.status}`}>
                  <div className="msg-header">
                    <span className="msg-subj">{msg.subject}</span>
                    <span className="msg-time">{new Date(msg.sentAt).toLocaleString()}</span>
                  </div>
                  <pre className="msg-content">{msg.body}</pre>
                  <span className={`status-badge ${msg.status}`}>{msg.status}</span>
                </div>
              ))}
            </div>

            <div className="reply-box">
              {drafting && (
                <div className="ai-loader">
                  <span className="ai-loader-pulse">🧠</span>
                  <span>Escribiendo respuesta...</span>
                </div>
              )}
              <input
                className="reply-subj"
                value={compose.subject}
                onChange={(e) => { setCompose({ ...compose, subject: e.target.value }); setAiGenerated(false); }}
                placeholder="Asunto..."
                disabled={drafting}
              />
              <textarea
                className={`reply-body ${aiGenerated ? 'ai-filled' : ''}`}
                rows={6}
                value={compose.body}
                onChange={(e) => { setCompose({ ...compose, body: e.target.value }); setAiGenerated(false); }}
                placeholder={drafting ? 'La IA está redactando...' : 'Escribe tu mensaje...'}
                disabled={drafting}
              />
              <div className="reply-actions">
                {feedback && <span className={`reply-fb ${feedback.type}`}>{feedback.text}</span>}
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => fetchAiDraft(thread.nombre_negocio, contactEmail, messages, true)}
                  disabled={drafting || sending}
                >
                  🔄 Regenerar IA
                </button>
                <button
                  className={aiGenerated ? 'btn-ai-send btn-sm' : 'btn-primary btn-sm'}
                  onClick={() => handleSend(thread.nombre_negocio)}
                  disabled={sending || drafting || !compose.body}
                >
                  {sending ? 'Enviando...' : aiGenerated ? '✨ Generado por IA — Enviar' : 'Responder'}
                </button>
              </div>
            </div>
          </div>
        </>
      );
    }

    const email = selectedItem;
    return (
      <>
        <div className="reading-header">
          <div className="reading-toolbar">
            <div className="reading-actions">
              {email.categoria_ia === 'spam' ? (
                <button 
                  className="btn-secondary btn-sm" 
                  onClick={() => handleExtract(email)}
                  disabled={extractingId === email.uid || pipelineStep !== null}
                >
                  {extractingId === email.uid ? '🕵️ Extrayendo...' : '🔍 Extraer Empresa Oculta'}
                </button>
              ) : (
                <button 
                  className="btn-primary btn-sm"
                  onClick={() => handleSaveLead({ nombre_negocio: email.fromName || email.from, email: email.from, gap_detectado: 'Recibido en inbox' }, email.uid)}
                >
                  ➕ Guardar como Lead
                </button>
              )}
              <button 
                className="btn-danger btn-sm"
                onClick={() => handleDelete(email.uid)}
                disabled={deletingId === email.uid}
              >
                {deletingId === email.uid ? 'Borrando...' : '🗑️ Eliminar'}
              </button>
            </div>
          </div>
          <h2 className="reading-subject">{email.subject}</h2>
          <div className="reading-sender-info">
            <div>
              <span className="sender-name">{email.fromName || email.from}</span>
              <span>&lt;{email.from}&gt;</span>
              {email.categoria_ia === 'spam' && <span className="badge-spam">Spam / Portal</span>}
              {email.categoria_ia !== 'spam' && <span className="badge-importante">Importante</span>}
            </div>
            <div>{new Date(email.date).toLocaleString()}</div>
          </div>
        </div>

        <div className="reading-body">
          {pipelineStep === 'preview' && auditPreview && (
            <div className="gap-preview-panel glass-panel" style={{ marginBottom: '20px' }}>
              <h4>🕵️ Gap detectado — revisa antes de guardar</h4>
              <p className="preview-company">
                <strong>{auditPreview.lead.nombre_negocio}</strong>
                {auditPreview.lead.web && (
                  <a href={auditPreview.lead.web} target="_blank" rel="noopener noreferrer" style={{marginLeft: '8px'}}>
                    {auditPreview.lead.web} ↗
                  </a>
                )}
              </p>
              <textarea
                className="gap-edit"
                rows={3}
                style={{ width: '100%', marginBottom: '10px' }}
                value={auditPreview.lead.gap_detectado || ''}
                onChange={(e) => setAuditPreview({ ...auditPreview, lead: { ...auditPreview.lead, gap_detectado: e.target.value } })}
              />
              <div className="preview-actions">
                <button className="btn-primary btn-sm" onClick={handleConfirmPreview}>✅ Confirmar y Guardar Lead</button>
                <button className="btn-text btn-sm" onClick={() => { setAuditPreview(null); setPipelineStep(null); }}>Cancelar</button>
              </div>
            </div>
          )}

          {pipelineStep === 'awaiting_url' && pendingLead && (
            <div className="domain-prompt glass-panel" style={{ marginBottom: '20px' }}>
              <p><strong>{pendingLead.nombre_negocio}</strong> detectada — ingresa su sitio web para la auditoría:</p>
              <div className="domain-input-row" style={{ display: 'flex', gap: '8px' }}>
                <input type="url" className="domain-input" placeholder="https://empresa.com" value={webUrl} onChange={(e) => setWebUrl(e.target.value)} />
                <button className="btn-primary btn-sm" onClick={handleConfirmWeb}>🕵️ Auditar y Guardar</button>
                <button className="btn-text btn-sm" onClick={() => handleSaveLead(pendingLead, selectedItem.uid)}>Guardar sin web</button>
              </div>
            </div>
          )}

          {email.body}
        </div>
      </>
    );
  };

  return (
    <div className="mails-client">
      {/* COLUMN 1: SIDEBAR */}
      <aside className="mails-sidebar glass-panel">
        <h2>Mailbox</h2>
        <button 
          className={`folder-btn ${activeFolder === 'inbox' ? 'active' : ''}`}
          onClick={() => { setActiveFolder('inbox'); setSelectedItem(null); }}
        >
          <span>📥 Bandeja</span>
          <span className="folder-badge">{isSyncing && activeFolder === 'inbox' ? '⏳' : inboxEmails.length}</span>
        </button>
        <button 
          className={`folder-btn ${activeFolder === 'important' ? 'active' : ''}`}
          onClick={() => { setActiveFolder('important'); setSelectedItem(null); }}
        >
          <span>⭐ Importantes</span>
          <span className="folder-badge">{isSyncing && activeFolder === 'important' ? '⏳' : inboxEmails.filter(e => e.categoria_ia !== 'spam').length}</span>
        </button>
        <button 
          className={`folder-btn ${activeFolder === 'spam' ? 'active' : ''}`}
          onClick={() => { setActiveFolder('spam'); setSelectedItem(null); }}
        >
          <span>🤖 Spam / Portales</span>
          <span className="folder-badge">{isSyncing && activeFolder === 'spam' ? '⏳' : inboxEmails.filter(e => e.categoria_ia === 'spam').length}</span>
        </button>
        <button 
          className={`folder-btn ${activeFolder === 'leads' ? 'active' : ''}`}
          onClick={() => { setActiveFolder('leads'); setSelectedItem(null); }}
        >
          <span>💼 Leads / Enviados</span>
          <span className="folder-badge">{threads.length}</span>
        </button>
      </aside>

      {/* COLUMN 2: LIST */}
      <section className="mails-list-pane glass-panel">
        <div className="mails-list-header">
          <input 
            type="text" 
            className="mails-search" 
            placeholder="🔍 Buscar..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {activeFolder !== 'leads' && (
            <div className="mails-list-toolbar">
              <label className="checkbox-label">
                <input 
                  type="checkbox" 
                  checked={filteredList.length > 0 && selectedUids.size === filteredList.length}
                  onChange={toggleSelectAll}
                />
                Seleccionar Todos
              </label>
              <button 
                className="btn-danger btn-sm" 
                onClick={handleBulkDelete}
                disabled={selectedUids.size === 0 || isBulkDeleting}
              >
                {isBulkDeleting ? '⏳...' : `🔥 Borrar (${selectedUids.size})`}
              </button>
            </div>
          )}
        </div>
        
        <div className="mails-list-content">
          {filteredList.map((item) => {
            const isSelected = selectedItem?.uid ? selectedItem.uid === item.uid : selectedItem?.nombre_negocio === item.nombre_negocio;
            
            if (activeFolder === 'leads') {
              const messages = item.messages || [];
              return (
                <div 
                  key={item.nombre_negocio} 
                  className={`mail-list-item ${isSelected ? 'selected-item' : ''}`}
                  onClick={() => handleSelectItem(item)}
                >
                  <div className="item-content">
                    <div className="item-header">
                      <span className="item-sender">{item.nombre_negocio}</span>
                      <span className="item-date">{messages.length > 0 ? new Date(messages[0].sentAt).toLocaleDateString() : ''}</span>
                    </div>
                    <div className="item-subject">{messages.length > 0 ? messages[0].subject : 'Sin historial'}</div>
                    <div className="item-preview">{messages.length} msgs en el hilo</div>
                  </div>
                </div>
              );
            }

            return (
              <div 
                key={item.uid} 
                className={`mail-list-item ${isSelected ? 'selected-item' : ''}`}
                onClick={() => handleSelectItem(item)}
              >
                <input 
                  type="checkbox" 
                  className="item-checkbox" 
                  checked={selectedUids.has(item.uid)} 
                  onChange={(e) => toggleSelection(item.uid, e)} 
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="item-content">
                  <div className="item-header">
                    <span className="item-sender">{item.fromName || item.from}</span>
                    <span className="item-date">{new Date(item.date).toLocaleDateString()}</span>
                  </div>
                  <div className="item-subject">{item.subject}</div>
                  <div className="item-preview">{item.preview}</div>
                </div>
              </div>
            );
          })}
          {filteredList.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px', color: '#a1a1aa' }}>
              {isSyncing && activeFolder !== 'leads' ? '⏳ Sincronizando correos...' : 'No hay correos aquí.'}
            </div>
          )}
        </div>
      </section>

      {/* COLUMN 3: READING PANE */}
      <section className="mails-reading-pane glass-panel">
        {renderReadingPane()}
      </section>
    </div>
  );
}