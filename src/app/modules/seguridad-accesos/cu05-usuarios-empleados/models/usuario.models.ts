export interface RolOpcion { nro: string; descripcion: string }
export interface CiudadOpcion { id: number; nombre: string }
export interface SucursalOpcion {
  nro: number; nombre: string; direccion: string; estado: 'activo' | 'inactivo';
  idCiud: number; ciudad: CiudadOpcion;
}
export interface EmpleadoDatos {
  ci: string; nombres: string; apellidoPat: string; apellidoMat: string; sexo: 'M' | 'F';
  correo: string; telefono: string; direccion: string; fechaNac: string;
  nroRol: string; cod_emp: string; cargo: string; nroSuc: number;
}
export interface EmpleadoCrear extends EmpleadoDatos { contrasena: string }
export type EmpleadoEditar = Partial<EmpleadoDatos>;
export type EmpleadoFormulario = EmpleadoDatos & { contrasena?: string };
export interface UsuarioDetalle {
  idUsuario: string; ci: string; nombres: string | null; apellidoPat: string; apellidoMat: string;
  sexo: 'M' | 'F'; correo: string; telefono: string; direccion: string; fechaNac: string;
  tipo: 'A' | 'E'; activo: boolean; nroRol: string; rol: RolOpcion;
  empleado: { cod_emp: string; cargo: string; nroSuc: number } | null;
  admin: { cod_adm: string } | null;
}
export interface UsuariosListado { items: UsuarioDetalle[]; total: number; offset: number; limit: number }
export interface UsuariosFiltros { offset: number; limit: number; q?: string; tipo?: 'A' | 'E'; activo?: boolean }
export interface EmpleadoOpciones { roles: RolOpcion[]; ciudades: CiudadOpcion[]; sucursales: SucursalOpcion[] }
