export interface Option { id: number; nombre: string; idTemps?: number[] }
export interface Page<T> { items: T[]; total: number; offset: number; limit: number }
export interface ReferenceRow { id: number; descripcion?: string; nombre?: string; estado?: string; hex?: string;
  fechaIni?: string; fechaFin?: string; correo?: string; direccion?: string; telefono?: string; idTemps?: number[] }
export type Group = 'tallas' | 'colores' | 'colecciones' | 'temporadas' | 'categorias' | 'marcas' | 'proveedores';
export interface Variant { idVariante?: string | null; sku: string; precio: number | string; estado: 'activo' | 'inactivo'; img: string | null; idTalla: number; idColores: number[] }
export interface ProductData { descripcion: string; estado: 'activo' | 'inactivo'; idCat: number; idMarca: number; idCol: number; idProv: number; idPromo: number | null; variantes: Variant[] }
export interface Product extends ProductData { idProd: string }
export interface ProductSummary { idProd: string; descripcion: string; estado: string; categoria: string; marca: string; coleccion: string; proveedor: string; totalVariantes: number }
export interface Inventory { nroInv: number; nroSuc: number; sucursal: string; idVariante: string; sku: string; descripcion: string;
  categoria: string; talla: string; colores: string[]; stock: number; cantDisp: number; reservado: number }
export interface Movement { idMov: number; tipoMov: string; cantidad: number; fecha: string; motivo: string; nroInv: number }
export interface MovementData { nroSuc: number; idVariante: string; tipoMov: 'entrada' | 'salida' | 'ajuste'; cantidad: number; motivo: string; ajusteDireccion?: 'aumentar' | 'disminuir' }
export interface MovementResult { nroInv: number; stock: number; cantDisp: number; mensaje: string }
export interface InventoryReferences { sucursales: Option[]; variantes: { id: string; nombre: string }[];
  categorias: Option[]; tallas: Option[]; colores: Option[]; sucursalAsignada: number | null }
export interface Filters { q?: string; estado?: string; offset?: number; limit?: number; nroSuc?: number; idCat?: number; idTalla?: number; idColor?: number }
