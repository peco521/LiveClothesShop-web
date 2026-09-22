import { AuthResponse } from '../../models/auth.models';
import { Ciudad, Listado, Sucursal } from '../models/organizacion.models';
export const ciudad: Ciudad = { id: 0, nombre: 'Ciudad' };
// CU09: la sucursal expone coordenadas verificadas (null si no se validó la dirección).
export const sucursal: Sucursal = { nro: 1, nombre: 'Central', direccion: 'Calle', idCiud: 0, estado: 'activo', ciudad,
  latitud: -17.783333, longitud: -63.182222 };
export const sucursalSinUbicacion: Sucursal = { ...sucursal, nro: 2, nombre: 'Antigua', latitud: null, longitud: null };
export const listado: Listado = { items: [sucursal], total: 21, offset: 0, limit: 20 };
export const session: AuthResponse = { usuario: { idUsuario: 'synthetic-cu09', nombres: 'Operador', correo: 'operator@example.com' },
  rol: { nro: 'organizacion', descripcion: 'Operador CU09' }, permisos: ['CU09'], expiraEn: '2030-01-01T00:00:00Z' };
