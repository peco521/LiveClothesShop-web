export type EstadoVenta = 'registrada' | 'anulada';
export type EstadoPago = 'pendiente' | 'aprobado' | 'rechazado';
export type Importe = string | number;

export interface ProductoCompra {
  idVar: string;
  sku: string;
  producto: string;
  cantidad: number;
}
export interface CompraResumen {
  nroVenta: number;
  fechaHora: string;
  productos: ProductoCompra[];
  monto: Importe;
  estado: EstadoVenta;
  estadoPago?: EstadoPago | null;
}
export interface HistorialCompras {
  items: CompraResumen[];
  total: number;
  offset: number;
  limit: number;
  mensaje?: string | null;
}
export interface CompraItem extends ProductoCompra {
  idDetalleVenta: number;
  precioUnitario: Importe;
  subtotalBruto: Importe;
}
export interface CompraDetalle {
  nroVenta: number;
  fechaHora: string;
  estado: EstadoVenta;
  estadoPago?: EstadoPago | null;
  nit?: string | null;
  sucursal: { nro: number; nombre: string; ciudad: string };
  idCarrito?: number | null;
  nroReserva?: number | null;
  items: CompraItem[];
  brutoTotal: Importe;
  descAplicado: Importe;
  total: Importe;
  pago?: {
    idPago: number;
    metodo: string;
    monto: Importe;
    estado: EstadoPago;
    fechaHora: string;
    referencia?: string | null;
  } | null;
}
