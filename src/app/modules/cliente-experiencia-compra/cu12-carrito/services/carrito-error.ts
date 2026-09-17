import { HttpErrorResponse } from '@angular/common/http';

export function carritoError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 401) return 'Tu sesión ha expirado o no es válida. Inicia sesión nuevamente.';
    if (error.status === 403) return 'No tienes autorización para gestionar el carrito o el origen no está permitido.';
    if (error.status === 404) {
      const code = error.error?.error?.code;
      if (code === 'variante_no_encontrada') return 'La variante seleccionada ya no está disponible.';
      if (code === 'producto_no_encontrado') return 'La prenda seleccionada ya no está disponible.';
      return 'El producto ya no está en tu carrito.';
    }
    if (error.status === 409) {
      if (error.error?.error?.code === 'compra_pendiente') return 'Cancela la compra pendiente antes de editar el carrito.';
      if (error.error?.error?.code === 'disponibilidad_insuficiente') return 'No hay disponibilidad suficiente para esa cantidad.';
      return 'Existe un conflicto de datos. Vuelve a consultar tu carrito antes de continuar.';
    }
    if (error.status === 422) return 'La cantidad debe ser un entero mayor a cero.';
    if (error.status === 0) return 'No se pudo conectar con el servidor. Comprueba tu conexión.';
  }
  // Do not render arbitrary backend messages or exception diagnostics.
  return 'No se pudo completar la operación. Inténtalo nuevamente.';
}
