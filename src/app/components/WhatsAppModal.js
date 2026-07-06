import React, { useState, useEffect } from 'react';
import './WhatsAppModal.css';

export default function WhatsAppModal({ isOpen, onClose, lead, onSent }) {
  const [telefono, setTelefono] = useState('');
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (lead) {
      setTelefono(lead.telefono || '');
      setDraft('');
      setFeedback(null);
      // Auto-generate draft on open if possible
      generateDraft();
    }
  }, [lead]);

  const generateDraft = async () => {
    if (!lead) return;
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/whatsapp/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre_negocio: lead.nombre_negocio,
          lead: { ...lead, telefono }
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDraft(data.data.body);
      } else {
        setFeedback({ type: 'error', text: data.error });
      }
    } catch (error) {
      setFeedback({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !lead) return null;

  const handleSend = async () => {
    if (!telefono.trim()) {
      setFeedback({ type: 'error', text: 'El número de teléfono es obligatorio para enviar por WhatsApp' });
      return;
    }

    const cleanPhone = telefono.replace(/[^0-9]/g, ''); // Solo números

    try {
      // Actualizar el estado del lead a 'contactado' y guardar el teléfono verídico
      const res = await fetch('/api/leads/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre_negocio: lead.nombre_negocio,
          nuevo_estado: 'contactado',
          extra: { telefono: telefono.trim() }
        }),
      });

      if (res.ok) {
        onSent?.();
      }
    } catch (e) {
      console.error('[WhatsApp Modal] Error actualizando lead:', e);
    }

    // Abrir WhatsApp Web directamente para usar la sesión activa del navegador (trabajo)
    const wsUrl = `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(draft)}`;
    window.open(wsUrl, '_blank');
    onClose();
  };

  return (
    <div className="wa-modal-overlay">
      <div className="wa-modal glass-panel animate-fade-in">
        <div className="wa-modal-header">
          <h3>💬 Mensaje de WhatsApp para {lead.nombre_negocio}</h3>
          <button className="wa-close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="wa-modal-body">
          {feedback && (
            <div className={`wa-feedback wa-feedback-${feedback.type}`}>{feedback.text}</div>
          )}

          <div className="wa-input-group">
            <label>📞 Número de Contacto (Teléfono con código de país, ej. 584120000000):</label>
            <input 
              type="text" 
              value={telefono} 
              onChange={(e) => setTelefono(e.target.value)} 
              placeholder="Número de teléfono verídico..."
            />
          </div>

          <div className="wa-input-group">
            <label>📝 Pitch de WhatsApp (Generado por IA):</label>
            <textarea 
              value={draft} 
              onChange={(e) => setDraft(e.target.value)} 
              placeholder={loading ? "Generando borrador personalizado con IA..." : "Escribe tu mensaje aquí..."}
              disabled={loading}
              rows={8}
            />
          </div>
        </div>

        <div className="wa-modal-footer">
          <button 
            className="btn-secondary" 
            onClick={generateDraft} 
            disabled={loading}
          >
            {loading ? '⏳ Redactando...' : '🔄 Re-generar con IA'}
          </button>
          
          <button 
            className="btn-primary" 
            onClick={handleSend}
            disabled={loading || !telefono.trim()}
          >
            🚀 Abrir en WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}
