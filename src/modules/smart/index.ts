/**
 * API pública del módulo `smart` (Iteración Nº 4).
 *
 * Solo se expone lo seguro para componentes de navegador:
 *   - Componentes: panel inteligente y configuración de correo.
 *   - Servicio de lectura: clasificación, resúmenes y alertas.
 *   - Tipos compartidos.
 *
 * Los servicios elevados (`adminData`, `emailService`, `alertEngine`) se
 * importan directamente desde las rutas API para no exponerlos al navegador.
 */

export { EmailSettingsPanel } from "./components/EmailSettingsPanel";
export { ParentSmartAlerts } from "./components/ParentSmartAlerts";
export { SmartSummaryPanel } from "./components/SmartSummaryPanel";
export { StudentSmartAlerts } from "./components/StudentSmartAlerts";
export { loadChildAlerts, loadSmartOverview, loadStudentAlerts } from "./services/smartService";
export * from "./types";
