'use client';

import React, { Suspense } from 'react';
import LoginPage from '../components/LoginPage';

export default function Login() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>Cargando...</div>}>
      <LoginPage />
    </Suspense>
  );
}