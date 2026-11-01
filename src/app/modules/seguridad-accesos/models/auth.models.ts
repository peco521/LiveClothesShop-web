export interface RegistroRequest {
  ci: string;
  nombres: string;
  apellidoPat: string;
  apellidoMat: string;
  sexo: 'M' | 'F';
  correo: string;
  telefono: string;
  direccion: string;
  fechaNac: string;
  contrasena: string;
}

export interface RegistroResponse {
  idUsuario: string;
  correo: string;
  mensaje: string;
  // CU01: el registro público devuelve la sesión ya iniciada (mismo contrato que el login).
  sesion?: AuthResponse;
}

export interface LoginRequest {
  empresa?: string;
  correo: string;
  contrasena: string;
}

export interface AuthResponse {
  empresa?: string | null;
  plataforma?: boolean;
  usuario: { idUsuario: string; tipo?: 'A' | 'C' | 'E' | 'S'; nombres: string | null; correo: string };
  rol: { nro: string; descripcion: string };
  permisos: string[];
  expiraEn: string;
  /** Marca local sin credenciales; permite reabrir solo la caja offline. */
  offlineOnly?: boolean;
}
