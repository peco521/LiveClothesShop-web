import { AuthResponse } from '../../../seguridad-accesos/models/auth.models';
import { ProductoDetalle, ProductosListado } from '../models/catalogo.models';

export const clienteSession: AuthResponse = { usuario: { idUsuario: 'cliente-1', nombres: 'Ana', correo: 'ana@example.com' },
  rol: { nro: 'cliente', descripcion: 'Cliente' }, permisos: [], expiraEn: '2030-01-01T00:00:00Z' };
export const adminSession: AuthResponse = { usuario: { idUsuario: 'admin-1', nombres: 'Admin', correo: 'admin@example.com' },
  rol: { nro: 'superadmin', descripcion: 'SuperAdmin' }, permisos: ['CU05'], expiraEn: '2030-01-01T00:00:00Z' };

export const list: ProductosListado = { total: 2, offset: 0, limit: 20, items: [
  { idProd: 'prod-001', descripcion: 'Camisa Oxford',
    categoria: { idCat: 1, descripcion: 'Camisas' }, marca: { idMarca: 1, nombre: 'Andes' },
    coleccion: { idCol: 1, descripcion: 'Otoño' },
    promocion: { idPromo: 1, nombre: 'Promo', tipoDescuento: 'porcentaje', valorDescuento: 10 },
    precioMin: 100, precioMax: 150, imagen: 'http://img/1.jpg', disponible: true, totalVariantes: 2 },
  { idProd: 'prod-002', descripcion: 'Pantalón Chino',
    categoria: { idCat: 2, descripcion: 'Pantalones' }, marca: { idMarca: 1, nombre: 'Andes' },
    coleccion: { idCol: 1, descripcion: 'Otoño' }, promocion: null,
    precioMin: 200, precioMax: 200, imagen: null, disponible: false, totalVariantes: 1 } ] };

export const detail: ProductoDetalle = { idProd: 'prod-001', descripcion: 'Camisa Oxford', estado: 'activo',
  categoria: { idCat: 1, descripcion: 'Camisas' }, marca: { idMarca: 1, nombre: 'Andes' },
  coleccion: { idCol: 1, descripcion: 'Otoño' },
  promocion: { idPromo: 1, nombre: 'Promo', tipoDescuento: 'porcentaje', valorDescuento: 10 },
  variantes: [
    { idVariante: 'var-001', sku: 'SKU-001', precio: 100, imagen: 'http://img/1.jpg',
      talla: { idTalla: 1, descripcion: 'M' }, colores: [{ idColor: 1, descripcion: 'Rojo', hex: '#FF0000' }] },
    { idVariante: 'var-002', sku: 'SKU-002', precio: 150, imagen: null,
      talla: { idTalla: 2, descripcion: 'L' }, colores: [{ idColor: 2, descripcion: 'Azul', hex: '#0000FF' }] } ],
  disponibilidad: [
    { nroSuc: 1, sucursal: 'Central', ciudad: 'La Paz', idVariante: 'var-001', stock: 10, cantDisp: 4 },
    { nroSuc: 1, sucursal: 'Central', ciudad: 'La Paz', idVariante: 'var-002', stock: 5, cantDisp: 0 } ] };

export const facetas = { items: [{ id: 1, nombre: 'Camisas' }, { id: 2, nombre: 'Pantalones' }], total: 2 };
