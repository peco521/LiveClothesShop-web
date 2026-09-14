import { HttpErrorResponse } from '@angular/common/http';

export function reservaError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 401) return 'Tu sesión ha expirado o no es válida. Inicia sesión nuevamente.';
    if (error.status === 403) return 'No tienes autorización para gestionar reservas o el origen no está permitido.';
    if (error.status === 404) {
      const code = error.error?.error?.code;
      if (code === 'sucursal_no_encontrada') return 'La sucursal seleccionada no existe o no está disponible.';
      if (code === 'variante_no_encontrada') return 'Una de las variantes ya no está disponible.';
      if (code === 'producto_no_encontrado') return 'Una de las prendas ya no está disponible.';
      return 'No se encontró la reserva solicitada.';
    }
    if (error.status === 409) {
      const code = error.error?.error?.code;
      if (code === 'disponibilidad_insuficiente') return 'No hay disponibilidad suficiente para una de las prendas.';
      if (code === 'sucursal_inactiva') return 'La sucursal seleccionada no está disponible.';
      if (code === 'reserva_no_cancelable') return 'La reserva ya no puede cancelarse.';
      return 'Existe un conflicto de datos. Vuelve a consultar antes de continuar.';
    }
    if (error.status === 422) {
      const code = error.error?.error?.code;
      if (code === 'horario_fuera_atencion') return 'El horario solicitado está fuera de la atención de la sucursal.';
      return 'Revisa los datos de la reserva. La fecha, el horario o las cantidades no son válidos.';
    }
    if (error.status === 0) return 'No se pudo conectar con el servidor. Comprueba tu conexión.';
  }
  // Do not render arbitrary backend messages or exception diagnostics.
  return 'No se pudo completar la operación. Inténtalo nuevamente.';
}
