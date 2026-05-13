'use client';

import type { ComponentType } from 'react';
import { useMemo, useState } from 'react';
import {
  IconBellRing,
  IconCalendar,
  IconCheckSmall,
  IconDotsGrid,
  IconFolderVault,
  IconHome,
  IconLifebuoy,
  IconMail,
  IconMic,
  IconPeopleOutline,
  IconScale,
  IconSparkleAI,
  IconTarget,
  IconUserHeart,
  IconFlowerOutline,
} from './md-icons';
import type { HomeLayoutConfig } from '../lib/homeLayout';
import {
  POST_LOGIN_DENSITY_OPTIONS,
  POST_LOGIN_INTEREST_OPTIONS,
  type PostLoginDensity,
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

/** 14 étapes (0–13) : bienvenue, profil foyer, tutoriels, personnalisation, récap final. */
const TOTAL_STEPS = 14;

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
  const [density, setDensity] = useState<PostLoginDensity>('balanced');

  const previewLayout = useMemo(
    () => buildHomeLayoutFromPostLoginChoices([...interests], density),
    [interests, density],
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
            <span style={{ fontSize: 10, color: C.text3 }}>{userEmail}</span>
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
              En quelques minutes, on configure <strong>ton foyer</strong>, on te montre <strong>où tout se trouve</strong>, puis on
              personnalise <strong>ton accueil</strong>. L’objectif : moins de charge mentale, moins d’oublis, et des rappels utiles
              avec Alfred — souvent <strong>15 à 30 minutes gagnées</strong> par semaine une fois les habitudes prises.
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
                style={{ padding: '12px 16px', borderRadius: 14, border: `1.5px solid ${C.border}`, background: C.white, fontSize: 15 }}
              />
              <input
                value={profile.enfant}
                onChange={(e) => setProfile((p) => ({ ...p, enfant: e.target.value }))}
                placeholder="Prénom de l’enfant (ou des enfants)"
                style={{ padding: '12px 16px', borderRadius: 14, border: `1.5px solid ${C.border}`, background: C.white, fontSize: 15 }}
              />
              <input
                value={profile.ageEnfant}
                onChange={(e) => setProfile((p) => ({ ...p, ageEnfant: e.target.value }))}
                placeholder="Âge(s) ou classe"
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
              <IconCalendar size={28} color={C.terra} strokeWidth={1.65} />
              <IconUserHeart size={28} color={C.terra} strokeWidth={1.65} />
              <IconDotsGrid size={28} color={C.terra} strokeWidth={1.65} />
            </div>
            <h2 style={{ fontSize: 19, fontWeight: 800, color: C.text, textAlign: 'center', margin: '0 0 8px' }}>Navigation : les 4 onglets</h2>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: C.text2, lineHeight: 1.55, maxWidth: 320 }}>
              <li><strong style={{ color: C.text }}>Accueil</strong> : vue du jour, modules, tâches, raccourcis.</li>
              <li><strong style={{ color: C.text }}>Agenda</strong> : événements, repas du jour, synchro calendrier (Google / Apple selon connexions).</li>
              <li><strong style={{ color: C.text }}>Moi</strong> : ton bien-être, humeur, petits moments pour toi.</li>
              <li><strong style={{ color: C.text }}>Plus</strong> : tout le reste — coffre, courses, famille, intégrations, réglages.</li>
            </ul>
          </>
        ) : null}

        {step === 5 ? (
          <>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
              <IconDotsGrid size={48} color={C.terra} strokeWidth={1.65} />
            </div>
            <h2 style={{ fontSize: 19, fontWeight: 800, color: C.text, textAlign: 'center', margin: '0 0 8px' }}>L’onglet Plus : tout l’univers</h2>
            <p style={{ fontSize: 13, color: C.text2, textAlign: 'center', lineHeight: 1.55, margin: '0 0 10px', maxWidth: 320 }}>
              Ici tu ouvres les <strong>modules</strong> : courses & frigo, coffre documents, famille & équité, courrier IA, routines, wallet,
              albums, notifications, <strong>intégrations</strong> (Doctolib, ENT en raccourcis web), etc. Tu peux aussi aller aux{' '}
              <strong>Réglages</strong> pour les connexions compte.
            </p>
          </>
        ) : null}

        {step === 6 ? (
          <>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
              <IconBellRing size={44} color={C.terra} strokeWidth={1.65} />
            </div>
            <h2 style={{ fontSize: 19, fontWeight: 800, color: C.text, textAlign: 'center', margin: '0 0 8px' }}>Personnaliser l’accueil</h2>
            <p style={{ fontSize: 13, color: C.text2, textAlign: 'center', lineHeight: 1.55, margin: 0, maxWidth: 320 }}>
              Sur l’accueil, le bouton <strong>« Personnaliser »</strong> te permet de <strong>réordonner les raccourcis</strong> vers les modules
              et d’<strong>afficher ou masquer des blocs</strong> (équité, budget, humeur, etc.). Tout est mémorisé <strong>sur cet appareil</strong> pour ton
              compte — tu peux raffiner plus tard.
            </p>
          </>
        ) : null}

        {step === 7 ? (
          <>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
              <IconSparkleAI size={48} color={C.terra} strokeWidth={1.45} />
            </div>
            <h2 style={{ fontSize: 19, fontWeight: 800, color: C.text, textAlign: 'center', margin: '0 0 8px' }}>Alfred, ton assistant</h2>
            <p style={{ fontSize: 13, color: C.text2, textAlign: 'center', lineHeight: 1.55, margin: 0, maxWidth: 320 }}>
              Le <strong>bouton flottant</strong> ouvre la conversation : messages, idées, préparation de messages pour le partenaire. Tu peux
              renommer l’assistant dans Réglages. La <strong>voix temps réel</strong> dépend de la configuration serveur (clé API) — sinon
              dictée navigateur ou texte.
            </p>
            <div style={{ marginTop: 10, display: 'flex', justifyContent: 'center' }}>
              <IconMic size={32} color={C.text2} strokeWidth={1.65} />
            </div>
          </>
        ) : null}

        {step === 8 ? (
          <>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
              <IconCalendar size={48} color={C.terra} strokeWidth={1.65} />
            </div>
            <h2 style={{ fontSize: 19, fontWeight: 800, color: C.text, textAlign: 'center', margin: '0 0 8px' }}>Agenda & synchronisation</h2>
            <p style={{ fontSize: 13, color: C.text2, textAlign: 'center', lineHeight: 1.55, margin: 0, maxWidth: 320 }}>
              Connecte <strong>Google Calendar</strong> ou <strong>Apple Calendar</strong> (CalDAV) depuis Réglages pour que les événements
              remontent dans l’app. Tu peux aussi créer des événements « app seulement ». Les tâches du <strong>foyer</strong> sont synchronisées avec le
              serveur quand tu es connecté·e.
            </p>
          </>
        ) : null}

        {step === 9 ? (
          <>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center', gap: 12 }}>
              <IconFolderVault size={40} color={C.terra} strokeWidth={1.65} />
              <IconMail size={40} color={C.terra} strokeWidth={1.65} />
            </div>
            <h2 style={{ fontSize: 19, fontWeight: 800, color: C.text, textAlign: 'center', margin: '0 0 8px' }}>Coffre & courrier</h2>
            <p style={{ fontSize: 13, color: C.text2, textAlign: 'center', lineHeight: 1.55, margin: 0, maxWidth: 320 }}>
              Le <strong>coffre famille</strong> centralise contrats, santé, identité (pièces jointes chiffrées côté serveur). Le{' '}
              <strong>courrier IA</strong> aide à traiter école / admin. Tu retrouves tout depuis <strong>Plus</strong> ou les raccourcis de l’accueil.
            </p>
          </>
        ) : null}

        {step === 10 ? (
          <>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center', gap: 12 }}>
              <IconScale size={40} color={C.terra} strokeWidth={1.65} />
              <IconLifebuoy size={40} color={typeof C.red === 'string' ? C.red : '#E05C5C'} strokeWidth={1.55} />
            </div>
            <h2 style={{ fontSize: 19, fontWeight: 800, color: C.text, textAlign: 'center', margin: '0 0 8px' }}>Équité & délégation</h2>
            <p style={{ fontSize: 13, color: C.text2, textAlign: 'center', lineHeight: 1.55, margin: 0, maxWidth: 320 }}>
              Visualise la <strong>charge</strong>, lance le mode <strong>« Je suis débordée »</strong> pour trier les tâches avec Alfred, et préviens le partenaire
              quand c’est prêt. L’objectif affiché plus tôt guide les suggestions dans l’app.
            </p>
          </>
        ) : null}

        {step === 11 ? (
          <>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
              <IconDotsGrid size={48} color={C.terra} strokeWidth={1.65} />
            </div>
            <h2 style={{ fontSize: 19, fontWeight: 800, color: C.text, textAlign: 'center', margin: '0 0 6px' }}>Tes sujets du moment</h2>
            <p style={{ fontSize: 12, color: C.text2, textAlign: 'center', margin: '0 0 14px', lineHeight: 1.45 }}>
              On adapte les <strong>raccourcis modules</strong> et certains <strong>blocs</strong> de l’accueil. Tu pourras tout modifier dans « Personnaliser ».
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
          </>
        ) : null}

        {step === 12 ? (
          <>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
              <IconTarget size={48} color={C.terra} strokeWidth={1.5} />
            </div>
            <h2 style={{ fontSize: 19, fontWeight: 800, color: C.text, textAlign: 'center', margin: '0 0 6px' }}>Densité de l’accueil</h2>
            <p style={{ fontSize: 12, color: C.text2, textAlign: 'center', margin: '0 0 14px', lineHeight: 1.45 }}>
              Choisis combien d’informations tu veux voir d’un coup sur la page d’accueil.
            </p>
            <div style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {POST_LOGIN_DENSITY_OPTIONS.map((opt) => {
                const on = density === opt.id;
                return (
                  <button
                    type="button"
                    key={opt.id}
                    onClick={() => setDensity(opt.id)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 14,
                      border: `1.5px solid ${on ? C.terra : C.border}`,
                      background: on ? C.terraXL : C.white,
                      fontSize: 14,
                      color: C.text,
                      fontWeight: on ? 700 : 500,
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ display: 'block' }}>{opt.label}</span>
                    <span style={{ display: 'block', fontSize: 11, color: C.text2, fontWeight: 500, marginTop: 4 }}>{opt.hint}</span>
                  </button>
                );
              })}
            </div>
          </>
        ) : null}

        {step === 13 ? (
          <>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
              <IconSparkleAI size={48} color={C.terra} strokeWidth={1.45} />
            </div>
            <h2 style={{ fontSize: 19, fontWeight: 800, color: C.text, textAlign: 'center', margin: '0 0 10px' }}>Récap & c’est parti</h2>
            <div
              style={{
                width: '100%',
                maxWidth: 340,
                padding: 14,
                borderRadius: 16,
                border: `1px solid ${C.border}`,
                background: C.white,
                fontSize: 12,
                color: C.text2,
                lineHeight: 1.5,
              }}
            >
              <div>
                <strong style={{ color: C.text }}>Toi :</strong> {profile.prenom || '—'}
              </div>
              <div style={{ marginTop: 6 }}>
                <strong style={{ color: C.text }}>Foyer :</strong> {profile.partenaire || '—'} · enfant(s) : {profile.enfant || '—'}{' '}
                {profile.ageEnfant ? `(${profile.ageEnfant})` : ''}
              </div>
              <div style={{ marginTop: 6 }}>
                <strong style={{ color: C.text }}>Objectif :</strong> {profile.objectif || '—'}
              </div>
              <div style={{ marginTop: 6 }}>
                <strong style={{ color: C.text }}>Densité :</strong> {POST_LOGIN_DENSITY_OPTIONS.find((d) => d.id === density)?.label ?? density}
              </div>
              <div style={{ marginTop: 6 }}>
                <strong style={{ color: C.text }}>Sujets :</strong>{' '}
                {interests.size === 0
                  ? 'Par défaut'
                  : [...interests]
                      .map((id) => POST_LOGIN_INTEREST_OPTIONS.find((o) => o.id === id)?.label)
                      .filter(Boolean)
                      .join(' · ')}
              </div>
              <div style={{ marginTop: 6 }}>
                <strong style={{ color: C.text }}>Raccourcis :</strong> {previewLayout.hubShortcuts.length} tuiles sur l’accueil
              </div>
            </div>
            <p style={{ fontSize: 11, color: C.text3, textAlign: 'center', marginTop: 12, maxWidth: 300, lineHeight: 1.45 }}>
              Tout est enregistré sur cet appareil pour ton compte. Tu peux encore tout ajuster dans l’app.
            </p>
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
            Passer tout (profil + disposition par défaut)
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
