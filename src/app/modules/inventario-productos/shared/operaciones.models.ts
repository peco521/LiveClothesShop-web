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

/** Pago de una venta de caja (CU14/CU24). `checkoutUrl` lo decide el backend (Stripe). */
export interface Pago {
  idPago: number; metodo: string; monto: number | string; estado: 'pendiente' | 'aprobado' | 'rechazado';
  nroVenta: number; estadoVenta: string; checkoutUrl?: string | null;
}

/** Descuento que el backend identifica para la venta: tipo, valor y monto aplicado. */
export interface SaleDiscount {
  nombre: string; tipoDescuento: 'porcentaje' | 'montoFijo'; valorDescuento?: number | string | null; monto: number | string;
}

export interface Sale {
  nroVenta: number; fechaHora: string; estado: string; idCliente?: string; total: number | string; descAplicado: number | string;
  brutoTotal?: number | string; nit?: string | null; cambio?: number | string;
  /** Nombre del cliente; `null` cuando la venta es anónima (Consumidor final). */
  cliente?: string | null;
  /** Nombre y primer apellido de quien atendió la venta; `null` si no se registró. */
  empleado?: string | null;
  descuentos?: SaleDiscount[];
  sucursal: { nombre: string; ciudad: string };
  items: { idDetalleVenta: number; idVar: string; sku?: string; producto: string; cantidad: number;
    precioUnitario: number | string; subtotalBruto?: number | string }[];
  pagos?: { estado: string; metodo: string }[];
}

export interface Return {
  nroDev: number; nroVenta: number; estado: string; motivo: string; monto: number | string;
  items: { producto: string; cantidad: number }[]; reembolso: { estado: string; metodo: string; monto: number | string } | null;
}

/** Fila de la matriz del reporte de ventas (una sucursal o el TOTAL GENERAL). */
export interface ReportRow {
  sucursal: string; valores: (number | string)[]; ventas: number; poleras: number;
  importe: number | string; ticket: number | string;
}

/** Matriz del reporte de ventas: columnas por día o mes más los indicadores finales. */
export interface ReportMatrix {
  granularidad: 'dia' | 'mes'; periodos: { clave: string; etiqueta: string }[];
  filas: ReportRow[]; total: ReportRow;
}

/** Devolución agrupada: indica qué poleras se devolvieron (panel de reportes). */
export interface ReturnRow {
  nroDev: number; nroVenta: number; fecha: string; hora: string; sucursal: string; cliente: string;
  poleras: string; cantidad: number; motivo: string; estado: string; reembolso: string;
  monto: number | string; importeLinea: number | string;
}

/**
 * Dashboard y reporte gerencial de CU25. `categoria` es el modelo/estilo de polera
 * (filtro "Modelo de polera") y `reporte` es la misma matriz que exportan el PDF y el Excel.
 */
export interface Report {
  ventas: number; ingresos: number | string; poleras: number; ticketPromedio: number | string;
  sucursales: { nombre: string; ventas: number; total: number | string; poleras: number; ticket: number | string }[];
  productos: { nombre: string; unidades: number }[]; inventario: { stock: number; disponible: number; reservado: number; agotados: number };
  reservas: number; conversionReservas: number; carritos: number; conversionCarritos: number; devoluciones: number;
  filtros: { sucursal: string; modelo: string; temporada: string }; reporte: ReportMatrix;
  devolucionesDetalle: ReturnRow[]; nota: string;
}

/** Detalle de reserva para el panel de sucursal: incluye el cliente para continuar el cobro en CU24. */
/**
 * Detalle de reserva para el panel de sucursal: incluye el cliente para continuar el cobro
 * en CU24 y, si la caja ya preparó la venta de esa reserva sin cobrarla, su número para
 * retomarla en lugar de bloquear el cobro (``nroVentaEnCurso``).
 */
export type Reservation = ReservaDetalle & { idCliente?: string; nroVentaEnCurso?: number | null };
export type ReturnMovement = 'efectivo' | 'tarjeta' | 'QR' | 'transferencia';
