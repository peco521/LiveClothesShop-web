import { ReservaDetalle, ReservasListado, SucursalCliente } from '../models/reserva.models';

export const reserva: ReservaDetalle = { nroReserva: 7, fechaReserva: '2026-09-20', horaAtencion: '10:00:00',
  estado: 'pendiente', sucursal: { nro: 1, nombre: 'Central', ciudad: 'La Paz' },
  items: [{ idDetalleRes: 1, idVar: 'var-001', sku: 'SKU-001', producto: 'Camisa Oxford', cantidad: 2 }],
  totalUnidades: 2, vencida: false };
export const list: ReservasListado = { items: [reserva], total: 3, offset: 0, limit: 20 };
export const sucursales: SucursalCliente[] = [
  { nro: 1, nombre: 'Central', direccion: 'Dir 1', ciudad: 'La Paz' },
  { nro: 3, nombre: 'Sin Horario', direccion: 'Dir 3', ciudad: 'La Paz' }];
export const horarios = { nroSuc: 1, rangos: [{ horaIni: '08:00:00', horaFin: '18:00:00' }] };
