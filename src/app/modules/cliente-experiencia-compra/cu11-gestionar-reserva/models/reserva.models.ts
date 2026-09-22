export type EstadoReserva = 'pendiente' | 'confirmada' | 'atendida' | 'cancelada' | 'vencida';

export interface ReservaItemCrear { idVar: string; cantidad: number }
export interface ReservaCrear { nroSuc: number; fechaReserva: string; horaAtencion: string; items: ReservaItemCrear[] }

export interface ReservaItemDetalle { idDetalleRes: number; idVar: string; sku: string; producto: string; cantidad: number; imagen?: string | null; talla?: string | null; categoria?: string | null; colores?: string[] }
export interface ReservaSucursal { nro: number; nombre: string; ciudad: string }

export interface ReservaDetalle {
  nroReserva: number;
  fechaReserva: string;
  horaAtencion: string;
  estado: EstadoReserva;
  sucursal: ReservaSucursal;
  items: ReservaItemDetalle[];
  totalUnidades: number;
  vencida: boolean;
}

export interface ReservasListado { items: ReservaDetalle[]; total: number; offset: number; limit: number }
export interface ReservasFiltros { offset: number; limit: number; estado?: EstadoReserva }

export interface SucursalCliente { nro: number; nombre: string; direccion: string; ciudad: string }
export interface HorarioRango { horaIni: string; horaFin: string; dias?: number[] }
export interface HorariosSucursal { nroSuc: number; rangos: HorarioRango[] }
