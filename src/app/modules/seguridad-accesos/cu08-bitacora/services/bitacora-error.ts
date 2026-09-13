import { HttpErrorResponse } from '@angular/common/http';

export function bitacoraError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    switch (error.status) {
      case 401: return 'Tu sesión ha expirado o no es válida. Inicia sesión nuevamente.';
      case 403: return 'No tienes autorización para consultar la bitácora.';
      case 404: return 'No se encontró el registro de bitácora solicitado.';
      case 422: return 'Revisa el identificador y los filtros: fechas con zona y rango válido, y límites permitidos.';
      case 0: return 'No se pudo conectar con el servidor. Comprueba tu conexión.';
    }
  }
  return 'No se pudo consultar la bitácora. Inténtalo nuevamente.';
}
