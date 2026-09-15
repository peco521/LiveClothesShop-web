export interface FacetaItem { id: number; nombre: string }
export interface FacetasListado { items: FacetaItem[]; total: number }

export interface CategoriaResumen { idCat: number; descripcion: string }
export interface MarcaResumen { idMarca: number; nombre: string }
export interface ColeccionResumen { idCol: number; descripcion: string }
export interface PromocionResumen { idPromo: number; nombre: string; tipoDescuento: string; valorDescuento: number | string }

export interface ProductoResumen {
  idProd: string;
  descripcion: string;
  categoria: CategoriaResumen;
  marca: MarcaResumen;
  coleccion: ColeccionResumen;
  promocion: PromocionResumen | null;
  precioMin: number | string | null;
  precioMax: number | string | null;
  imagen: string | null;
  disponible: boolean;
  totalVariantes: number;
}

export interface ProductosListado { items: ProductoResumen[]; total: number; offset: number; limit: number }

export interface TallaDetalle { idTalla: number; descripcion: string }
export interface ColorDetalle { idColor: number; descripcion: string; hex: string }

export interface VarianteDetalle {
  idVariante: string;
  sku: string;
  precio: number | string;
  imagen: string | null;
  talla: TallaDetalle;
  colores: ColorDetalle[];
}

export interface DisponibilidadSucursal {
  nroSuc: number;
  sucursal: string;
  ciudad: string;
  idVariante: string;
  stock: number;
  cantDisp: number;
}

export interface ProductoDetalle {
  idProd: string;
  descripcion: string;
  estado: string;
  categoria: CategoriaResumen;
  marca: MarcaResumen;
  coleccion: ColeccionResumen;
  promocion: PromocionResumen | null;
  variantes: VarianteDetalle[];
  disponibilidad: DisponibilidadSucursal[];
}

export type CatalogoSort = 'nombre_asc' | 'nombre_desc' | 'precio_asc' | 'precio_desc';

export interface CatalogoFiltros {
  offset: number;
  limit: number;
  q?: string;
  idCat?: number;
  idMarca?: number;
  idCol?: number;
  idTemp?: number;
  idTalla?: number;
  idColor?: number;
  minPrecio?: number;
  maxPrecio?: number;
  soloDisponibles?: boolean;
  sort?: CatalogoSort;
}
