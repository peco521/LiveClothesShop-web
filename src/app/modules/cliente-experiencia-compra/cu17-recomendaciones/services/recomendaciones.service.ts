import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { defer, EMPTY, map, Observable } from 'rxjs';
import { API_BASE_URL } from '../../../../core/config/api.config';
import { ProductoResumen } from '../../cu10-consultar-prendas/models/catalogo.models';
import { RecomendacionItem, RecomendacionesRespuesta } from '../models/recomendacion.models';

// Límites reales del backend (CU17): entre 1 y 20 recomendaciones por consulta.
export const RECOMENDACIONES_LIMITE_DEFECTO = 8;
export const RECOMENDACIONES_LIMITE_MAXIMO = 20;

function tarjeta(value: RecomendacionItem): RecomendacionItem {
  // Allowlist explícita: solo el contrato de CU10 + score y razones.
  const producto: ProductoResumen = {
    idProd: value.idProd, descripcion: value.descripcion,
    categoria: { idCat: value.categoria.idCat, descripcion: value.categoria.descripcion },
    marca: { idMarca: value.marca.idMarca, nombre: value.marca.nombre },
    coleccion: { idCol: value.coleccion.idCol, descripcion: value.coleccion.descripcion },
    promocion: value.promocion ? {
      idPromo: value.promocion.idPromo, nombre: value.promocion.nombre,
      tipoDescuento: value.promocion.tipoDescuento, valorDescuento: value.promocion.valorDescuento,
    } : null,
    precioMin: value.precioMin, precioMax: value.precioMax, imagen: value.imagen,
    disponible: value.disponible, totalVariantes: value.totalVariantes,
  };
  return { ...producto, score: value.score, razones: [...(value.razones ?? [])] };
}

@Injectable({ providedIn: 'root' })
export class RecomendacionesService {
  private readonly http = inject(HttpClient);
  private readonly platform = inject(PLATFORM_ID);
  private readonly base = `${inject(API_BASE_URL).replace(/\/$/, '')}/cliente/recomendaciones`;

  private browser<T>(request: () => Observable<T>): Observable<T> {
    return defer(() => isPlatformBrowser(this.platform) ? request() : EMPTY);
  }

  listar(limit = RECOMENDACIONES_LIMITE_DEFECTO): Observable<RecomendacionesRespuesta> {
    // El cliente se determina por sesión en el backend: aquí no se envía ningún id.
    const params = new HttpParams().set('limit', limit);
    return this.browser(() => this.http.get<RecomendacionesRespuesta>(this.base, { params })).pipe(
      map(value => ({
        tipo: value.tipo, mensaje: value.mensaje, total: value.total,
        items: (value.items ?? []).map(tarjeta),
      })),
    );
  }
}
