import { HttpErrorResponse } from '@angular/common/http';

export function accesoRechazado(error: unknown): boolean {
  return error instanceof HttpErrorResponse && [401, 403].includes(error.status);
}

export function rolError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    switch (error.status) {
      case 401: return 'Tu sesión ha expirado o no es válida. Inicia sesión nuevamente.';
      case 403: return 'No tienes autorización para esta operación o el origen no está permitido.';
      case 404: return 'No se encontró el rol solicitado.';
      case 409:
        if (error.error?.error?.code === 'ultimo_usuario_cu06') return 'Debe conservar al menos un usuario interno con permiso CU06. Asigna este acceso a otro usuario elegible antes de retirarlo.';
        if (error.error?.error?.code === 'rol_duplicado') return 'El identificador del rol ya existe. Utiliza otro identificador.';
        return 'Existe un conflicto de datos. Vuelve a consultar el rol antes de continuar.';
      case 422: return error.error?.error?.code === 'rol_cliente_sin_funciones'
        ? 'El rol cliente no puede recibir funciones. Solo se permite retirar permisos heredados.'
        : 'Revisa los campos y las funciones seleccionadas. No se permiten funciones duplicadas o inexistentes.';
      case 0: return 'No se pudo conectar con el servidor. Comprueba tu conexión.';
    }
  }
  return 'No se pudo completar la operación. Inténtalo nuevamente.';
}
