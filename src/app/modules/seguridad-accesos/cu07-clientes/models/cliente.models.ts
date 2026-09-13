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
  activo: boolean;
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

export interface ClientesFiltros { offset: number; limit: number; q?: string; activo?: boolean }
export interface ClientesListado { items: ClienteDetalle[]; total: number; offset: number; limit: number }
