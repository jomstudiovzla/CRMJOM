'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import './UserMenu.css';

export default function UserMenu({ user }) {
  const [open, setOpen] = useState(false);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  if (!user) return null;

  return (
    <div className="user-menu">
      <button className="user-trigger" onClick={() => setOpen(!open)}>
        {user.picture ? (
          <Image
            src={user.picture}
            alt=""
            width={32}
            height={32}
            className="user-avatar"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="user-avatar-fallback">J</span>
        )}
        <span className="user-name">{user.name?.split(' ')[0]}</span>
        <span className="pro-pill">PRO</span>
      </button>

      {open && (
        <>
          <div className="user-backdrop" onClick={() => setOpen(false)} />
          <div className="user-dropdown glass-panel">
            <div className="dropdown-header">
              <strong>{user.name}</strong>
              <span>{user.email}</span>
              <span className="role-tag">Administrador JOM Studio</span>
            </div>
            <button onClick={logout} className="logout-btn">
              Cerrar sesión
            </button>
          </div>
        </>
      )}
    </div>
  );
}