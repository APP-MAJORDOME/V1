export type AgentInterpretResponse = {
  intent: string;
  mode: string;
  explanation: string;
  proposal?: Record<string, unknown>;
};

/** Convertit un appel d'outil Realtime en réponse interpret pour executeAgentIntent. */
export function realtimeToolToInterpret(
  name: string,
  args: Record<string, unknown>
): AgentInterpretResponse | null {
  const title = typeof args.title === 'string' ? args.title.trim() : '';
  if (name === 'create_task' && title) {
    return { intent: 'task_create', mode: 'auto', proposal: { title }, explanation: '' };
  }
  if (name === 'complete_task') {
    const taskTitle = typeof args.task_title === 'string' ? args.task_title.trim() : '';
    if (taskTitle) {
      return { intent: 'task_complete', mode: 'auto', proposal: { task_title: taskTitle }, explanation: '' };
    }
  }
  if (name === 'assign_task') {
    const taskTitle = typeof args.task_title === 'string' ? args.task_title.trim() : '';
    const assignee = typeof args.assignee === 'string' ? args.assignee.trim() : '';
    if (taskTitle && assignee) {
      return {
        intent: 'task_assign',
        mode: 'auto',
        proposal: { task_title: taskTitle, assignee },
        explanation: '',
      };
    }
  }
  if (name === 'create_event' && title) {
    const proposal: Record<string, unknown> = { title };
    for (const k of ['starts_at', 'ends_at'] as const) {
      const v = typeof args[k] === 'string' ? args[k].trim() : '';
      if (v) proposal[k] = v;
    }
    return { intent: 'event_create', mode: 'auto', proposal, explanation: '' };
  }
  if (name === 'add_grocery_item') {
    const label = typeof args.label === 'string' ? args.label.trim() : '';
    if (label) {
      return { intent: 'grocery_add', mode: 'auto', proposal: { label, title: label }, explanation: '' };
    }
  }
  if (name === 'remember_note') {
    const note = typeof args.note === 'string' ? args.note.trim() : '';
    if (note) {
      return { intent: 'memory_store', mode: 'auto', proposal: { note }, explanation: '' };
    }
  }
  return null;
}
