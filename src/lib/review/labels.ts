export function etapaLabel(bucket: string) {
  const labels: Record<string, string> = {
    pending_review: 'Pendiente de revisión',
    revision_oc: 'Revisión de OC',
    error_real: 'Error contable',
    rejected_sii: 'Rechazo SII',
    approved_auto: 'Aprobado automático',
  };

  return labels[bucket] || bucket;
}

export function estadoLabel(status: string) {
  const labels: Record<string, string> = {
    new: 'Nuevo',
    in_review: 'En revisión',
    resolved: 'Resuelto',
    exception: 'Excepción',
    rejected_for_learning: 'Descartado',
  };

  return labels[status] || status;
}

export function decisionLabel(decisionType: string) {
  const labels: Record<string, string> = {
    approve: 'Aprobar',
    correct_and_approve: 'Corregir y aprobar',
    exception: 'Marcar excepción',
    reject_for_learning: 'Descartar',
  };

  return labels[decisionType] || decisionType;
}

export function fieldLabel(field: string) {
  const labels: Record<string, string> = {
    entity: 'Proveedor NetSuite',
    referenciaAccount: 'Cuenta referencial',
    terminosNs: 'Términos de pago',
    accountCorrecta: 'Cuenta correcta sugerida',
    ocPolicyCorrecta: 'Política de OC',
    categoriaOc: 'Política de OC',
    learningCategory: 'Categoría de aprendizaje',
    matchConfianza: 'Confianza del match',
    requiereRevisionManual: 'Requiere revisión manual',
    comentariosGonzalo: 'Comentarios Gonzalo',
  };

  return labels[field] || field;
}
