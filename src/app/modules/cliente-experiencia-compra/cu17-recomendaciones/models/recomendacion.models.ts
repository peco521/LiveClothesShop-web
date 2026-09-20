import { ProductoResumen } from '../../cu10-consultar-prendas/models/catalogo.models';

// CU17 reutiliza la tarjeta del catálogo (CU10) y solo añade explicabilidad.
// `categoria` es el MODELO/ESTILO de polera, nunca una prenda de otro tipo.
export interface RecomendacionItem extends ProductoResumen {
  score: number;
  razones: string[];
}

export type TipoRecomendacion = 'personalizada' | 'general';

export interface RecomendacionesRespuesta {
  tipo: TipoRecomendacion;
  mensaje: string;
  total: number;
  items: RecomendacionItem[];
}
