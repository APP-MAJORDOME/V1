'use client';

import { useState } from 'react';
import { getJson, patchJson } from '../lib/api';
import { MajordomeHomeLogo } from './BrandLogo';
import {
  GUIDED_CAPTURE_STORAGE_KEY,
  HOUSEHOLD_TYPE_OPTIONS,
  MEMBER_COLORS,
  ONBOARDING_V2_TOTAL_STEPS,
  type HouseholdTypeId,
} from '../lib/onboardingV2';
import type { WelcomeFamilyProfile } from './WelcomeSetupWizard';

type Props = {
  C: Record<string, string>;
  token: string;
  userEmail: string;
  initialProfile: WelcomeFamilyProfile;
  onLogout: () => void;
  onComplete: (profile: WelcomeFamilyProfile, householdType: HouseholdTypeId) => void;
};

export function OnboardingV2Wizard({ C, token, userEmail, initialProfile, onLogout, onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [householdType, setHouseholdType] = useState<HouseholdTypeId>('famille');
  const [profile, setProfile] = useState<WelcomeFamilyProfile>(() => ({ ...initialProfile }));
  const [memberColors, setMemberColors] = useState([MEMBER_COLORS[0], MEMBER_COLORS[1], MEMBER_COLORS[2]]);
  const [inviteUrl, setInviteUrl] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadInvite() {
    try {
      const data = await getJson<{ invite_url: string; share_text: string }>('/api/v1/household/invite', token);
      setInviteUrl(data.invite_url || '');
    } catch {
      /* ignore */
    }
  }

  async function saveHouseholdType() {
    setBusy(true);
    try {
      await patchJson('/api/v1/household/profile', { household_type: householdType }, token);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  function next() {
    if (step === 0) void saveHouseholdType();
    if (step === 2 && !inviteUrl) void loadInvite();
    if (step < ONBOARDING_V2_TOTAL_STEPS - 1) setStep((s) => s + 1);
    else finish();
  }

  function finish() {
    try {
      localStorage.setItem(GUIDED_CAPTURE_STORAGE_KEY, '1');
      localStorage.setItem('majordome_member_colors', JSON.stringify(memberColors));
    } catch {
      /* ignore */
    }
    onComplete(profile, householdType);
  }

  const canNext =
    step === 0
      ? true
      : step === 1
        ? profile.prenom.trim().length > 0
        : true;

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        background: `linear-gradient(160deg, ${C.terraXL} 0%, ${C.lilacL} 100%)`,
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
        <MajordomeHomeLogo maxHeight={24} />
        <button type="button" onClick={onLogout} style={{ border: 'none', background: 'transparent', color: C.text2, fontSize: 12 }}>
          Déconnexion
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 18px 24px' }}>
        <p style={{ fontSize: 11, color: C.text2, margin: '0 0 6px' }}>
          Étape {step + 1} / {ONBOARDING_V2_TOTAL_STEPS}
        </p>

        {step === 0 ? (
          <>
            <h1 className="md-display" style={{ fontSize: 24, margin: '0 0 8px', color: C.text, lineHeight: 1.2 }}>
              Le cerveau partagé de ton foyer
            </h1>
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.5, margin: '0 0 16px' }}>
              MajorDome capte la charge mentale, la rend visible, et aide à la répartir équitablement.
            </p>
            <p style={{ fontSize: 12, fontWeight: 700, color: C.text2, margin: '0 0 10px' }}>Ton type de foyer</p>
            <div style={{ display: 'grid', gap: 8 }}>
              {HOUSEHOLD_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setHouseholdType(opt.id)}
                  style={{
                    textAlign: 'left',
                    padding: '12px 14px',
                    borderRadius: 14,
                    border: `2px solid ${householdType === opt.id ? C.terra : C.border}`,
                    background: householdType === opt.id ? C.terraXL : C.white,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{opt.label}</div>
                  <div style={{ fontSize: 11, color: C.text2, marginTop: 2 }}>{opt.hint}</div>
                </button>
              ))}
            </div>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <h1 className="md-display" style={{ fontSize: 22, margin: '0 0 12px', color: C.text }}>
              Les membres du foyer
            </h1>
            {[
              { key: 'prenom' as const, label: 'Toi', colorIdx: 0 },
              { key: 'partenaire' as const, label: 'Partenaire', colorIdx: 1 },
              { key: 'enfant' as const, label: 'Enfant', colorIdx: 2 },
            ].map(({ key, label, colorIdx }) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.text2, display: 'block', marginBottom: 4 }}>
                  {label}
                </label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      background: memberColors[colorIdx],
                      flexShrink: 0,
                    }}
                  />
                  <input
                    value={profile[key]}
                    onChange={(e) => setProfile((p) => ({ ...p, [key]: e.target.value }))}
                    placeholder={label}
                    style={{
                      flex: 1,
                      border: `1px solid ${C.border}`,
                      borderRadius: 12,
                      padding: '10px 12px',
                      fontSize: 14,
                    }}
                  />
                </div>
              </div>
            ))}
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h1 className="md-display" style={{ fontSize: 22, margin: '0 0 12px', color: C.text }}>
              Invite ton partenaire
            </h1>
            <p style={{ fontSize: 13, color: C.text2, lineHeight: 1.5, margin: '0 0 14px' }}>
              Partage ce lien par WhatsApp ou SMS — tu peux aussi passer cette étape.
            </p>
            {inviteUrl ? (
              <div
                style={{
                  padding: 12,
                  borderRadius: 12,
                  background: C.white,
                  border: `1px solid ${C.border}`,
                  fontSize: 11,
                  wordBreak: 'break-all',
                  color: C.text2,
                  marginBottom: 12,
                }}
              >
                {inviteUrl}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void loadInvite()}
                style={{
                  border: `1px solid ${C.border}`,
                  borderRadius: 12,
                  padding: '10px 14px',
                  background: C.white,
                  fontSize: 12,
                  fontWeight: 700,
                  marginBottom: 12,
                }}
              >
                Générer le lien d&apos;invitation
              </button>
            )}
            {inviteUrl ? (
              <button
                type="button"
                onClick={() => {
                  void navigator.share?.({ title: 'MajorDome', text: 'Rejoins notre foyer', url: inviteUrl });
                }}
                style={{
                  border: 'none',
                  borderRadius: 12,
                  padding: '10px 14px',
                  background: C.terra,
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 800,
                  width: '100%',
                }}
              >
                Partager l&apos;invitation
              </button>
            ) : null}
          </>
        ) : null}

        {step === 3 ? (
          <>
            <h1 className="md-display" style={{ fontSize: 22, margin: '0 0 12px', color: C.text }}>
              Ta première capture
            </h1>
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.55, margin: '0 0 12px' }}>
              Dans le Salon, essaie : <strong style={{ color: C.text }}>« dentiste Léa mardi 15h »</strong>
            </p>
            <p style={{ fontSize: 13, color: C.text2, lineHeight: 1.5 }}>
              Alfred te proposera une chip à valider en un tap — c&apos;est exactement ça, MajorDome.
            </p>
          </>
        ) : null}
      </div>

      <div style={{ padding: '12px 18px max(16px, env(safe-area-inset-bottom))', background: C.white, borderTop: `1px solid ${C.border}` }}>
        <button
          type="button"
          disabled={!canNext || busy}
          onClick={next}
          style={{
            width: '100%',
            minHeight: 48,
            border: 'none',
            borderRadius: 14,
            background: C.terra,
            color: '#fff',
            fontSize: 15,
            fontWeight: 800,
            opacity: canNext && !busy ? 1 : 0.5,
          }}
        >
          {step === ONBOARDING_V2_TOTAL_STEPS - 1 ? 'Aller au Salon' : step === 2 ? 'Continuer' : 'Suivant'}
        </button>
        {step === 2 ? (
          <button
            type="button"
            onClick={() => setStep(3)}
            style={{
              width: '100%',
              marginTop: 8,
              border: 'none',
              background: 'transparent',
              color: C.text2,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            Passer cette étape
          </button>
        ) : null}
      </div>
    </div>
  );
}
