'use client';

import { BrandLoadingLogo, MajordomeHomeLogo } from './BrandLogo';

type AuthMode = 'login' | 'register';

export function LoginAuthScreen({
  C,
  authMode,
  setAuthMode,
  email,
  setEmail,
  password,
  setPassword,
  error,
  setError,
  info,
  setInfo,
  loading,
  onSubmit,
}: {
  C: Record<string, string>;
  authMode: AuthMode;
  setAuthMode: (mode: AuthMode | ((prev: AuthMode) => AuthMode)) => void;
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  error: string;
  setError: (v: string) => void;
  info: string;
  setInfo: (v: string) => void;
  loading: boolean;
  onSubmit: () => void | Promise<void>;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        minHeight: 0,
      }}
    >
      <div
        style={{
          flexShrink: 0,
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          background: 'transparent',
        }}
      >
        <MajordomeHomeLogo maxHeight={40} />
      </div>
      <div
        style={{
          flex: 1,
          padding: 18,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorY: 'contain',
          touchAction: 'pan-y',
        }}
      >
        <h2 style={{ margin: 0, color: C.text }}>{authMode === 'register' ? 'Créer un compte' : 'Connexion'}</h2>
        <p style={{ color: C.text2, fontSize: 13 }}>
          {authMode === 'register'
            ? 'Inscris ton foyer pour commencer avec MajorDome.'
            : 'Connecte-toi pour utiliser MajorDome.'}
        </p>
        {error ? (
          <p
            role="alert"
            style={{
              margin: '0 0 12px',
              padding: '10px 12px',
              borderRadius: 12,
              background: C.redL,
              color: C.red,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {error}
          </p>
        ) : null}
        {info && !error ? <p style={{ margin: '0 0 12px', fontSize: 13, color: C.green }}>{info}</p> : null}
        {loading ? (
          <div style={{ marginBottom: 12 }}>
            <BrandLoadingLogo compact />
          </div>
        ) : null}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onSubmit();
          }}
          style={{ display: 'grid', gap: 10 }}
          autoComplete="on"
        >
          <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 600, color: C.text2 }}>
            Adresse e-mail
            <input
              name="email"
              type="email"
              autoComplete="username"
              aria-label="Adresse e-mail"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError('');
              }}
              placeholder="vous@exemple.fr"
              style={{ padding: 10, borderRadius: 12, border: `1px solid ${C.border}` }}
            />
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 600, color: C.text2 }}>
            Mot de passe
            <input
              name="password"
              type="password"
              autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
              aria-label="Mot de passe"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError('');
              }}
              placeholder="••••••••"
              style={{ padding: 10, borderRadius: 12, border: `1px solid ${C.border}` }}
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: 12,
              borderRadius: 12,
              border: 'none',
              background: C.terra,
              color: '#fff',
              fontWeight: 700,
            }}
          >
            {loading
              ? authMode === 'register'
                ? 'Création…'
                : 'Connexion…'
              : authMode === 'register'
                ? 'Créer mon compte'
                : 'Se connecter'}
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode((m) => (m === 'login' ? 'register' : 'login'));
              setError('');
              setInfo('');
            }}
            style={{
              padding: 10,
              borderRadius: 12,
              border: `1px solid ${C.border}`,
              background: C.white,
              color: C.text2,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {authMode === 'login'
              ? 'Pas encore de compte ? Créer un compte'
              : 'Déjà inscrit ? Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}
