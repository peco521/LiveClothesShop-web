export interface CompraCrear { nroSuc: number; nit?: string }

export interface VentaItem {
  idDetalleVenta: number;
  idVar: string;
  sku: string;
  producto: string;
  cantidad: number;
  precioUnitario: number | string;
  subtotalBruto: number | string;
}

export interface VentaSucursal { nro: number; nombre: string; ciudad: string }

export interface VentaDetalle {
  nroVenta: number;
  fechaHora: string;
  estado: 'registrada' | 'anulada';
  nit: string | null;
  sucursal: VentaSucursal;
  carrito: number;
  items: VentaItem[];
  brutoTotal: number | string;
  descAplicado: number | string;
  total: number | string;
}
