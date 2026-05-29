/** Titres de tâches de test à masquer / clôturer automatiquement. */
export function isTestTaskTitle(title: string): boolean {
  const t = title.trim().toLowerCase();
  return t === 'hello' || t === 'test' || t === 'test task';
}

export function filterOutTestTasks<T extends { title: string }>(tasks: T[]): T[] {
  return tasks.filter((t) => !isTestTaskTitle(t.title));
}
