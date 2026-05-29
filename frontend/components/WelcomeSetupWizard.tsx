'use client';

import type { ComponentType } from 'react';
import { useMemo, useState } from 'react';
import {
  IconCalendar,
  IconCheckSmall,
  IconDotsGrid,
  IconHome,
  IconPeopleOutline,
  IconSparkleAI,
  IconTarget,
  IconUserHeart,
  IconFlowerOutline,
} from './md-icons';
import type { HomeLayoutConfig } from '../lib/homeLayout';
import { maskEmail } from '../lib/maskEmail';
import {
  POST_LOGIN_INTEREST_OPTIONS,
  type PostLoginInterestId,
  buildHomeLayoutFromPostLoginChoices,
} from '../lib/postLoginPersonalization';

export type WelcomeFamilyProfile = {
  prenom: string;
  partenaire: string;
  enfant: string;
  ageEnfant: string;
  objectif: string;
};

const OBJECTIF_CHOICES = [
  'Répartir équitablement les tâches',
  'Gagner du temps au quotidien',
  "Arrêter d'oublier des choses",
  'S’appuyer sur Alfred pour les rappels et le tri',
  'Mieux prendre soin de moi',
] as const;

/** Onboarding court : 5 étapes max. */
const TOTAL_STEPS = 5;

type Props = {
  C: Record<string, string>;
  userEmail: string;
  initialProfile: WelcomeFamilyProfile;
  Wordmark: ComponentType<{ maxHeight?: number }>;
  onLogout: () => void;
  onComplete: (layout: HomeLayoutConfig, profile: WelcomeFamilyProfile) => void;
  /** Conserve le profil déjà saisi + disposition par défaut, marque le parcours comme vu. */
  onSkipAll: (profile: WelcomeFamilyProfile) => void;
};

