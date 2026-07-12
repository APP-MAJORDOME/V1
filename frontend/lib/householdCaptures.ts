/** Captures foyer & fil Salon (API household/salon). */

export type CaptureKind = 'event_proposal' | 'task_proposal' | 'reminder' | 'suggestion';
export type CaptureStatus = 'pending' | 'approved' | 'rejected';
export type CaptureSource = 'salon' | 'whatsapp' | 'telegram' | 'alfred' | 'proactive';
export type CaptureChip = 'all' | 'today' | 'famille' | 'foyer';

export type HouseholdCapture = {
  id: string;
  kind: CaptureKind;
  status: CaptureStatus;
  source: CaptureSource;
  chip: Exclude<CaptureChip, 'all'>;
  createdLabel: string;
  sourceLabel: string;
  excerpt: string;
  inferences: string[];
  ctaPrimary?: string;
  ctaSecondary?: string;
};

export type SalonAuthor = 'self' | 'partner' | 'alfred';

export type SalonProposal = {
  title: string;
  lines: string[];
  captureId?: string;
  captureType?: 'event' | 'task' | 'grocery' | 'suggestion';
  when?: string;
  assignee?: string;
};

export type SalonMessage = {
  id: string;
  author: SalonAuthor;
  authorLabel: string;
  text: string;
  time: string;
  proposal?: SalonProposal;
};

export const CAPTURE_CHIPS: { id: CaptureChip; label: string }[] = [
  { id: 'all', label: 'Tout' },
  { id: 'today', label: "Aujourd'hui" },
  { id: 'famille', label: 'Famille' },
  { id: 'foyer', label: 'Foyer' },
];

export const INITIAL_MOCK_CAPTURES: HouseholdCapture[] = [
  {
    id: 'cap-dentiste',
    kind: 'event_proposal',
    status: 'pending',
    source: 'salon',
    chip: 'famille',
    createdLabel: 'Cette nuit · 23:14',
    sourceLabel: 'Conversation avec Antoine',
    excerpt: '« Léo dentiste samedi »',
    inferences: ['Événement proposé : samedi 10h', 'En attente de ta confirmation'],
    ctaPrimary: 'Valider',
    ctaSecondary: 'Modifier',
  },
  {
    id: 'cap-toussaint',
    kind: 'suggestion',
    status: 'pending',
    source: 'proactive',
    chip: 'foyer',
    createdLabel: 'Cette nuit · 02:40',
    sourceLabel: 'Rappel agenda + vacances scolaires',
    excerpt: '« Toussaint, on fait quoi cette année ? »',
    inferences: [
      'Aucune vacance prévue dans l’agenda (26 oct – 3 nov)',
      '3 destinations sous budget mémorisé',
    ],
    ctaPrimary: 'Voir les pistes',
    ctaSecondary: 'Plus tard',
  },
  {
    id: 'cap-pain',
    kind: 'task_proposal',
    status: 'pending',
    source: 'salon',
    chip: 'today',
    createdLabel: 'Ce matin · 7:02',
    sourceLabel: 'Antoine a ajouté dans le Salon',
    excerpt: '« Pain demain matin »',
    inferences: ['Tâche courses → assignée à toi', 'Rappel demain 7h possible'],
    ctaPrimary: 'Valider',
    ctaSecondary: '→ Antoine',
  },
  {
    id: 'cap-courses',
    kind: 'task_proposal',
    status: 'approved',
    source: 'alfred',
    chip: 'today',
    createdLabel: 'Hier · 18:22',
    sourceLabel: 'Alfred (Salon)',
    excerpt: '« Lait + yaourts pour la semaine »',
    inferences: ['3 articles ajoutés à la liste courses'],
    ctaPrimary: 'Voir courses',
  },
];

export const INITIAL_SALON_MESSAGES: SalonMessage[] = [
  {
    id: 'm1',
    author: 'partner',
    authorLabel: 'Antoine',
    text: 'Léo dentiste samedi, tu peux le noter ?',
    time: '23:12',
  },
  {
    id: 'm2',
    author: 'self',
    authorLabel: 'Camille',
    text: 'Oui je m’en occupe demain matin.',
    time: '23:13',
  },
  {
    id: 'm3',
    author: 'alfred',
    authorLabel: 'Alfred',
    text: 'J’ai capturé une proposition depuis votre échange.',
    time: '23:14',
    proposal: {
      title: 'Rendez-vous dentiste Léo',
      lines: ['Samedi · créneau à confirmer', 'Ajouter à l’agenda famille ?'],
      captureId: 'cap-dentiste',
    },
  },
  {
    id: 'm4',
    author: 'partner',
    authorLabel: 'Antoine',
    text: 'Toussaint, on fait quoi cette année ? Les parents de Léo partent en Corse…',
    time: '22:48',
  },
  {
    id: 'm5',
    author: 'alfred',
    authorLabel: 'Alfred',
    text: 'Rien de prévu dans l’agenda pour les vacances de la Toussaint.',
    time: '22:49',
    proposal: {
      title: 'Vacances Toussaint',
      lines: [
        'Agenda vide sur la période',
        'Pistes : Corse, Vendée, montagne proche',
      ],
      captureId: 'cap-toussaint',
    },
  },
  {
    id: 'm6',
    author: 'partner',
    authorLabel: 'Antoine',
    text: 'Pain demain matin stp 🥖',
    time: '07:01',
  },
  {
    id: 'm7',
    author: 'alfred',
    authorLabel: 'Alfred',
    text: 'Tâche courses proposée.',
    time: '07:02',
    proposal: {
      title: 'Pain demain matin',
      lines: ['Liste courses · assignation suggérée : Camille'],
      captureId: 'cap-pain',
    },
  },
];

export function filterCapturesByChip(
  captures: HouseholdCapture[],
  chip: CaptureChip,
): HouseholdCapture[] {
  if (chip === 'all') return captures;
  return captures.filter((c) => c.chip === chip);
}

export function pendingCaptureCount(captures: HouseholdCapture[]): number {
  return captures.filter((c) => c.status === 'pending').length;
}
