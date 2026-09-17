import { HttpErrorResponse } from '@angular/common/http';

export function historialError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 401) return 'Tu sesión ha expirado o no es válida. Inicia sesión nuevamente.';
    if (error.status === 403) return 'No tienes autorización para consultar este historial.';
    if (error.status === 404) return 'No se encontró la compra solicitada.';
    if (error.status === 422) return 'Los datos de la consulta no son válidos.';
    if (error.status === 0) return 'No fue posible obtener el historial de compras. Comprueba tu conexión e inténtalo nuevamente.';
  }
  return 'No fue posible obtener el historial de compras. Inténtalo nuevamente.';
}
