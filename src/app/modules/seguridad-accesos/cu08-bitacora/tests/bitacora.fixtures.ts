import { AuthResponse } from '../../models/auth.models';
import { BitacoraDetalle, BitacoraListado } from '../models/bitacora.models';
export const registro: BitacoraDetalle = { id: '9007199254740993', usuario_id: null, accion: 'rol_creado',
  fecha: '2026-09-12T12:30:45.123456Z', ip: '2001:db8::1', detalles: { resultado: 'exito' } };
export const listado: BitacoraListado = { items: [{ id: registro.id, usuario_id: null, accion: registro.accion, fecha: registro.fecha, ip: registro.ip }], total: 21, offset: 0, limit: 20 };
export const session: AuthResponse = { usuario: { idUsuario: 'operador', nombres: 'Prueba', correo: 'test@example.com' },
  rol: { nro: 'auditor', descripcion: 'Auditor' }, permisos: ['CU08'], expiraEn: '2099-01-01T00:00:00Z' };
