'use client';

import type { ComponentType } from 'react';
import { useMemo, useState } from 'react';
import {
  IconCalendar,
  IconCart,
  IconCheckSmall,
  IconDotsGrid,
  IconFolderVault,
  IconHome,
  IconPeopleOutline,
  IconScale,
  IconSparkleAI,
  IconTarget,
  IconUserHeart,
  IconFlowerOutline,
} from './md-icons';
import type { HomeLayoutConfig } from '../lib/homeLayout';
import { maskEmail } from '../lib/maskEmail';
import { ONBOARDING_TOTAL_STEPS } from '../lib/onboardingScreens';
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

const TOTAL_STEPS = ONBOARDING_TOTAL_STEPS;

type Props = {
  C: Record<string, string>;
  userEmail: string;
  initialProfile: WelcomeFamilyProfile;
  Wordmark: ComponentType<{ maxHeight?: number }>;
  onLogout: () => void;
  onComplete: (layout: HomeLayoutConfig, profile: WelcomeFamilyProfile) => void;
  onSkipAll: (profile: WelcomeFamilyProfile) => void;
  /** Aperçu : pas d’effet sur le stockage réel. */
  previewMode?: boolean;
  initialStep?: number;
};

function FeatureBullets({ items, C }: { items: string[]; C: Record<string, string> }) {
  return (
    <ul style={{ margin: '14px 0 0', paddingLeft: 18, textAlign: 'left', maxWidth: 320 }}>
      {items.map((t) => (
        <li key={t} style={{ fontSize: 13, color: C.text2, lineHeight: 1.5, marginBottom: 8 }}>
          {t}
        </li>
      ))}
    </ul>
  );
}

