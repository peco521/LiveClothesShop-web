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
}

export interface LoginRequest {
  correo: string;
  contrasena: string;
}

export interface AuthResponse {
  usuario: { idUsuario: string; tipo?: 'A' | 'C' | 'E'; nombres: string | null; correo: string };
  rol: { nro: string; descripcion: string };
  permisos: string[];
  expiraEn: string;
}
