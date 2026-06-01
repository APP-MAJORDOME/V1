'use client';

import Link from 'next/link';
import { useState } from 'react';
import { WelcomeSetupWizard, type WelcomeFamilyProfile } from '../../components/WelcomeSetupWizard';
import { ONBOARDING_SCREENS, ONBOARDING_TOTAL_STEPS } from '../../lib/onboardingScreens';
import { MajordomeWordmark } from '../../components/BrandLogo';
const C = {
  bg: '#FEF9F5',
  white: '#FFFFFF',
  surface2: '#F5EDE8',
  terra: '#D96B52',
  terraXL: '#FDEAE5',
  lilac: '#B49BD1',
  lilacL: '#F0EBFA',
  alex: '#4A72B8',
  mint: '#5BAA8A',
  text: '#2C1F1A',
  text2: '#7A6A5A',
  text3: '#9A8882',
  border: '#EDE3DE',
};

const DEMO_PROFILE: WelcomeFamilyProfile = {
  prenom: 'Marie',
  partenaire: 'Alex',
  enfant: 'Léa',
  ageEnfant: '8 ans',
  objectif: 'Répartir équitablement les tâches',
};

/** Aperçu local du parcours (~10 écrans) — rien n’est enregistré ni déployé automatiquement. */
export default function OnboardingPreviewPage() {
  const [started, setStarted] = useState(false);
  const [startStep, setStartStep] = useState(0);
  const [lastDone, setLastDone] = useState<string | null>(null);

  if (started) {
    return (
      <div style={{ minHeight: '100vh', background: '#e8ddd8', display: 'flex', justifyContent: 'center', padding: 16 }}>
        <div
          className="app-device"
          style={{
            width: 390,
            height: 844,
            maxHeight: 'calc(100dvh - 32px)',
            borderRadius: 52,
            overflow: 'hidden',
            border: '10px solid #d4c8c2',
            boxShadow: '0 40px 80px rgba(0,0,0,0.2)',
            display: 'flex',
            flexDirection: 'column',
            background: C.bg,
          }}
        >
          <WelcomeSetupWizard
            C={C}
            userEmail="apercu@majordome.test"
            initialProfile={DEMO_PROFILE}
            Wordmark={MajordomeWordmark}
            previewMode
            initialStep={startStep}
            onLogout={() => setStarted(false)}
            onComplete={() => {
              setLastDone('Parcours terminé (aperçu — aucune donnée enregistrée).');
              setStarted(false);
            }}
            onSkipAll={() => {
              setLastDone('Parcours passé (aperçu).');
              setStarted(false);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: '24px 16px 48px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 800, color: C.terra, letterSpacing: 0.5, margin: '0 0 6px' }}>APERÇU — NON DÉPLOYÉ SEUL</p>
            <h1 style={{ margin: 0, fontSize: 26, color: C.text }}>Parcours de découverte MajorDome</h1>
            <p style={{ margin: '10px 0 0', fontSize: 14, color: C.text2, lineHeight: 1.55 }}>
              {ONBOARDING_TOTAL_STEPS} écrans : présentation des fonctionnalités, puis personnalisation du foyer et de
              l’accueil. Valide cette liste avant mise en prod.
            </p>
          </div>
          <Link href="/" style={{ fontSize: 13, fontWeight: 700, color: C.terra, textDecoration: 'none', flexShrink: 0 }}>
            ← App
          </Link>
        </div>

        {lastDone ? (
          <p style={{ padding: 12, borderRadius: 12, background: C.terraXL, color: C.terra, fontSize: 13, marginBottom: 16 }}>
            {lastDone}
          </p>
        ) : null}

        <ol style={{ margin: '0 0 24px', paddingLeft: 20, display: 'grid', gap: 12 }}>
          {ONBOARDING_SCREENS.map((s) => (
            <li key={s.id} style={{ lineHeight: 1.45 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: C.terra }}>Écran {s.step}</span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: C.text3,
                    background: C.surface2,
                    padding: '2px 8px',
                    borderRadius: 8,
                  }}
                >
                  {s.kind === 'intro' ? 'Fonctionnalité' : s.kind === 'profile' ? 'Profil' : 'Personnalisation'}
                </span>
              </div>
              <strong style={{ display: 'block', fontSize: 15, color: C.text, marginTop: 4 }}>{s.title}</strong>
              <span style={{ fontSize: 13, color: C.text2 }}>{s.subtitle}</span>
              <button
                type="button"
                onClick={() => {
                  setStartStep(s.step - 1);
                  setStarted(true);
                }}
                style={{
                  marginTop: 8,
                  border: `1px solid ${C.border}`,
                  borderRadius: 10,
                  padding: '6px 12px',
                  background: C.white,
                  fontSize: 12,
                  fontWeight: 700,
                  color: C.terra,
                  cursor: 'pointer',
                }}
              >
                Voir cet écran →
              </button>
            </li>
          ))}
        </ol>

        <button
          type="button"
          onClick={() => {
            setStartStep(0);
            setStarted(true);
          }}
          style={{
            width: '100%',
            maxWidth: 360,
            padding: 16,
            borderRadius: 14,
            border: 'none',
            background: C.terra,
            color: '#fff',
            fontWeight: 800,
            fontSize: 15,
            cursor: 'pointer',
          }}
        >
          Lancer le parcours complet (écran 1 → {ONBOARDING_TOTAL_STEPS})
        </button>

        <p style={{ marginTop: 16, fontSize: 12, color: C.text3, lineHeight: 1.45 }}>
          En production, ce parcours s’affiche après la première connexion (tant que le compte ne l’a pas terminé). Les
          utilisateurs déjà passés ne le revoient pas — utilise cette page pour valider le contenu.
        </p>
      </div>
    </div>
  );
}
