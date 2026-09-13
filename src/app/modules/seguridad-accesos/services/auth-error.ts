import { HttpErrorResponse } from '@angular/common/http';

export function authError(error: unknown, action: 'registro' | 'login' | 'sesion'): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 409 && action === 'registro') return 'Este correo ya está registrado. Puedes iniciar sesión.';
    if (error.status === 401 && action === 'login') return 'No pudimos iniciar sesión. Revisa tu correo y contraseña.';
    if (error.status === 422) return 'Revisa los datos del formulario e inténtalo de nuevo.';
    if (error.status === 403) return 'La solicitud no está permitida. Revisa la configuración de acceso del sitio.';
    if (error.status === 0) return 'No podemos conectar con la tienda. Comprueba tu conexión e inténtalo de nuevo.';
  }
  return action === 'sesion'
    ? 'No pudimos verificar tu sesión. Inténtalo de nuevo.'
    : 'El servicio no está disponible en este momento. Inténtalo de nuevo más tarde.';
}
