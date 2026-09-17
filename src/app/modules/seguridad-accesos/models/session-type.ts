import { AuthResponse } from './auth.models';

export function isClienteSession(session: AuthResponse): boolean {
  // Older API responses did not include tipo; real responses now use Usuario.tipo.
  return session.usuario.tipo !== undefined ? session.usuario.tipo === 'C'
    : ['C', 'cliente'].includes(session.rol.nro);
}

export function isInternalSession(session: AuthResponse): boolean {
  return session.usuario.tipo !== undefined
    ? session.usuario.tipo === 'A' || session.usuario.tipo === 'E'
    : !isClienteSession(session);
}
