import { VentaDetalle } from '../models/compra.models';

export const venta: VentaDetalle = { nroVenta: 11, fechaHora: '2026-09-13T10:00:00', estado: 'registrada',
  nit: null, sucursal: { nro: 1, nombre: 'Central', ciudad: 'La Paz' }, carrito: 5,
  items: [{ idDetalleVenta: 1, idVar: 'var-001', sku: 'SKU-001', producto: 'Camisa Oxford',
    cantidad: 2, precioUnitario: 100, subtotalBruto: 200 }],
  brutoTotal: 200, descAplicado: 20, total: 180 };
export const carritoResumen = { idCarrito: 5, items: [
  { idDetalleCarro: 1, idVar: 'var-001', sku: 'SKU-001', imagen: null, producto: 'Camisa Oxford',
    talla: { idTalla: 1, descripcion: 'M' }, colores: [], precio: 100, promocion: null,
    cantidad: 2, subtotal: 200, disponible: true, cantidadDisponible: 4 } ],
  cantidadItems: 2, subtotal: 200 };
export const sucursales = [{ nro: 1, nombre: 'Central', direccion: 'Dir 1', ciudad: 'La Paz' }];
