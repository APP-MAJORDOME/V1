/** Suggestions contextuelles pour l’onglet Alfred (Sprint 3). */

export type AlfredSuggestionContext = {
  openTasksCount?: number;
  eventsTodayCount?: number;
  fridgeAlertsCount?: number;
  mentalHeavy?: boolean;
};

export function getAlfredSuggestions(
  firstName: string,
  partenaire: string,
  ctx: AlfredSuggestionContext = {},
): string[] {
  const h = new Date().getHours();
  const name = firstName || 'toi';
  const p = partenaire || 'mon partenaire';
  const open = ctx.openTasksCount ?? 0;
  const events = ctx.eventsTodayCount ?? 0;
  const fridge = ctx.fridgeAlertsCount ?? 0;
  const heavy = ctx.mentalHeavy ?? false;

  const contextual: string[] = [];
  if (heavy || open >= 5) {
    contextual.push('Je suis débordée, trie ma liste');
  }
  if (open === 1) {
    contextual.push('Quelle est ma priorité aujourd’hui ?');
  } else if (open > 1 && open < 5) {
    contextual.push(`Quelles sont mes ${open} priorités aujourd’hui ?`);
  }
  if (events > 0) {
    contextual.push(events === 1 ? 'Résume mon RDV du jour' : `Résume mes ${events} événements du jour`);
  }
  if (fridge > 0) {
    contextual.push(fridge === 1 ? 'Un produit frigo expire bientôt — que faire ?' : `${fridge} alertes frigo — que cuisiner ?`);
  }
  if (open === 0 && events === 0) {
    contextual.push('Propose un menu pas cher pour la semaine');
  }

  let base: string[];
  if (h >= 6 && h < 11) {
    base = [
      `Qu’est-ce que j’oublie ce matin ?`,
      `Ajoute du lait à ma liste de courses`,
      `Quels sont mes RDV aujourd’hui ?`,
      `Prépare un message pour ${p}`,
    ];
  } else if (h >= 11 && h < 17) {
    base = [
      `Qu’est-ce qu’on mange ce soir ?`,
      `Ouvre le drive carrefour avec ma liste`,
      `Éteins la lumière du salon`,
      `Crée une tâche : rappeler l’école`,
    ];
  } else if (h >= 17 && h < 22) {
    base = [
      `Résumé de ma journée, ${name}`,
      `Quelles tâches restent pour demain ?`,
      `Ajoute des ingrédients pour ce soir`,
      `Prépare un message pour ${p}`,
    ];
  } else {
    base = [
      `Briefing de demain`,
      `Ajoute une tâche pour demain matin`,
      `Vérifie mon agenda`,
    ];
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of [...contextual, ...base]) {
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= 5) break;
  }
  return out;
}

export type AlfredAction = { id: string; label: string };

/** Actions rapides sous une réponse Alfred. */
export function inferAlfredActions(aiText: string, executionDone: boolean): AlfredAction[] {
  const actions: AlfredAction[] = [];
  const low = aiText.toLowerCase();

  if (low.includes('liste') || low.includes('courses') || low.includes('article')) {
    actions.push({ id: 'courses', label: 'Voir Courses' });
  }
  if (low.includes('tâche') || low.includes('tache') || executionDone) {
    actions.push({ id: 'tasks', label: 'Voir les tâches' });
  }
  if (low.includes('agenda') || low.includes('événement') || low.includes('evenement') || low.includes('rdv')) {
    actions.push({ id: 'agenda', label: 'Ouvrir Agenda' });
  }
  if (low.includes('délégu') || low.includes('delegu') || low.includes('partenaire')) {
    actions.push({ id: 'famille', label: 'Famille & équité' });
  }
  if (low.includes('drive') || low.includes('carrefour') || low.includes('courses')) {
    actions.push({ id: 'courses', label: 'Voir Courses' });
  }
  if (
    low.includes('domot') ||
    low.includes('lumière') ||
    low.includes('lumiere') ||
    low.includes('verisure') ||
    low.includes('ezviz') ||
    low.includes('caméra') ||
    low.includes('camera')
  ) {
    actions.push({ id: 'integrations', label: 'Intégrations' });
  }
  return actions.slice(0, 3);
}
