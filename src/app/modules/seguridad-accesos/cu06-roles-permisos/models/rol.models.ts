export interface RolCrear { nro: string; descripcion: string; }
export interface RolDetalle extends RolCrear { esRolCliente: boolean; }
export interface RolesListado { items: RolDetalle[]; total: number; offset: number; limit: number; }
export interface FuncionDetalle { id: string; descripcion: string | null; }
export interface PermisosDetalle { nroRol: string; esRolCliente: boolean; permisos: string[]; }

export function mismosPermisos(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && new Set(a).size === a.length && a.every(id => b.includes(id));
}

// The API permits the PK "nuevo". A matrix parameter disambiguates its detail
// from the static creation route without forbidding/renaming an existing key.
export function rolDetalleRuta(nro: string): (string | { detalle: string })[] {
  return nro === 'nuevo' ? ['/admin/roles', nro, { detalle: '1' }] : ['/admin/roles', nro];
}
