import { HttpErrorResponse } from '@angular/common/http';

export function recomendacionesError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 401) return 'Tu sesión ha expirado o no es válida. Inicia sesión nuevamente.';
    if (error.status === 403) return 'No tienes autorización para consultar recomendaciones.';
    if (error.status === 422) return 'Los datos de la consulta no son válidos.';
    if (error.status === 0) return 'No se pudo conectar con el servidor. Comprueba tu conexión.';
  }
  // No se muestran mensajes arbitrarios del backend ni diagnósticos de excepción.
  return 'No pudimos obtener tus recomendaciones. Inténtalo nuevamente.';
}
