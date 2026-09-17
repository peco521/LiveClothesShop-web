import { CompraDetalle, HistorialCompras } from '../models/historial.models';

export const compra: CompraDetalle = {
  nroVenta: 11, fechaHora: '2026-09-13T14:30:00', estado: 'registrada', estadoPago: 'aprobado',
  nit: '123', sucursal: { nro: 1, nombre: 'Central', ciudad: 'La Paz' },
  items: [{ idDetalleVenta: 1, idVar: 'v1', sku: 'SKU-1', producto: 'Camisa Oxford', cantidad: 2, precioUnitario: '100.00', subtotalBruto: '200.00' }],
  brutoTotal: '200.00', descAplicado: '20.00', total: '180.00',
  pago: { idPago: 9, metodo: 'QR', monto: '180.00', estado: 'aprobado', fechaHora: '2026-09-13T14:32:00' },
};
export const historial: HistorialCompras = {
  items: [{ nroVenta: 11, fechaHora: compra.fechaHora, estado: 'registrada', estadoPago: 'aprobado',
    monto: '180.00', productos: [{ idVar: 'v1', sku: 'SKU-1', producto: 'Camisa Oxford', cantidad: 2 }] }],
  total: 1, offset: 0, limit: 20,
};
