import { correctionFieldLabel, decisionLabel, estadoLabel } from '@/lib/review/labels';

export function auditActionLabel(action: string) {
  const labels: Record<string, string> = {
    review_decision_created: 'Decisión registrada',
  };

  return labels[action] || action;
}

export function auditEntityLabel(entityType: string) {
  const labels: Record<string, string> = {
    review_case: 'Caso de revisión',
  };

  return labels[entityType] || entityType;
}

export function formatAuditDetails(details: Record<string, unknown> | null | undefined) {
  if (!details) return [] as Array<{ label: string; value: string }>;

  const rows: Array<{ label: string; value: string }> = [];

  if (typeof details.decisionType === 'string') {
    rows.push({ label: 'Decisión', value: decisionLabel(details.decisionType) });
  }

  if (typeof details.nextStatus === 'string') {
    rows.push({ label: 'Nuevo estado', value: estadoLabel(details.nextStatus) });
  }

  if (typeof details.notes === 'string' && details.notes.trim()) {
    rows.push({ label: 'Notas', value: details.notes });
  }

  const correctionChanges = details.correctionChanges;
  if (Array.isArray(correctionChanges)) {
    for (const change of correctionChanges) {
      if (!change || typeof change !== 'object' || Array.isArray(change)) continue;
      const field = 'field' in change ? change.field : null;
      const before = 'before' in change ? change.before : null;
      const after = 'after' in change ? change.after : null;
      if (typeof field !== 'string') continue;
      rows.push({
        label: correctionFieldLabel(field),
        value: `${before == null || before === '' ? '-' : String(before)} -> ${after == null || after === '' ? '-' : String(after)}`,
      });
    }
    return rows;
  }

  const correctionJson = details.correctionJson;
  if (correctionJson && typeof correctionJson === 'object' && !Array.isArray(correctionJson)) {
    for (const [key, value] of Object.entries(correctionJson)) {
      rows.push({
        label: correctionFieldLabel(key),
        value: value == null ? '-' : String(value),
      });
    }
  }

  return rows;
}
