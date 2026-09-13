import { HttpErrorResponse } from '@angular/common/http';

export function accesoRechazado(error: unknown): boolean {
  return error instanceof HttpErrorResponse && [401, 403].includes(error.status);
}

export function usuarioError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    switch (error.status) {
      case 401: return 'Tu sesión ha expirado o no es válida. Inicia sesión nuevamente.';
      case 403: return 'No tienes autorización para esta operación o el origen de la solicitud no está permitido.';
      case 404: return 'No se encontró el usuario interno o empleado solicitado.';
      case 409:
        if (error.error?.error?.code === 'ultimo_usuario_cu06') return 'Debe conservar al menos un usuario activo con permiso CU06. No puedes desactivar o cambiar el rol del último usuario con ese acceso.';
        return error.error?.error?.code === 'correo_duplicado'
        ? 'El correo ya está registrado. Utiliza otro correo.'
        : 'Existe un conflicto de datos o un perfil incoherente. Revisa el registro antes de continuar.';
      case 422: return 'Revisa los campos, el rol y la sucursal seleccionados. Los datos no son válidos.';
      case 0: return 'No se pudo conectar con el servidor. Comprueba tu conexión.';
    }
  }
  // Never render arbitrary server messages, request payloads or exception details.
  return 'No se pudo completar la operación. Inténtalo nuevamente.';
}
