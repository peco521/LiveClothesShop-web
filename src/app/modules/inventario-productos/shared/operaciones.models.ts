import { ReservaDetalle } from '../../cliente-experiencia-compra/cu11-gestionar-reserva/models/reserva.models';

// Modelos de CU21-CU25 (promociones, reservas de sucursal, devoluciones, venta en caja y reportes).
export type PromotionEstado = 'programada' | 'activa' | 'finalizada' | 'cancelada';

export interface Refs {
  sucursalAsignada: number | null;
  sucursales: { nro: number; nombre: string; ciudad: string }[];
  categorias: { id: number; nombre: string }[];
  temporadas: { id: number; nombre: string }[];
}

export interface Promotion {
  idPromo: number; nombre: string; descripcion: string; tipoDescuento: 'porcentaje' | 'montoFijo';
  valorDescuento: number | string; fechaIni: string; fechaFin: string; estado: PromotionEstado; productos: string[];
}

export interface PromotionForm {
  nombre: string; descripcion: string; tipoDescuento: 'porcentaje' | 'montoFijo';
  valorDescuento: number; fechaIni: string; fechaFin: string;
}

export type PromotionData = PromotionForm & { productos: string[] };

export interface Policy { id: number; idProd: string; idVar: string | null; dias: number; porcentaje: number | string; producto?: string; opcion?: string }

export interface PolicyData { idProd: string; idVar: string | null; dias: number; porcentaje: number }

export interface Customer { idUsuario: string; nombre: string; correo: string; ci: string }

export interface Sale {
  nroVenta: number; fechaHora: string; estado: string; idCliente?: string; total: number | string; descAplicado: number | string;
  cambio?: number | string; sucursal: { nombre: string; ciudad: string };
  items: { idDetalleVenta: number; idVar: string; producto: string; cantidad: number; precioUnitario: number | string }[];
  pagos?: { estado: string; metodo: string }[];
}

export interface Return {
  nroDev: number; nroVenta: number; estado: string; motivo: string; monto: number | string;
  items: { producto: string; cantidad: number }[]; reembolso: { estado: string; metodo: string; monto: number | string } | null;
}

export interface Report {
  ventas: number; ingresos: number | string; sucursales: { nombre: string; ventas: number; total: number | string }[];
  productos: { nombre: string; unidades: number }[]; inventario: { stock: number; disponible: number; reservado: number; agotados: number };
  reservas: number; conversionReservas: number; carritos: number; conversionCarritos: number; devoluciones: number; nota: string;
}

/** Detalle de reserva para el panel de sucursal: incluye el cliente para continuar el cobro en CU24. */
export type Reservation = ReservaDetalle & { idCliente?: string };
export type ReturnMovement = 'efectivo' | 'tarjeta' | 'QR' | 'transferencia';
