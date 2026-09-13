import { HttpErrorResponse } from '@angular/common/http';

export function clienteNoDisponible(error: unknown): boolean {
  return error instanceof HttpErrorResponse && ([401, 403, 404].includes(error.status)
    || (error.status === 409 && error.error?.error?.code === 'perfil_incoherente'));
}

export function clienteError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    switch (error.status) {
      case 401: return 'Tu sesión ha expirado o no es válida. Inicia sesión nuevamente.';
      case 403: return 'No tienes autorización para esta operación o el origen no está permitido.';
      case 404: return 'No se encontró el cliente solicitado.';
      case 409:
        if (error.error?.error?.code === 'correo_duplicado') return 'El correo ya está registrado. Utiliza otro correo.';
        if (error.error?.error?.code === 'perfil_incoherente') return 'Existe un perfil o rol de cliente incoherente. No se puede gestionar este registro; no se han reparado sus datos automáticamente.';
        return 'Existe un conflicto de datos. Vuelve a consultar el cliente antes de continuar.';
      case 422: return 'Revisa los campos enviados. Los datos no son válidos.';
      case 0: return 'No se pudo conectar con el servidor. Comprueba tu conexión.';
    }
  }
  // Do not render arbitrary backend messages or exception diagnostics.
  return 'No se pudo completar la operación. Inténtalo nuevamente.';
}
