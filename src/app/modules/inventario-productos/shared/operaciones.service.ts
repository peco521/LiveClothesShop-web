import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { defer, EMPTY, Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api.config';

type QueryValues = Record<string, string | number | undefined>;

/**
 * Cliente HTTP de los módulos administrativos CU21-CU25.
 * Mantiene las mismas rutas que consumía la antigua página de operaciones de sucursal.
 */
@Injectable({ providedIn: 'root' })
export class OperacionesService {
  private readonly http = inject(HttpClient);
  private readonly platform = inject(PLATFORM_ID);
  private readonly base = `${inject(API_BASE_URL).replace(/\/$/, '')}/admin`;

  private browser<T>(run: () => Observable<T>): Observable<T> {
    return defer(() => (isPlatformBrowser(this.platform) ? run() : EMPTY));
  }

  private params(values: QueryValues): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== '') params = params.set(key, value);
    return params;
  }

  get<T>(path: string, values: QueryValues = {}) {
    return this.browser(() => this.http.get<T>(`${this.base}/${path}`, { params: this.params(values) }));
  }

  send<T>(path: string, body: unknown = {}, method: 'POST' | 'PUT' = 'POST') {
    return this.browser(() => this.http.request<T>(method, `${this.base}/${path}`, { body }));
  }

  export(values: QueryValues) {
    return this.browser(() => this.http.get(`${this.base}/reportes/exportar`, { params: this.params(values), responseType: 'blob' as const }));
  }
}
