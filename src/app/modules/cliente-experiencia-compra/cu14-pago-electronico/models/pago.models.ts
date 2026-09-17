export type MetodoPago = 'tarjeta' | 'QR' | 'transferencia';
export type EscenarioMock = 'aprobado' | 'rechazado' | 'timeout';
export type EstadoPago = 'pendiente' | 'aprobado' | 'rechazado';

export interface PagoCrear { nroVenta: number; metodo: MetodoPago; escenario?: EscenarioMock }

export interface PagoDetalle {
  idPago: number;
  metodo: string;
  monto: number | string;
  estado: EstadoPago;
  fechaHora: string;
  referencia: string | null;
  nroVenta: number;
  estadoVenta: string;
  checkoutUrl?: string | null;
}
