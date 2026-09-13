export type Entidad = 'ciudades' | 'sucursales';
export type Estado = 'activo' | 'inactivo';
export interface Ciudad { id: number; nombre: string; }
export interface Sucursal { nro: number; nombre: string; direccion: string; estado: Estado; idCiud: number; ciudad: Ciudad; }
export type Detalle = Ciudad | Sucursal;
export interface Listado { items: Detalle[]; total: number; offset: number; limit: number; }
export interface Filtros { offset: number; limit: number; q: string; idCiud?: number; estado?: Estado; }
export interface CiudadCrear { id: number; nombre: string; }
export interface SucursalCrear { nombre: string; direccion: string; estado: Estado; idCiud: number; }
export type Cambios = Partial<SucursalCrear>;
export type Alta = CiudadCrear | SucursalCrear;
export function esSucursal(value: Detalle): value is Sucursal { return 'nro' in value; }
export function identificador(value: Detalle): number { return esSucursal(value) ? value.nro : value.id; }
export function entero(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}
