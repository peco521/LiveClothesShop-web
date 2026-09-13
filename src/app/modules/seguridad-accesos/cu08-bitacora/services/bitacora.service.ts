import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { defer, EMPTY, map, Observable, throwError } from 'rxjs';
import { API_BASE_URL } from '../../../../core/config/api.config';
import { BitacoraDetalle, BitacoraFiltros, BitacoraListado, esId } from '../models/bitacora.models';
import { detalleDTO, listadoDTO } from './bitacora-dto';

@Injectable({ providedIn: 'root' })
export class BitacoraService {
  private readonly http = inject(HttpClient);
  private readonly platform = inject(PLATFORM_ID);
  private readonly base = `${inject(API_BASE_URL).replace(/\/$/, '')}/admin/bitacora`;
  private browser<T>(request: () => Observable<T>): Observable<T> {
    return defer(() => isPlatformBrowser(this.platform) ? request() : EMPTY);
  }
  listar(filters: BitacoraFiltros): Observable<BitacoraListado> {
    let params = new HttpParams().set('offset', filters.offset).set('limit', filters.limit);
    for (const key of ['accion', 'usuario_id', 'desde', 'hasta'] as const) {
      if (filters[key] !== undefined && filters[key] !== '') params = params.set(key, filters[key]);
    }
    return this.browser(() => this.http.get<unknown>(this.base, { params })).pipe(map(listadoDTO));
  }
  detalle(id: string): Observable<BitacoraDetalle> {
    return this.browser(() => esId(id)
      ? this.http.get<unknown>(`${this.base}/${id}`).pipe(map(detalleDTO))
      : throwError(() => new HttpErrorResponse({ status: 422 })));
  }
}
