import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { defer, EMPTY, map, Observable } from 'rxjs';
import { API_BASE_URL } from '../../../../core/config/api.config';
import { ClienteCrear, ClienteDetalle, ClienteEditar, ClientesFiltros, ClientesListado } from '../models/cliente.models';

function detalle(value: ClienteDetalle): ClienteDetalle {
  // Explicit allowlist: never retain unexpected credentials or opaque profile data.
  return { idUsuario: value.idUsuario, ci: value.ci, nombres: value.nombres,
    apellidoPat: value.apellidoPat, apellidoMat: value.apellidoMat, sexo: value.sexo,
    correo: value.correo, telefono: value.telefono, direccion: value.direccion, fechaNac: value.fechaNac,
    tipo: value.tipo, nroRol: value.nroRol,
    rol: { nro: value.rol.nro, descripcion: value.rol.descripcion },
    cliente: { cod_cl: value.cliente.cod_cl, estado: value.cliente.estado } };
}

@Injectable({ providedIn: 'root' })
export class ClientesService {
  private readonly http = inject(HttpClient);
  private readonly platform = inject(PLATFORM_ID);
  private readonly base = `${inject(API_BASE_URL).replace(/\/$/, '')}/admin/clientes`;
  private browser<T>(request: () => Observable<T>): Observable<T> {
    return defer(() => isPlatformBrowser(this.platform) ? request() : EMPTY);
  }
  listar(filters: ClientesFiltros): Observable<ClientesListado> {
    let params = new HttpParams().set('offset', filters.offset).set('limit', filters.limit);
    if (filters.q?.trim()) params = params.set('q', filters.q.trim());
    return this.browser(() => this.http.get<ClientesListado>(this.base, { params })).pipe(
      map(value => ({ items: value.items.map(detalle), total: value.total, offset: value.offset, limit: value.limit })),
    );
  }
  detalle(id: string): Observable<ClienteDetalle> {
    return this.browser(() => this.http.get<ClienteDetalle>(`${this.base}/${encodeURIComponent(id)}`)).pipe(map(detalle));
  }
  editar(id: string, input: ClienteEditar): Observable<ClienteDetalle> {
    const body: ClienteEditar = {};
    for (const key of ['ci', 'nombres', 'apellidoPat', 'apellidoMat', 'correo', 'telefono', 'direccion', 'fechaNac'] as const) {
      if (input[key] !== undefined) body[key] = input[key].trim();
    }
    if (body.correo !== undefined) body.correo = body.correo.toLowerCase();
    if (input.sexo !== undefined) body.sexo = input.sexo;
    return this.browser(() => this.http.patch<ClienteDetalle>(`${this.base}/${encodeURIComponent(id)}`, body)).pipe(map(detalle));
  }
  // CU07 alta administrativa: la sesión del administrador NO cambia.
  crear(input: ClienteCrear): Observable<ClienteDetalle> {
    const body = { ci: input.ci.trim(), nombres: input.nombres.trim(), apellidoPat: input.apellidoPat.trim(),
      apellidoMat: input.apellidoMat.trim(), sexo: input.sexo, correo: input.correo.trim().toLowerCase(),
      telefono: input.telefono.trim(), direccion: input.direccion.trim(), fechaNac: input.fechaNac,
      contrasena: input.contrasena };
    return this.browser(() => this.http.post<ClienteDetalle>(this.base, body)).pipe(map(detalle));
  }
  // CU07 baja lógica y reactivación (inactivo conserva historial, ventas y reservas).
  estadoCuenta(id: string, activo: boolean): Observable<ClienteDetalle> {
    return this.browser(() => this.http.patch<ClienteDetalle>(
      `${this.base}/${encodeURIComponent(id)}/estado-cuenta`, { activo })).pipe(map(detalle));
  }
}
