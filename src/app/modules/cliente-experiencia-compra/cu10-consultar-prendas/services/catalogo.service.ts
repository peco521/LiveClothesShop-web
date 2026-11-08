import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { catchError, defer, EMPTY, firstValueFrom, from, map, mergeMap, Observable, of, throwError } from 'rxjs';
import { API_BASE_URL } from '../../../../core/config/api.config';
import { CatalogoFiltros, FacetasListado, ProductoDetalle, ProductosListado } from '../models/catalogo.models';
import { CatalogoDescargado, CatalogoOfflineError, CatalogoOfflineRepository } from './catalogo-offline.repository';

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
  private readonly offline = inject(CatalogoOfflineRepository);
  private browser<T>(request: () => Observable<T>, select: (data: CatalogoDescargado) => T): Observable<T> {
    return defer(() => {
      if (!isPlatformBrowser(this.platform)) return EMPTY;
      const owner = this.offline.owner();
      const fallback = () => from(this.offline.fallback(owner, select));
      if (!navigator.onLine) return fallback();
      return request().pipe(
        mergeMap(value => {
          if (owner !== this.offline.owner()) return EMPTY;
          this.offline.online(owner);
          return of(value);
        }),
        catchError((error: unknown) => {
          if (owner !== this.offline.owner()) return EMPTY;
          return error instanceof HttpErrorResponse && error.status === 0 ? fallback() : throwError(() => error);
        }),
      );
    });
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
    return this.browser(() => this.http.get<ProductosListado>(`${this.base}/productos`, { params }), data => this.offline.list(data, filters)).pipe(
      map(value => ({ items: value.items, total: value.total, offset: value.offset, limit: value.limit })),
    );
  }
  detalle(id: string): Observable<ProductoDetalle> {
    return this.browser(() => this.http.get<ProductoDetalle>(`${this.base}/productos/${encodeURIComponent(id)}`), data => this.find(data, id, false)).pipe(map(resumen));
  }
  detalleVariante(id: string): Observable<ProductoDetalle> {
    return this.browser(() => this.http.get<ProductoDetalle>(`${this.base}/variantes/${encodeURIComponent(id)}`), data => this.find(data, id, true)).pipe(map(resumen));
  }
  faceta(grupo: 'categorias' | 'marcas' | 'colecciones' | 'temporadas' | 'tallas' | 'colores', idCat?: number): Observable<FacetasListado> {
    const params = idCat === undefined ? new HttpParams() : new HttpParams().set('idCat', idCat);
    return this.browser(() => this.http.get<FacetasListado>(`${this.base}/${grupo}`, { params }), data => this.offline.facets(data, grupo, idCat)).pipe(
      map(value => ({ items: value.items.map(item => ({ id: item.id, nombre: item.nombre })), total: value.total })),
    );
  }

  private find(data: CatalogoDescargado, id: string, variant: boolean): ProductoDetalle {
    const product = data.productos.find(item => variant ? item.variantes.some(row => row.idVariante === id) : item.idProd === id);
    if (!product) throw new CatalogoOfflineError('Esta prenda no está en el subconjunto descargado. Conéctate para consultarla.');
    return product;
  }

  /** Explicit opt-in only. Replace one bounded page atomically, never save mere browsing. */
  async descargar(ids: string[]): Promise<void> {
    const owner = this.offline.owner();
    const unique = [...new Set(ids)];
    if (!this.offline.current(owner) || !unique.length || unique.length > 100 || !navigator.onLine) {
      throw new CatalogoOfflineError('Necesitas conexión y una sesión de empresa para descargar entre 1 y 100 prendas.');
    }
    const products: ProductoDetalle[] = [];
    // Sequential requests bound memory/network pressure. An incomplete download never replaces the old snapshot.
    for (const id of unique) {
      if (!this.offline.current(owner)) throw new CatalogoOfflineError('La sesión cambió. Descarga de nuevo el catálogo.');
      const product = await firstValueFrom(this.http.get<ProductoDetalle>(`${this.base}/productos/${encodeURIComponent(id)}`).pipe(map(resumen)));
      if (!this.offline.current(owner)) throw new CatalogoOfflineError('La sesión cambió. Descarga de nuevo el catálogo.');
      products.push(product);
    }
    await this.offline.save(products, owner);
  }
}
