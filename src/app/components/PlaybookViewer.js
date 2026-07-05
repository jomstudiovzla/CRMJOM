'use client';

import React, { useState, useEffect } from 'react';
import './PlaybookViewer.css';

export default function PlaybookViewer() {
  const [files, setFiles] = useState([]);
  const [selected, setSelected] = useState(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/playbook');
        const data = await res.json();
        if (!cancelled && data.success) setFiles(data.data);
      } catch (error) {
        console.error('Error cargando playbook:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const openFile = async (file) => {
    setSelected(file);
    setContent('Cargando...');
    const res = await fetch(`/api/playbook?file=${encodeURIComponent(file.path)}`);
    const data = await res.json();
    setContent(data.success ? data.content : data.error || 'Error al cargar');
  };

  if (loading) {
    return <div className="playbook-loading">Cargando playbook...</div>;
  }

  return (
    <div className="playbook-viewer animate-fade-in">
      <aside className="playbook-sidebar glass-panel">
        <h2>📚 Playbook JOM</h2>
        <p className="playbook-hint">6 bloques + plantillas</p>
        <ul>
          {files.map((f) => (
            <li key={f.path}>
              <button
                className={selected?.path === f.path ? 'active' : ''}
                onClick={() => openFile(f)}
              >
                {f.title}
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <article className="playbook-content glass-panel">
        {selected ? (
          <>
            <header>
              <h3>{selected.title}</h3>
              <span className="playbook-path">{selected.path}</span>
            </header>
            <pre>{content}</pre>
          </>
        ) : (
          <div className="playbook-empty">
            <p>Selecciona un documento del playbook para leerlo aquí.</p>
          </div>
        )}
      </article>
    </div>
  );
}