'use client';

import React from 'react';
import './GmailSetupBanner.css';

const STEPS = [
  { n: 1, text: 'Abre la seguridad de Google', href: 'https://myaccount.google.com/security' },
  { n: 2, text: 'Activa Verificación en dos pasos' },
  { n: 3, text: 'Crea Contraseña de aplicación "CRM JOM IA"', href: 'https://myaccount.google.com/apppasswords' },
  { n: 4, text: 'Pégala en crm-home/.env.local → GMAIL_APP_PASSWORD=' },
  { n: 5, text: 'Reinicia: npm run dev' },
];

export default function GmailSetupBanner({ status, compact = false }) {
  if (!status || status.imapReady) return null;

  return (
    <div className={`gmail-setup-banner ${compact ? 'compact' : ''}`}>
      <div className="gsb-icon">🔑</div>
      <div className="gsb-body">
        <h4>Configura Gmail para la IA (1 minuto)</h4>
        <p>
          Tu login con Firebase <strong>ya funciona</strong>. Para que{' '}
          <strong>🧠 Leer Emails (IA)</strong> entre a tu bandeja, Google exige una{' '}
          <em>Contraseña de aplicación</em> — no tu contraseña normal.
        </p>
        {!compact && (
          <ol className="gsb-steps">
            {STEPS.map((s) => (
              <li key={s.n}>
                {s.href ? (
                  <a href={s.href} target="_blank" rel="noopener noreferrer">{s.text}</a>
                ) : (
                  s.text
                )}
              </li>
            ))}
          </ol>
        )}
        <pre className="gsb-env">
{`GMAIL_USER=jomstudiovzla@gmail.com
GMAIL_APP_PASSWORD=pega-las-16-letras-sin-espacios`}
        </pre>
        {!status.geminiReady && (
          <p className="gsb-gemini">
            Opcional para clasificar: añade <code>GEMINI_API_KEY</code> en el mismo archivo.
          </p>
        )}
      </div>
    </div>
  );
}