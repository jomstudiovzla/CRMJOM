function getFirebaseApiKey() {
  return (
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() ||
    process.env.FIREBASE_API_KEY?.trim() ||
    ''
  );
}

export async function verifyFirebaseIdToken(idToken) {
  const apiKey = getFirebaseApiKey();
  if (!apiKey) {
    throw new Error('NEXT_PUBLIC_FIREBASE_API_KEY no configurada en Vercel');
  }

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    const msg = data.error?.message || 'Token de Firebase inválido';
    throw new Error(msg);
  }

  const user = data.users?.[0];
  if (!user?.email) {
    throw new Error('No se pudo verificar el usuario de Google');
  }

  return {
    email: user.email,
    uid: user.localId,
    name: user.displayName || 'Admin PRO',
    picture: user.photoUrl || '/logo_jom_square.jpg',
  };
}