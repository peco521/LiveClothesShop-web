export interface ClienteDetalle {
  idUsuario: string;
  ci: string;
  nombres: string | null;
  apellidoPat: string;
  apellidoMat: string;
  sexo: 'M' | 'F';
  correo: string;
  telefono: string;
  direccion: string;
  fechaNac: string;
  tipo: 'C';
  nroRol: string;
  rol: { nro: string; descripcion: string };
  cliente: { cod_cl: string; estado: 'frecuente' | 'casual' | 'inactivo' };
}

export interface ClienteEditar {
  ci?: string;
  nombres?: string;
  apellidoPat?: string;
  apellidoMat?: string;
  sexo?: 'M' | 'F';
  correo?: string;
  telefono?: string;
  direccion?: string;
  fechaNac?: string;
}

// CU07 alta administrativa: mismos datos que el registro público de CU01.
export interface ClienteCrear {
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

export interface ClientesFiltros { offset: number; limit: number; q?: string }
export interface ClientesListado { items: ClienteDetalle[]; total: number; offset: number; limit: number }
