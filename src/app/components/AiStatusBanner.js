'use client';

import React from 'react';
import './AiStatusBanner.css';

export default function AiStatusBanner({ status }) {
  if (!status?.imapReady || status.geminiReady) return null;

  return (
    <div className="ai-status-banner">
      <div className="asb-icon">✨</div>
      <div className="asb-body">
        <h4>Activa el Ghostwriter y el Scraper Profundo</h4>
        <p>
          Gmail ya está conectado. Para que la IA redacte respuestas automáticas y audite webs,
          añade tu clave de Google AI Studio:
        </p>
        <pre className="asb-env">{`GEMINI_API_KEY=tu-api-key-de-aistudio.google.com`}</pre>
        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="asb-link"
        >
          Obtener API Key gratis →
        </a>
      </div>
    </div>
  );
}