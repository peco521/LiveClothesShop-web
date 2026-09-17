import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { defer, EMPTY, Observable } from 'rxjs';
import { API_BASE_URL } from '../../../../core/config/api.config';
import { CompraDetalle, HistorialCompras } from '../models/historial.models';

export interface ClienteHistorial { idUsuario: string; ci: string; nombre: string; apellidoPat: string; apellidoMat: string; correo: string; }
export interface ClientesHistorial { items: ClienteHistorial[]; total: number; offset: number; limit: number; }
export interface FiltrosHistorial { ci: string; nombre: string; apellidos: string; correo: string; }
@Injectable({ providedIn: 'root' })
export class HistorialAdminService {
  private readonly http = inject(HttpClient);
  private readonly platform = inject(PLATFORM_ID);
  private readonly base = `${inject(API_BASE_URL).replace(/\/$/, '')}/admin/historial-compras/clientes`;
  private browser<T>(request: () => Observable<T>): Observable<T> { return defer(() => isPlatformBrowser(this.platform) ? request() : EMPTY); }
  clientes(filters: FiltrosHistorial, offset = 0): Observable<ClientesHistorial> {
    let params = new HttpParams().set('offset', offset).set('limit', 20);
    for (const key of ['ci', 'nombre', 'apellidos', 'correo'] as const) if (filters[key].trim()) params = params.set(key, filters[key].trim());
    return this.browser(() => this.http.get<ClientesHistorial>(this.base, { params }));
  }
  historial(id: string, offset = 0): Observable<HistorialCompras> {
    return this.browser(() => this.http.get<HistorialCompras>(`${this.base}/${encodeURIComponent(id)}`, { params: new HttpParams().set('offset', offset).set('limit', 20) }));
  }
  detalle(id: string, nro: number): Observable<CompraDetalle> {
    return this.browser(() => this.http.get<CompraDetalle>(`${this.base}/${encodeURIComponent(id)}/compras/${nro}`));
  }
}
