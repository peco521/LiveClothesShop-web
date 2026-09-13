import { ClienteDetalle } from '../models/cliente.models';
import { AuthResponse } from '../../models/auth.models';

export const customer: ClienteDetalle = { idUsuario: 'cliente-1', ci: '123', nombres: 'Ana', apellidoPat: 'Pérez', apellidoMat: 'Gómez',
  sexo: 'F', correo: 'cliente@example.com', telefono: '70000000', direccion: 'Calle ficticia', fechaNac: '2000-01-01',
  tipo: 'C', activo: true, nroRol: 'publico-custom', rol: { nro: 'publico-custom', descripcion: 'Cliente' },
  cliente: { cod_cl: 'CL001', estado: 'inactivo' } };
export const session: AuthResponse = { usuario: { idUsuario: 'gestor', nombres: 'Gestor', correo: 'gestor@example.com' },
  rol: { nro: 'gestor', descripcion: 'Gestor' }, permisos: ['CU07'], expiraEn: '2030-01-01T00:00:00Z' };
export const list = { items: [customer], total: 21, offset: 0, limit: 20 };
