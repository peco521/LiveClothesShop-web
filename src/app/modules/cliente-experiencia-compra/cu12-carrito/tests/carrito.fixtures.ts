import { CarritoDetalle } from '../models/carrito.models';

export const item1 = { idDetalleCarro: 1, idVar: 'var-001', sku: 'SKU-001', imagen: 'http://img/1.jpg',
  producto: 'Camisa Oxford', talla: { idTalla: 1, descripcion: 'M' },
  colores: [{ idColor: 1, descripcion: 'Rojo', hex: '#FF0000' }],
  precio: 100, promocion: { idPromo: 1, nombre: 'Promo', tipoDescuento: 'porcentaje', valorDescuento: 10 },
  cantidad: 2, subtotal: 200, disponible: true, cantidadDisponible: 4 };
export const item2 = { idDetalleCarro: 2, idVar: 'var-002', sku: 'SKU-002', imagen: null,
  producto: 'Camisa Oxford', talla: { idTalla: 2, descripcion: 'L' }, colores: [],
  precio: 150, promocion: null, cantidad: 1, subtotal: 150, disponible: true, cantidadDisponible: 1 };

export const carrito: CarritoDetalle = { idCarrito: 5, items: [item1, item2], cantidadItems: 3, subtotal: 350 };
export const vacio: CarritoDetalle = { idCarrito: null, items: [], cantidadItems: 0, subtotal: 0 };