export function WelcomeSetupWizard({
  C,
  userEmail,
  initialProfile,
  Wordmark,
  onLogout,
  onComplete,
  onSkipAll,
  previewMode = false,
  initialStep = 0,
}: Props) {
  const [step, setStep] = useState(() => Math.min(Math.max(0, initialStep), TOTAL_STEPS - 1));
  const [profile, setProfile] = useState<WelcomeFamilyProfile>(() => ({ ...initialProfile }));
  const [interests, setInterests] = useState<Set<PostLoginInterestId>>(() => new Set());

  const previewLayout = useMemo(
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
    if (step === 7) return profile.prenom.trim().length > 0;
    if (step === 8) return profile.partenaire.trim().length > 0 && profile.enfant.trim().length > 0;
    if (step === 9) return profile.objectif.trim().length > 0;
    return true;
  }

  const isLastStep = step === TOTAL_STEPS - 1;
  const isProfileOrPersonalize = step >= 7;

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
      {previewMode ? (
        <div
          style={{
            flexShrink: 0,
            padding: '6px 12px',
            background: '#1a1a2e',
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            textAlign: 'center',
          }}
        >
          Mode aperçu — écran {step + 1} / {TOTAL_STEPS}
        </div>
      ) : null}

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
          {previewMode ? 'Quitter l’aperçu' : 'Déconnexion'}
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
            <span style={{ fontSize: 11, fontWeight: 700, color: C.text2 }}>
              Étape {step + 1} / {TOTAL_STEPS}
              {step < 7 ? ' · Découverte' : step < 9 ? ' · Profil' : ' · Personnalisation'}
            </span>
            <span style={{ fontSize: 10, color: C.text3 }} suppressHydrationWarning>
              {previewMode ? 'aperçu@majordome.test' : maskEmail(userEmail)}
            </span>
          </div>
          <div style={{ height: 6, borderRadius: 6, background: C.surface3, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${((step + 1) / TOTAL_STEPS) * 100}%`,
                borderRadius: 6,
                background: `linear-gradient(90deg, ${C.terra}, ${C.lilac})`,
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
              Avant d’entrer dans l’app, on te montre <strong>ce que MajorDome fait pour toi</strong>, puis on configure ton
              foyer et ton accueil sur mesure.
            </p>
            <FeatureBullets
              C={C}
              items={[
                'Briefing du jour et charge mentale visible',
                'Alfred pour trier, rappeler et déléguer',
                'Modules maison, école, santé et admin réunis',
              ]}
            />
          </>
        ) : null}

        {step === 1 ? (
          <>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
              <IconHome size={52} color={C.terra} strokeWidth={1.5} />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: C.text, textAlign: 'center', margin: '0 0 8px' }}>
              Ton écran « Aujourd’hui »
            </h2>
            <p style={{ fontSize: 13, color: C.text2, textAlign: 'center', lineHeight: 1.5, margin: 0, maxWidth: 320 }}>
              Chaque matin : ce qui compte <strong>maintenant</strong>, sans tout ouvrir.
            </p>
            <FeatureBullets
              C={C}
              items={[
                'Météo mentale et humeur du matin',
                'Urgences du jour (max 3)',
                'Raccourcis vers tes modules favoris',
                'Bouton « Personnaliser » pour afficher ou masquer des blocs',
              ]}
            />
          </>
        ) : null}

        {step === 2 ? (
          <>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
              <IconSparkleAI size={52} color={C.terra} strokeWidth={1.45} />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: C.text, textAlign: 'center', margin: '0 0 8px' }}>
              Alfred, ton co-pilote
            </h2>
            <p style={{ fontSize: 13, color: C.text2, textAlign: 'center', lineHeight: 1.5, margin: 0, maxWidth: 320 }}>
              Un assistant qui connaît ton foyer et peut <strong>agir</strong> dans l’app.
            </p>
            <FeatureBullets
              C={C}
              items={[
                'Chat : courses, agenda, tâches, messages partenaire',
                'Mode « Je suis débordée » : tri automatique',
                'Suggestions selon l’heure et ta situation',
                'Mémoire utile sur cet appareil',
              ]}
            />
          </>
        ) : null}

        {step === 3 ? (
          <>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
              <IconCalendar size={52} color={C.terra} strokeWidth={1.5} />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: C.text, textAlign: 'center', margin: '0 0 8px' }}>
              Agenda & tâches
            </h2>
            <p style={{ fontSize: 13, color: C.text2, textAlign: 'center', lineHeight: 1.5, margin: 0, maxWidth: 320 }}>
              Un seul endroit pour voir la semaine et qui fait quoi.
            </p>
            <FeatureBullets
              C={C}
              items={[
                'Événements (Google, Apple, Doctolib…)',
                'Tâches ouvertes et terminées',
                'Assignation : toi, partenaire, enfant',
                'Conflits d’horaires signalés',
              ]}
            />
          </>
        ) : null}

        {step === 4 ? (
          <>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
              <IconCart size={52} color={C.terra} strokeWidth={1.5} />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: C.text, textAlign: 'center', margin: '0 0 8px' }}>
              Courses, frigo & budget
            </h2>
            <p style={{ fontSize: 13, color: C.text2, textAlign: 'center', lineHeight: 1.5, margin: 0, maxWidth: 320 }}>
              Moins de gaspillage, listes partagées, enveloppes claires.
            </p>
            <FeatureBullets
              C={C}
              items={[
                'Liste de courses partagée',
                'Alertes DLC frigo',
                'Recettes et planning repas',
                'Budget du mois et wallet (fidélité, coupons)',
              ]}
            />
          </>
        ) : null}

        {step === 5 ? (
          <>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
              <IconFolderVault size={52} color={C.terra} strokeWidth={1.5} />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: C.text, textAlign: 'center', margin: '0 0 8px' }}>
              Coffre & courrier
            </h2>
            <p style={{ fontSize: 13, color: C.text2, textAlign: 'center', lineHeight: 1.5, margin: 0, maxWidth: 320 }}>
              Les papiers importants du foyer, accessibles en un tap.
            </p>
            <FeatureBullets
              C={C}
              items={[
                'Passeports, mutuelle, impôts…',
                'Scan photo ou PDF',
                'Courrier IA (école, santé, admin)',
                'Stockage sécurisé par foyer sur le serveur',
              ]}
            />
          </>
        ) : null}

        {step === 6 ? (
          <>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
              <IconScale size={52} color={C.terra} strokeWidth={1.5} />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: C.text, textAlign: 'center', margin: '0 0 8px' }}>
              Équité du foyer
            </h2>
            <p style={{ fontSize: 13, color: C.text2, textAlign: 'center', lineHeight: 1.5, margin: 0, maxWidth: 320 }}>
              La grande force de MajorDome : rendre la charge <strong>visible</strong> et négociable.
            </p>
            <FeatureBullets
              C={C}
              items={[
                'Répartition des tâches assignées',
                'Notifier le partenaire en un clic',
                'Score équité et suggestions de rééquilibrage',
                'Mode débordée pour alléger la journée',
              ]}
            />
          </>
        ) : null}

        {step === 7 ? (
          <>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
              <IconFlowerOutline size={52} color={C.terra} strokeWidth={1.5} />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: C.text, textAlign: 'center', margin: '0 0 14px' }}>
              Comment tu t’appelles ?
            </h2>
            <input
              value={profile.prenom}
              onChange={(e) => setProfile((p) => ({ ...p, prenom: e.target.value }))}
              placeholder="Ton prénom"
              aria-label="Ton prénom"
              style={{
                width: '100%',
                maxWidth: 340,
                padding: '14px 16px',
                borderRadius: 14,
                border: `1.5px solid ${C.border}`,
                background: C.white,
                fontSize: 16,
                color: C.text,
              }}
            />
          </>
        ) : null}

        {step === 8 ? (
          <>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
              <IconPeopleOutline size={52} color={typeof C.alex === 'string' ? C.alex : '#4A72B8'} strokeWidth={1.5} />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: C.text, textAlign: 'center', margin: '0 0 14px' }}>
              Ton foyer
            </h2>
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
          </>
        ) : null}

        {step === 9 ? (
          <>
            <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center', gap: 8 }}>
              <IconTarget size={28} color={C.terra} strokeWidth={1.5} />
              <IconDotsGrid size={28} color={C.terra} strokeWidth={1.65} />
              <IconUserHeart size={28} color={C.terra} strokeWidth={1.65} />
            </div>
            <h2 style={{ fontSize: 19, fontWeight: 800, color: C.text, textAlign: 'center', margin: '0 0 6px' }}>
              Objectif & priorités
            </h2>
            <p style={{ fontSize: 12, color: C.text2, textAlign: 'center', margin: '0 0 12px', lineHeight: 1.45 }}>
              On pré-personnalise ton accueil — modifiable à tout moment.
            </p>
            <div style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {OBJECTIF_CHOICES.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setProfile((p) => ({ ...p, objectif: c }))}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 14,
                    border: `1.5px solid ${profile.objectif === c ? C.terra : C.border}`,
                    background: profile.objectif === c ? C.terraXL : C.white,
                    fontSize: 13,
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
            <div style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {POST_LOGIN_INTEREST_OPTIONS.map((opt) => {
                const on = interests.has(opt.id);
                return (
                  <button
                    type="button"
                    key={opt.id}
                    onClick={() => toggleInterest(opt.id)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 14,
                      border: `1.5px solid ${on ? C.terra : C.border}`,
                      background: on ? C.terraXL : C.white,
                      fontSize: 12,
                      color: C.text,
                      fontWeight: on ? 700 : 500,
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ display: 'block', fontWeight: 700 }}>{opt.label}</span>
                    <span style={{ display: 'block', fontSize: 10, color: C.text2, marginTop: 2 }}>{opt.hint}</span>
                  </button>
                );
              })}
            </div>
            {!previewMode ? (
              <div style={{ marginTop: 14, width: '100%', maxWidth: 340, padding: 12, borderRadius: 16, background: C.white, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: C.text }}>Ensuite (recommandé)</div>
                <div style={{ marginTop: 6, fontSize: 12, color: C.text2, lineHeight: 1.5 }}>
                  Connecte ton agenda dans{' '}
                  <a href="/settings" style={{ color: C.terra, fontWeight: 800, textDecoration: 'none' }}>
                    Paramètres → Connexions
                  </a>
                  .
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      <div style={{ flexShrink: 0, padding: '0 22px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {!isLastStep && !isProfileOrPersonalize ? (
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
            Passer la présentation (configurer plus tard)
          </button>
        ) : !isLastStep ? (
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
            Passer (accueil par défaut)
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
            {isLastStep
              ? previewMode
                ? 'Terminer l’aperçu'
                : 'Enregistrer et ouvrir MajorDome'
              : step === 0
                ? 'Découvrir les fonctionnalités →'
                : step === 6
                  ? 'Configurer mon foyer →'
                  : 'Suivant →'}
          </button>
        </div>
      </div>
    </div>
  );
}
