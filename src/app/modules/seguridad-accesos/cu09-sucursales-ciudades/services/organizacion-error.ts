import { HttpErrorResponse } from '@angular/common/http';

export function organizacionError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    switch (error.status) {
      case 401: return 'La sesión expiró. Inicia sesión nuevamente.';
      case 403: return 'No tienes permiso CU09 para esta operación.';
      case 404: return 'La ciudad o sucursal no existe.';
      case 409: return 'Los datos entran en conflicto con un registro existente. Comprueba el identificador de ciudad.';
      case 422: return 'Revisa los campos y comprueba que la ciudad indicada existe.';
    }
  }
  return 'No se pudo completar la operación. Intenta nuevamente.';
}