export function WelcomeSetupWizard({ C, userEmail, initialProfile, Wordmark, onLogout, onComplete, onSkipAll }: Props) {
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<WelcomeFamilyProfile>(() => ({ ...initialProfile }));
  const [interests, setInterests] = useState<Set<PostLoginInterestId>>(() => new Set());

  const previewLayout = useMemo(
    // Densité fixée à balanced pour garder l’onboarding court.
    () => buildHomeLayoutFromPostLoginChoices([...interests], 'balanced'),
    [interests],
  );

  function toggleInterest(id: PostLoginInterestId) {
    setInterests((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function canGoNext(): boolean {
    if (step === 1) return profile.prenom.trim().length > 0;
    if (step === 2) return profile.partenaire.trim().length > 0 && profile.enfant.trim().length > 0;
    if (step === 3) return profile.objectif.trim().length > 0;
    return true;
  }

  const isLastStep = step === TOTAL_STEPS - 1;

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minHeight: 0,
        background: `linear-gradient(160deg, ${C.terraXL} 0%, ${C.lilacL} 100%)`,
        position: 'relative',
      }}
    >
      <div
        style={{
          flexShrink: 0,
          padding: '8px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: C.white,
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <Wordmark maxHeight={24} />
        <button type="button" onClick={onLogout} style={{ border: 'none', background: 'transparent', color: C.text2, fontSize: 12 }}>
          Déconnexion
        </button>
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          padding: '16px 22px 12px',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div style={{ width: '100%', maxWidth: 340, marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.text2 }}>Étape {step + 1} / {TOTAL_STEPS}</span>
            <span style={{ fontSize: 10, color: C.text3 }} suppressHydrationWarning>
              {maskEmail(userEmail)}
            </span>
          </div>
          <div style={{ height: 6, borderRadius: 6, background: C.surface3, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${((step + 1) / TOTAL_STEPS) * 100}%`,
                borderRadius: 6,
                background: `linear-gradient(90deg, ${C.terra}, ${C.terra})`,
                transition: 'width 0.35s ease',
              }}
            />
          </div>
        </div>

        {step === 0 ? (
          <>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
              <IconSparkleAI size={52} color={C.terra} strokeWidth={1.45} />
            </div>
            <h2 style={{ fontSize: 21, fontWeight: 800, color: C.text, textAlign: 'center', margin: '0 0 8px', lineHeight: 1.25 }}>
              Bienvenue dans MajorDome
            </h2>
            <p style={{ fontSize: 14, color: C.text2, textAlign: 'center', lineHeight: 1.55, margin: 0, maxWidth: 320 }}>
              En 2 minutes : on configure <strong>ton foyer</strong>, ton <strong>objectif</strong>, et on personnalise l’app.
              L’objectif : <strong>moins de charge mentale</strong>, moins d’oublis, et des rappels utiles avec Alfred.
            </p>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
              <IconFlowerOutline size={52} color={C.terra} strokeWidth={1.5} />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: C.text, textAlign: 'center', margin: '0 0 14px' }}>Comment tu t’appelles ?</h2>
            <input
              value={profile.prenom}
              onChange={(e) => setProfile((p) => ({ ...p, prenom: e.target.value }))}
              placeholder="Ton prénom"
              aria-label="Ton prénom"
              style={{ width: '100%', maxWidth: 340, padding: '14px 16px', borderRadius: 14, border: `1.5px solid ${C.border}`, background: C.white, fontSize: 16, color: C.text }}
            />
          </>
        ) : null}

        {step === 2 ? (
          <>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
              <IconPeopleOutline size={52} color={typeof C.alex === 'string' ? C.alex : '#4A72B8'} strokeWidth={1.5} />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: C.text, textAlign: 'center', margin: '0 0 14px' }}>Ton foyer</h2>
            <div style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                value={profile.partenaire}
                onChange={(e) => setProfile((p) => ({ ...p, partenaire: e.target.value }))}
                placeholder="Prénom du partenaire"
                aria-label="Prénom du partenaire"
                style={{ padding: '12px 16px', borderRadius: 14, border: `1.5px solid ${C.border}`, background: C.white, fontSize: 15 }}
              />
              <input
                value={profile.enfant}
                onChange={(e) => setProfile((p) => ({ ...p, enfant: e.target.value }))}
                placeholder="Prénom de l’enfant (ou des enfants)"
                aria-label="Prénom de l'enfant"
                style={{ padding: '12px 16px', borderRadius: 14, border: `1.5px solid ${C.border}`, background: C.white, fontSize: 15 }}
              />
              <input
                value={profile.ageEnfant}
                onChange={(e) => setProfile((p) => ({ ...p, ageEnfant: e.target.value }))}
                placeholder="Âge(s) ou classe"
                aria-label="Âge ou classe de l'enfant"
                style={{ padding: '12px 16px', borderRadius: 14, border: `1.5px solid ${C.border}`, background: C.white, fontSize: 15 }}
              />
            </div>
            <p style={{ fontSize: 11, color: C.text3, textAlign: 'center', marginTop: 12, maxWidth: 320, lineHeight: 1.45 }}>
              Tu peux regrouper plusieurs prénoms dans le champ enfant si besoin — c’est pour personnaliser les textes et les suggestions.
            </p>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
              <IconTarget size={52} color={C.terra} strokeWidth={1.5} />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: C.text, textAlign: 'center', margin: '0 0 14px' }}>Ton objectif principal</h2>
            <div style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {OBJECTIF_CHOICES.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setProfile((p) => ({ ...p, objectif: c }))}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 14,
                    border: `1.5px solid ${profile.objectif === c ? C.terra : C.border}`,
                    background: profile.objectif === c ? C.terraXL : C.white,
                    fontSize: 14,
                    color: C.text,
                    fontWeight: profile.objectif === c ? 700 : 500,
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {profile.objectif === c ? <IconCheckSmall size={14} color={C.terra} strokeWidth={2.5} /> : null}
                    {c}
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : null}

        {step === 4 ? (
          <>
            <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center', gap: 10 }}>
              <IconHome size={28} color={C.terra} strokeWidth={1.65} />
              <IconSparkleAI size={28} color={C.terra} strokeWidth={1.65} />
              <IconDotsGrid size={28} color={C.terra} strokeWidth={1.65} />
              <IconUserHeart size={28} color={C.terra} strokeWidth={1.65} />
              <IconCalendar size={28} color={C.terra} strokeWidth={1.65} />
            </div>
            <h2 style={{ fontSize: 19, fontWeight: 800, color: C.text, textAlign: 'center', margin: '0 0 6px' }}>Tes priorités (pour personnaliser)</h2>
            <p style={{ fontSize: 12, color: C.text2, textAlign: 'center', margin: '0 0 14px', lineHeight: 1.45 }}>
              On adapte les <strong>raccourcis</strong> et le contenu de l’accueil. Tu pourras tout modifier plus tard.
            </p>
            <div style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {POST_LOGIN_INTEREST_OPTIONS.map((opt) => {
                const on = interests.has(opt.id);
                return (
                  <button
                    type="button"
                    key={opt.id}
                    onClick={() => toggleInterest(opt.id)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 14,
                      border: `1.5px solid ${on ? C.terra : C.border}`,
                      background: on ? C.terraXL : C.white,
                      fontSize: 13,
                      color: C.text,
                      fontWeight: on ? 700 : 500,
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      {on ? (
                        <span style={{ flexShrink: 0, marginTop: 2 }}>
                          <IconCheckSmall size={16} color={C.terra} strokeWidth={2.5} />
                        </span>
                      ) : null}
                      <span>
                        <span style={{ display: 'block' }}>{opt.label}</span>
                        <span style={{ display: 'block', fontSize: 11, color: C.text2, fontWeight: 500, marginTop: 3 }}>{opt.hint}</span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div style={{ marginTop: 14, width: '100%', maxWidth: 340, padding: 12, borderRadius: 16, background: C.white, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.text }}>À faire ensuite (recommandé)</div>
              <div style={{ marginTop: 6, fontSize: 12, color: C.text2, lineHeight: 1.5 }}>
                Connecte ton agenda (Google/Apple) dans <a href="/settings" style={{ color: C.terra, fontWeight: 800, textDecoration: 'none' }}>Paramètres → Connexions</a> pour que l’app se remplisse automatiquement.
              </div>
            </div>
          </>
        ) : null}
      </div>

      <div style={{ flexShrink: 0, padding: '0 22px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {!isLastStep ? (
          <button
            type="button"
            onClick={() => onSkipAll(profile)}
            style={{
              padding: 10,
              borderRadius: 12,
              border: 'none',
              background: 'transparent',
              color: C.text2,
              fontWeight: 600,
              fontSize: 12,
            }}
          >
            Passer (garder un accueil par défaut)
          </button>
        ) : null}
        <div style={{ display: 'flex', gap: 10 }}>
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              style={{
                flex: 1,
                padding: 14,
                borderRadius: 14,
                border: `1.5px solid ${C.border}`,
                background: C.white,
                color: C.text2,
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              ← Retour
            </button>
          ) : null}
          <button
            type="button"
            disabled={!canGoNext()}
            onClick={() => {
              if (isLastStep) {
                onComplete(previewLayout, profile);
                return;
              }
              setStep((s) => s + 1);
            }}
            style={{
              flex: step > 0 ? 2 : 1,
              padding: 14,
              borderRadius: 14,
              border: 'none',
              background: C.terra,
              color: '#fff',
              fontWeight: 800,
              fontSize: 14,
              opacity: !canGoNext() ? 0.55 : 1,
            }}
          >
            {isLastStep ? 'Enregistrer et ouvrir MajorDome' : step === 0 ? 'Commencer →' : 'Suivant →'}
          </button>
        </div>
      </div>
    </div>
  );
}
