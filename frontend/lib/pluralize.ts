/** Pluralisation française simple (P0-7). */

export function pluralFr(count: number, singular: string, plural: string): string {
  return Math.abs(count) === 1 ? singular : plural;
}

export function formatCountFr(count: number, singular: string, plural: string): string {
  return `${count} ${pluralFr(count, singular, plural)}`;
}

export function formatTasksOpen(count: number): string {
  return formatCountFr(count, 'tâche ouverte', 'tâches ouvertes');
}

export function formatTasksDone(count: number): string {
  return formatCountFr(count, 'tâche terminée', 'tâches terminées');
}

export function formatThingsToFix(count: number): string {
  return formatCountFr(count, 'chose à régler ce matin', 'choses à régler ce matin');
}

export function formatUrgencies(count: number): string {
  return formatCountFr(count, 'urgence', 'urgences');
}

export function formatConflicts(count: number): string {
  return formatCountFr(count, 'conflit détecté', 'conflits détectés');
}

export function formatNotes(count: number): string {
  return formatCountFr(count, 'note', 'notes');
}

export function formatReferences(count: number): string {
  return formatCountFr(count, 'référence', 'références');
}

export function greetingFr(hour = new Date().getHours()): 'Bonjour' | 'Bonsoir' {
  return hour >= 18 || hour < 5 ? 'Bonsoir' : 'Bonjour';
}
