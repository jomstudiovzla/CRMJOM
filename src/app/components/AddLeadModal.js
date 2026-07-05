import React, { useState } from 'react';
import './AddLeadModal.css';

export default function AddLeadModal({ isOpen, onClose, onSaved }) {
  const [form, setForm] = useState({
    nombre_negocio: '',
    email: '',
    telefono: '',
    web: '',
  });
  const [step, setStep] = useState(null);
  const [preview, setPreview] = useState(null);
  const [feedback, setFeedback] = useState(null);

  if (!isOpen) return null;

  const reset = () => {
    setForm({ nombre_negocio: '', email: '', telefono: '', web: '' });
    setStep(null);
    setPreview(null);
    setFeedback(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const runAudit = async () => {
    if (!form.web.trim()) return null;
    setStep('auditing');
    try {
      const res = await fetch('/api/scraper/deep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: form.web.trim(),
          nombre_negocio: form.nombre_negocio.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPreview({
          gap_detectado: data.data.gap_detectado,
          solucion_jom: data.data.solucion_jom,
          web: data.data.url,
        });
        return data.data;
      }
      setFeedback({ type: 'error', text: data.error });
    } catch (error) {
      setFeedback({ type: 'error', text: error.message });
    } finally {
      setStep(null);
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nombre_negocio.trim()) {
      setFeedback({ type: 'error', text: 'El nombre del negocio es obligatorio' });
      return;
    }

    setFeedback(null);
    let auditData = preview;

    if (form.web.trim() && !preview) {
      auditData = await runAudit();
    }

    setStep('saving');
    try {
      const res = await fetch('/api/leads/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre_negocio: form.nombre_negocio.trim(),
          email: form.email.trim(),
          telefono: form.telefono.trim(),
          web: auditData?.url || form.web.trim(),
          gap_detectado: preview?.gap_detectado || auditData?.gap_detectado,
          solucion_jom: preview?.solucion_jom || auditData?.solucion_jom,
          gap_from_audit: Boolean(preview || auditData),
          origen: 'Manual + IA',
          runDeepAudit: false,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onSaved?.();
        handleClose();
      } else {
        setFeedback({ type: 'error', text: data.error });
      }
    } catch (error) {
      setFeedback({ type: 'error', text: error.message });
    }
    setStep(null);
  };

  const handleAuditOnly = async () => {
    if (!form.web.trim()) {
      setFeedback({ type: 'error', text: 'Ingresa la URL web para auditar' });
      return;
    }
    if (!form.nombre_negocio.trim()) {
      setFeedback({ type: 'error', text: 'Ingresa el nombre del negocio primero' });
      return;
    }
    setFeedback(null);
    await runAudit();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content add-lead-modal glass-panel animate-fade-in">
        <div className="modal-header">
          <h2>➕ Añadir Lead Manual</h2>
          <button className="close-btn" onClick={handleClose}>×</button>
        </div>

        {feedback && (
          <div className={`feedback-bar ${feedback.type}`}>{feedback.text}</div>
        )}

        <form onSubmit={handleSubmit} className="add-lead-form">
          <label>
            Nombre del negocio *
            <input
              value={form.nombre_negocio}
              onChange={(e) => setForm({ ...form, nombre_negocio: e.target.value })}
              placeholder="Ej: Inmobiliaria Caracas Premium"
              required
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="contacto@empresa.com"
            />
          </label>
          <label>
            Teléfono
            <input
              value={form.telefono}
              onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              placeholder="+58 412 000 0000"
            />
          </label>
          <label>
            Sitio web
            <input
              type="url"
              value={form.web}
              onChange={(e) => {
                setForm({ ...form, web: e.target.value });
                setPreview(null);
              }}
              placeholder="https://empresa.com"
            />
          </label>

          {step === 'auditing' && (
            <div className="ai-loader-inline">
              <span className="ai-loader-pulse">🕵️</span>
              <span>Auditando web...</span>
            </div>
          )}

          {preview && (
            <div className="gap-preview glass-panel">
              <h4>Gap detectado por IA</h4>
              <textarea
                rows={3}
                value={preview.gap_detectado}
                onChange={(e) => setPreview({ ...preview, gap_detectado: e.target.value })}
              />
              {preview.solucion_jom && (
                <p className="solucion-jom">
                  <strong>Solución JOM:</strong> {preview.solucion_jom}
                </p>
              )}
            </div>
          )}

          <div className="add-lead-actions">
            {form.web.trim() && (
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={handleAuditOnly}
                disabled={step === 'auditing' || step === 'saving'}
              >
                {step === 'auditing' ? '🕵️ Auditando...' : '🕵️ Auditar Web'}
              </button>
            )}
            <button
              type="submit"
              className="btn-primary btn-sm"
              disabled={step === 'auditing' || step === 'saving'}
            >
              {step === 'saving' ? '⏳ Guardando...' : '✅ Guardar Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}