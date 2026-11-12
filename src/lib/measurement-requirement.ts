export function needsFieldMeasurement(piece: {measurement_not_required?: boolean}) {
  return !piece.measurement_not_required;
}
export function fieldMeasurementProblem(piece: {measurement_not_required?: boolean; project_only?: boolean; measured_width_mm?: number | null; measured_height_mm?: number | null}) {
  if (piece.measurement_not_required) return null;
  if (piece.project_only) return "Projeto pendente de definição. Defina se haverá medição individual ou se a peça será fabricada conforme projeto do conjunto.";
  if (!piece.measured_width_mm || !piece.measured_height_mm) return "Registre as medidas de campo ou classifique a peça como não necessitando medição em obra.";
  return null;
}
