import { PagoDetalle } from '../models/pago.models';

export const pago: PagoDetalle = { idPago: 3, metodo: 'tarjeta', monto: 180, estado: 'aprobado',
  fechaHora: '2026-09-13T10:05:00', referencia: 'MOCK-000003-11', nroVenta: 11, estadoVenta: 'registrada' };
export const pendiente: PagoDetalle = { ...pago, estado: 'pendiente', referencia: null };
export const rechazado: PagoDetalle = { ...pago, estado: 'rechazado', referencia: null, estadoVenta: 'anulada' };
