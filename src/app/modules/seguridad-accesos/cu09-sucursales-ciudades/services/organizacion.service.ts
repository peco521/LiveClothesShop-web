import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { defer, EMPTY, map, Observable } from 'rxjs';
import { API_BASE_URL } from '../../../../core/config/api.config';
import { Alta, Cambios, Ciudad, Detalle, Entidad, Filtros, Listado, Sucursal } from '../models/organizacion.models';

function detalle(kind: Entidad, value: Detalle): Detalle {
  if (kind === 'ciudades') { const city = value as Ciudad; return { id: city.id, nombre: city.nombre }; }
  const branch = value as Sucursal;
  return { nro: branch.nro, nombre: branch.nombre, direccion: branch.direccion, estado: branch.estado,
    idCiud: branch.idCiud, ciudad: { id: branch.ciudad.id, nombre: branch.ciudad.nombre } };
}

@Injectable({ providedIn: 'root' })
export class OrganizacionService {
  private readonly http = inject(HttpClient);
  private readonly platform = inject(PLATFORM_ID);
  private readonly base = `${inject(API_BASE_URL).replace(/\/$/, '')}/admin`;
  private browser<T>(request: () => Observable<T>): Observable<T> {
    return defer(() => isPlatformBrowser(this.platform) ? request() : EMPTY);
  }
  listar(kind: Entidad, filters: Filtros): Observable<Listado> {
    let params = new HttpParams().set('offset', filters.offset).set('limit', filters.limit);
    if (filters.q.trim()) params = params.set('q', filters.q.trim());
    if (kind === 'sucursales') {
      if (filters.idCiud !== undefined) params = params.set('idCiud', filters.idCiud);
      if (filters.estado !== undefined) params = params.set('estado', filters.estado);
    }
    return this.browser(() => this.http.get<Listado>(`${this.base}/${kind}`, { params })).pipe(
      map(value => ({ items: value.items.map(row => detalle(kind, row)), total: value.total, offset: value.offset, limit: value.limit })),
    );
  }
  detalle(kind: Entidad, id: number): Observable<Detalle> {
    return this.browser(() => this.http.get<Detalle>(`${this.base}/${kind}/${id}`)).pipe(map(value => detalle(kind, value)));
  }
  crear(kind: Entidad, input: Alta): Observable<Detalle> {
    const body = { ...this.body(kind, input), ...(kind === 'ciudades' ? { id: (input as Ciudad).id } : {}) };
    return this.browser(() => this.http.post<Detalle>(`${this.base}/${kind}`, body)).pipe(map(value => detalle(kind, value)));
  }
  editar(kind: Entidad, id: number, input: Cambios): Observable<Detalle> {
    return this.browser(() => this.http.patch<Detalle>(`${this.base}/${kind}/${id}`, this.body(kind, input)))
      .pipe(map(value => detalle(kind, value)));
  }
  private body(kind: Entidad, input: Cambios): Cambios {
    const body: Cambios = {};
    if (input.nombre !== undefined) body.nombre = input.nombre.trim();
    if (kind === 'sucursales') {
      if (input.direccion !== undefined) body.direccion = input.direccion.trim();
      if (input.idCiud !== undefined) body.idCiud = input.idCiud;
      if (input.estado !== undefined) body.estado = input.estado;
    }
    return body;
  }
}
