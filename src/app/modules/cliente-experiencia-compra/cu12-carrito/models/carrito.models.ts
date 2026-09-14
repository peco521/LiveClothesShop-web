export interface ItemAgregar { idVar: string; cantidad: number }
export interface ItemCantidad { cantidad: number }

export interface ItemTalla { idTalla: number; descripcion: string }
export interface ItemColor { idColor: number; descripcion: string; hex: string }
export interface ItemPromocion { idPromo: number; nombre: string; tipoDescuento: string; valorDescuento: number | string }

export interface CarritoItem {
  idDetalleCarro: number;
  idVar: string;
  sku: string;
  imagen: string | null;
  producto: string;
  talla: ItemTalla;
  colores: ItemColor[];
  precio: number | string;
  promocion: ItemPromocion | null;
  cantidad: number;
  subtotal: number | string;
  disponible: boolean;
  cantidadDisponible: number;
}

export interface CarritoDetalle {
  idCarrito: number | null;
  items: CarritoItem[];
  cantidadItems: number;
  subtotal: number | string;
}
