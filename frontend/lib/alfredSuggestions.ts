/** Suggestions contextuelles pour l’onglet Alfred (Sprint 3). */

export function getAlfredSuggestions(firstName: string, partenaire: string): string[] {
  const h = new Date().getHours();
  const name = firstName || 'toi';
  const p = partenaire || 'mon partenaire';

  if (h >= 6 && h < 11) {
    return [
      `Qu’est-ce que j’oublie ce matin ?`,
      `Ajoute du lait à ma liste de courses`,
      `Quels sont mes RDV aujourd’hui ?`,
      `Prépare un message pour ${p}`,
    ];
  }
  if (h >= 11 && h < 17) {
    return [
      `Qu’est-ce qu’on mange ce soir ?`,
      `Crée une tâche : rappeler l’école`,
      `Assigne une tâche à ${p}`,
      `Je suis débordée, trie ma liste`,
    ];
  }
  if (h >= 17 && h < 22) {
    return [
      `Résumé de ma journée, ${name}`,
      `Quelles tâches restent pour demain ?`,
      `Ajoute des ingrédients pour ce soir`,
      `Message WhatsApp pour ${p}`,
    ];
  }
  return [
    `Briefing de demain`,
    `Ajoute une tâche pour demain matin`,
    `Vérifie mon agenda`,
  ];
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
  return actions.slice(0, 3);
}
