import { AuthResponse } from '../../models/auth.models';
import { Ciudad, Listado, Sucursal } from '../models/organizacion.models';
export const ciudad: Ciudad = { id: 0, nombre: 'Ciudad' };
export const sucursal: Sucursal = { nro: 1, nombre: 'Central', direccion: 'Calle', idCiud: 0, estado: 'activo', ciudad };
export const listado: Listado = { items: [sucursal], total: 21, offset: 0, limit: 20 };
export const session: AuthResponse = { usuario: { idUsuario: 'synthetic-cu09', nombres: 'Operador', correo: 'operator@example.com' },
  rol: { nro: 'organizacion', descripcion: 'Operador CU09' }, permisos: ['CU09'], expiraEn: '2030-01-01T00:00:00Z' };
