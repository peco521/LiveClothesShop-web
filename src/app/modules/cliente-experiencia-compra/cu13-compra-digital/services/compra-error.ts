import { HttpErrorResponse } from '@angular/common/http';

export function compraError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 401) return 'Tu sesión ha expirado o no es válida. Inicia sesión nuevamente.';
    if (error.status === 403) return 'No tienes autorización para realizar la compra o el origen no está permitido.';
    if (error.status === 404) {
      const code = error.error?.error?.code;
      if (code === 'sucursal_no_encontrada') return 'La sucursal seleccionada no existe o no está disponible.';
      if (code === 'variante_no_encontrada') return 'Una de las variantes ya no está disponible.';
      if (code === 'producto_no_encontrado') return 'Una de las prendas ya no está disponible.';
      return 'No se encontró la venta solicitada.';
    }
    if (error.status === 409) {
      const code = error.error?.error?.code;
      if (code === 'disponibilidad_insuficiente') return 'No hay disponibilidad suficiente en la sucursal elegida para una de las prendas.';
      if (code === 'compra_pendiente' || code === 'carrito_modificado') return 'Continúa o cancela tu compra pendiente antes de cambiar el carrito o sus datos.';
      if (code === 'venta_no_cancelable') return 'La compra ya fue pagada. Consulta su estado.';
      if (code === 'sucursal_inactiva') return 'La sucursal seleccionada no está disponible.';
      if (code === 'carrito_no_disponible') return 'No tienes un carrito activo para comprar.';
      return 'Existe un conflicto de datos. Vuelve a consultar tu carrito antes de continuar.';
    }
    if (error.status === 422) return 'Revisa los datos de la compra. La sucursal o el NIT no son válidos.';
    if (error.status === 0) return 'No se pudo conectar con el servidor. Comprueba tu conexión.';
  }
  // Do not render arbitrary backend messages or exception diagnostics.
  return 'No se pudo completar la operación. Inténtalo nuevamente.';
}
