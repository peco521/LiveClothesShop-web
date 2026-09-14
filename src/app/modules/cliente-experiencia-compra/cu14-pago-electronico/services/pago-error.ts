import { HttpErrorResponse } from '@angular/common/http';

export function pagoError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 401) return 'Tu sesión ha expirado o no es válida. Inicia sesión nuevamente.';
    if (error.status === 403) return 'No tienes autorización para realizar el pago o el origen no está permitido.';
    if (error.status === 404) {
      const code = error.error?.error?.code;
      if (code === 'venta_no_encontrada') return 'La venta a pagar no existe o ya no está disponible.';
      return 'No se encontró el pago solicitado.';
    }
    if (error.status === 409) {
      const code = error.error?.error?.code;
      if (code === 'disponibilidad_insuficiente') return 'Ya no hay disponibilidad suficiente en la sucursal para completar el pago.';
      if (code === 'venta_no_pagable') return 'La venta ya no puede pagarse.';
      if (code === 'carrito_no_disponible') return 'El carrito de esta venta ya no está activo.';
      return 'Existe un conflicto. Vuelve a consultar el estado del pago antes de continuar.';
    }
    if (error.status === 422) return 'El método de pago o los datos enviados no son válidos.';
    if (error.status === 0) return 'No se pudo conectar con el servidor. Comprueba tu conexión.';
  }
  // Do not render arbitrary backend messages or exception diagnostics.
  return 'No se pudo completar la operación. Inténtalo nuevamente.';
}
