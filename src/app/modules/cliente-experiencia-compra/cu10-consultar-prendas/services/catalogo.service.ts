import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { defer, EMPTY, map, Observable } from 'rxjs';
import { API_BASE_URL } from '../../../../core/config/api.config';
import { CatalogoFiltros, FacetasListado, ProductoDetalle, ProductosListado } from '../models/catalogo.models';

function resumen(value: ProductoDetalle): ProductoDetalle {
  // Explicit allowlist: nunca conservar campos inesperados del catálogo.
  return {
    idProd: value.idProd, descripcion: value.descripcion, estado: value.estado,
    categoria: { idCat: value.categoria.idCat, descripcion: value.categoria.descripcion },
    marca: { idMarca: value.marca.idMarca, nombre: value.marca.nombre },
    coleccion: { idCol: value.coleccion.idCol, descripcion: value.coleccion.descripcion },
    promocion: value.promocion ? { idPromo: value.promocion.idPromo, nombre: value.promocion.nombre,
      tipoDescuento: value.promocion.tipoDescuento, valorDescuento: value.promocion.valorDescuento } : null,
    variantes: (value.variantes ?? []).map(variant => ({
      idVariante: variant.idVariante, sku: variant.sku, precio: variant.precio, imagen: variant.imagen,
      talla: { idTalla: variant.talla.idTalla, descripcion: variant.talla.descripcion },
      colores: (variant.colores ?? []).map(color => ({ idColor: color.idColor, descripcion: color.descripcion, hex: color.hex })),
    })),
    disponibilidad: (value.disponibilidad ?? []).map(row => ({
      nroSuc: row.nroSuc, sucursal: row.sucursal, ciudad: row.ciudad,
      idVariante: row.idVariante, stock: row.stock, cantDisp: row.cantDisp,
    })),
  };
}

@Injectable({ providedIn: 'root' })
export class CatalogoService {
  private readonly http = inject(HttpClient);
  private readonly platform = inject(PLATFORM_ID);
  private readonly base = `${inject(API_BASE_URL).replace(/\/$/, '')}/catalogo`;
  private browser<T>(request: () => Observable<T>): Observable<T> {
    return defer(() => isPlatformBrowser(this.platform) ? request() : EMPTY);
  }
  listar(filters: CatalogoFiltros): Observable<ProductosListado> {
    let params = new HttpParams().set('offset', filters.offset).set('limit', filters.limit);
    if (filters.q?.trim()) params = params.set('q', filters.q.trim());
    for (const key of ['idCat', 'idMarca', 'idCol', 'idTemp', 'idTalla', 'idColor'] as const) {
      if (filters[key] !== undefined) params = params.set(key, filters[key]);
    }
    if (filters.minPrecio !== undefined) params = params.set('minPrecio', filters.minPrecio);
    if (filters.maxPrecio !== undefined) params = params.set('maxPrecio', filters.maxPrecio);
    if (filters.soloDisponibles) params = params.set('soloDisponibles', true);
    if (filters.sort) params = params.set('sort', filters.sort);
    return this.browser(() => this.http.get<ProductosListado>(`${this.base}/productos`, { params })).pipe(
      map(value => ({ items: value.items, total: value.total, offset: value.offset, limit: value.limit })),
    );
  }
  detalle(id: string): Observable<ProductoDetalle> {
    return this.browser(() => this.http.get<ProductoDetalle>(`${this.base}/productos/${encodeURIComponent(id)}`)).pipe(map(resumen));
  }
  detalleVariante(id: string): Observable<ProductoDetalle> {
    return this.browser(() => this.http.get<ProductoDetalle>(`${this.base}/variantes/${encodeURIComponent(id)}`)).pipe(map(resumen));
  }
  faceta(grupo: 'categorias' | 'marcas' | 'colecciones' | 'temporadas' | 'tallas' | 'colores', idCat?: number): Observable<FacetasListado> {
    const params = idCat === undefined ? new HttpParams() : new HttpParams().set('idCat', idCat);
    return this.browser(() => this.http.get<FacetasListado>(`${this.base}/${grupo}`, { params })).pipe(
      map(value => ({ items: value.items.map(item => ({ id: item.id, nombre: item.nombre })), total: value.total })),
    );
  }
}
