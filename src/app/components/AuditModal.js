'use client';

import React from 'react';
import './AuditModal.css';

export default function AuditModal({ isOpen, result, onClose }) {
  if (!isOpen || !result) return null;

  return (
    <div className="modal-backdrop">
      <div className="audit-modal glass-panel animate-scale-up">
        <header className="modal-header">
          <h3>🕵️ Perfil Corporativo Extraído</h3>
          <button className="btn-close" onClick={onClose}>×</button>
        </header>

        <div className="modal-body">
          <div className="section-block">
            <span className="section-label">🏢 ¿Qué es la empresa y a qué se dedica?</span>
            <p className="section-value">{result.descripcion_empresa || 'No especificado.'}</p>
          </div>

          <div className="section-block">
            <span className="section-label">⏳ Trayectoria / Antigüedad:</span>
            <p className="section-value">{result.historia || 'No especificado.'}</p>
          </div>

          <div className="section-block">
            <span className="section-label">🎨 Paleta de Colores Corporativos:</span>
            <p className="section-value" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="color-indicator"></span>
              {result.paleta_colores || 'No especificado.'}
            </p>
          </div>

          <div className="section-block">
            <span className="section-label">🎯 Nicho Detectado:</span>
            <p className="section-value">
              <span className="nicho-badge">{result.nicho_detectado || 'General'}</span>
            </p>
          </div>

          <hr style={{ borderColor: 'rgba(255,255,255,0.1)', margin: '16px 0' }} />

          <div className="section-block">
            <span className="section-label" style={{ color: '#f87171' }}>⚠️ Fallo Crítico (Gap) Detectado:</span>
            <p className="section-value font-highlight">{result.gap_detectado || 'No especificado.'}</p>
          </div>

          <div className="section-block">
            <span className="section-label" style={{ color: '#4ade80' }}>💡 Solución JOM Propuesta:</span>
            <p className="section-value font-highlight" style={{ color: '#4ade80' }}>{result.solucion_jom || 'No especificado.'}</p>
          </div>
        </div>

        <footer className="modal-footer">
          <button className="btn-primary" onClick={onClose} style={{ width: '100%' }}>Entendido</button>
        </footer>
      </div>
    </div>
  );
}
