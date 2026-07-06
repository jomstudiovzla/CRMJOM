'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { auth, googleProvider, isFirebaseConfigured } from '@/lib/firebase';
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
} from 'firebase/auth';
import './LoginPage.css';
import { getProductionLoginUrl, isVercelPreviewHost, PRODUCTION_HOST } from '@/lib/productionHost';

const ADMIN_EMAIL = 'jomstudiovzla@gmail.com';

const ERRORS = {
  not_admin: 'Solo jomstudiovzla@gmail.com puede acceder como administrador.',
  google_denied: 'Inicio de sesión cancelado en Google.',
  auth_failed: 'Error al conectar con Google. Revisa las credenciales OAuth.',
};

const FIREBASE_ERRORS = {
  'auth/invalid-api-key': 'Firebase API Key inválida — redeploy en Vercel tras pegar las variables.',
  'auth/unauthorized-domain': null,
  'auth/popup-blocked': 'Popup bloqueado — reintentando con redirección…',
  'auth/popup-closed-by-user': 'Ventana cerrada. Intenta de nuevo.',
  'auth/cancelled-popup-request': 'Espera a que termine el intento anterior.',
};

async function createServerSession(user) {
  const idToken = await user.getIdToken();
  const res = await fetch('/api/auth/firebase-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Error al crear sesión en el servidor');
  }
}

async function handleGoogleUser(user, setLocalError, setLoading) {
  if (user.email?.toLowerCase() !== ADMIN_EMAIL) {
    await signOut(auth);
    setLocalError('Acceso denegado. Solo jomstudiovzla@gmail.com tiene permisos de Admin.');
    setLoading(false);
    return false;
  }
  await createServerSession(user);
  window.location.replace('/?tab=company');
  return true;
}

export default function LoginPage() {
  const searchParams = useSearchParams();
  const errorKey = searchParams.get('error');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  const [setupHints, setSetupHints] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const host = window.location.hostname;

    if (isVercelPreviewHost(host)) {
      window.location.replace(getProductionLoginUrl());
      return undefined;
    }

    (async () => {
      try {
        const res = await fetch(`/api/auth/firebase-config?host=${encodeURIComponent(host)}`);
        const data = await res.json();
        if (!cancelled && data.hints?.length) {
          setSetupHints(data.hints);
        }
      } catch {
        /* ignore */
      }

      if (!auth || cancelled) return;

      try {
        const result = await getRedirectResult(auth);
        if (result?.user && !cancelled) {
          setLoading(true);
          await handleGoogleUser(result.user, setLocalError, setLoading);
        }
      } catch (err) {
        if (!cancelled) {
          const domainMsg = err.code === 'auth/unauthorized-domain'
            ? `Dominio "${host}" no autorizado. Firebase → Authorized domains → añade "${host}" o usa https://${PRODUCTION_HOST}/login`
            : null;
          setLocalError(domainMsg || FIREBASE_ERRORS[err.code] || err.message || 'Error tras redirección de Google');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleFirebaseLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setLocalError('');

    if (!isFirebaseConfigured() || !auth) {
      setLocalError('Firebase no configurado. Pega NEXT_PUBLIC_FIREBASE_* en Vercel y haz Redeploy.');
      setLoading(false);
      return;
    }

    try {
      const result = await signInWithPopup(auth, googleProvider);
      await handleGoogleUser(result.user, setLocalError, setLoading);
    } catch (err) {
      console.error(err);
      const popupBlocked =
        err.code === 'auth/popup-blocked' ||
        err.code === 'auth/popup-closed-by-user' ||
        err.code === 'auth/cancelled-popup-request';

      if (popupBlocked) {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectErr) {
          setLocalError(FIREBASE_ERRORS[redirectErr.code] || redirectErr.message);
        }
      } else {
        const host = window.location.hostname;
        const domainMsg = err.code === 'auth/unauthorized-domain'
          ? `Dominio "${host}" no autorizado. Firebase → Authorized domains → añade "${host}"`
          : null;
        setLocalError(
          domainMsg ||
            FIREBASE_ERRORS[err.code] ||
            err.message ||
            'Error al iniciar sesión con Google.'
        );
      }
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card glass-panel animate-fade-in">
        <div className="login-brand">
          <Image
            src="/logo_jom_square.jpg"
            alt="JOM STUDIO"
            width={80}
            height={80}
            className="login-logo-img"
            priority
          />
          <p className="login-tagline">Digital Alchemy · CRM Pro</p>
        </div>

        <div className="login-company">
          <h2>Portal administrativo</h2>
          <p>
            Inicia sesión con la cuenta Google de la empresa para acceder a leads,
            comunicaciones Gmail y playbook completo.
          </p>
          <div className="admin-badge">👑 Admin: jomstudiovzla@gmail.com</div>
        </div>

        {errorKey && ERRORS[errorKey] && (
          <div className="login-error">{ERRORS[errorKey]}</div>
        )}

        {localError && (
          <div className="login-error" style={{ marginTop: '10px' }}>{localError}</div>
        )}

        {/* Checklist UI removed */}

        <button
          className="google-btn"
          onClick={handleFirebaseLogin}
          disabled={loading}
          style={{ width: '100%', marginTop: '20px' }}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {loading ? 'Autenticando...' : 'Continuar con Google'}
        </button>

        <p className="login-footer">
          <a href="https://jomstudiovzla.github.io/Jomstudiopage/" target="_blank" rel="noopener noreferrer">
            jomstudiovzla.github.io
          </a>
        </p>
      </div>
    </div>
  );
}