import { HttpErrorResponse } from '@angular/common/http';

export function catalogoError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    switch (error.status) {
      case 401: return 'Tu sesión ha expirado o no es válida. Inicia sesión nuevamente.';
      case 403: return 'No tienes autorización para consultar el catálogo o el origen no está permitido.';
      case 404: return 'No se encontró la prenda solicitada.';
      case 422: return 'Revisa los filtros aplicados. Los datos no son válidos.';
      case 0: return 'No se pudo conectar con el servidor. Comprueba tu conexión.';
    }
  }
  // Do not render arbitrary backend messages or exception diagnostics.
  return 'No se pudo completar la operación. Inténtalo nuevamente.';
}
