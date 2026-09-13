import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { defer, EMPTY, forkJoin, map, Observable } from 'rxjs';
import { API_BASE_URL } from '../../../../core/config/api.config';
import { CiudadOpcion, EmpleadoCrear, EmpleadoEditar, EmpleadoOpciones, RolOpcion, SucursalOpcion, UsuarioDetalle, UsuariosFiltros, UsuariosListado } from '../models/usuario.models';

function detalle(value: UsuarioDetalle): UsuarioDetalle {
  // Explicit response allowlist: no password/hash retained even from an unexpected response.
  return { idUsuario: value.idUsuario, ci: value.ci, nombres: value.nombres,
    apellidoPat: value.apellidoPat, apellidoMat: value.apellidoMat, sexo: value.sexo,
    correo: value.correo, telefono: value.telefono, direccion: value.direccion, fechaNac: value.fechaNac,
    tipo: value.tipo, activo: value.activo, nroRol: value.nroRol,
    rol: { nro: value.rol.nro, descripcion: value.rol.descripcion },
    empleado: value.empleado ? { cod_emp: value.empleado.cod_emp, cargo: value.empleado.cargo, nroSuc: value.empleado.nroSuc } : null,
    admin: value.admin ? { cod_adm: value.admin.cod_adm } : null };
}

function datos(input: EmpleadoEditar): EmpleadoEditar {
  const body: EmpleadoEditar = {};
  const textKeys = ['ci', 'nombres', 'apellidoPat', 'apellidoMat', 'correo', 'telefono', 'direccion', 'fechaNac', 'nroRol', 'cod_emp', 'cargo'] as const;
  for (const key of textKeys) if (input[key] !== undefined) body[key] = input[key].trim();
  if (body.correo !== undefined) body.correo = body.correo.toLowerCase();
  if (input.sexo !== undefined) body.sexo = input.sexo;
  if (input.nroSuc !== undefined) body.nroSuc = input.nroSuc;
  return body;
}

@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private readonly http = inject(HttpClient);
  private readonly platform = inject(PLATFORM_ID);
  private readonly base = `${inject(API_BASE_URL).replace(/\/$/, '')}/admin`;
  private browser<T>(request: () => Observable<T>): Observable<T> {
    return defer(() => isPlatformBrowser(this.platform) ? request() : EMPTY);
  }

  listar(filters: UsuariosFiltros): Observable<UsuariosListado> {
    let params = new HttpParams().set('offset', filters.offset).set('limit', filters.limit);
    if (filters.q?.trim()) params = params.set('q', filters.q.trim());
    if (filters.tipo) params = params.set('tipo', filters.tipo);
    if (filters.activo !== undefined) params = params.set('activo', filters.activo);
    return this.browser(() => this.http.get<UsuariosListado>(`${this.base}/usuarios`, { params })).pipe(
      map(value => ({ items: value.items.map(detalle), total: value.total, offset: value.offset, limit: value.limit })),
    );
  }
  detalle(id: string): Observable<UsuarioDetalle> {
    return this.browser(() => this.http.get<UsuarioDetalle>(`${this.base}/usuarios/${encodeURIComponent(id)}`)).pipe(map(detalle));
  }
  crear(input: EmpleadoCrear): Observable<UsuarioDetalle> {
    return this.browser(() => this.http.post<UsuarioDetalle>(`${this.base}/empleados`, { ...datos(input), contrasena: input.contrasena })).pipe(map(detalle));
  }
  editar(id: string, input: EmpleadoEditar): Observable<UsuarioDetalle> {
    return this.browser(() => this.http.patch<UsuarioDetalle>(`${this.base}/empleados/${encodeURIComponent(id)}`, datos(input))).pipe(map(detalle));
  }
  estado(id: string, activo: boolean): Observable<UsuarioDetalle> {
    return this.browser(() => this.http.patch<UsuarioDetalle>(`${this.base}/usuarios/${encodeURIComponent(id)}/estado`, { activo })).pipe(map(detalle));
  }
  roles(): Observable<RolOpcion[]> {
    return this.browser(() => this.http.get<RolOpcion[]>(`${this.base}/usuarios/roles`));
  }
  ciudades(): Observable<CiudadOpcion[]> {
    return this.browser(() => this.http.get<CiudadOpcion[]>(`${this.base}/empleados/ciudades`));
  }
  sucursales(idCiud?: number): Observable<SucursalOpcion[]> {
    const params = idCiud === undefined ? new HttpParams() : new HttpParams().set('idCiud', idCiud);
    return this.browser(() => this.http.get<SucursalOpcion[]>(`${this.base}/empleados/sucursales`, { params }));
  }
  opciones(): Observable<EmpleadoOpciones> {
    return forkJoin({ roles: this.roles(), ciudades: this.ciudades(), sucursales: this.sucursales() });
  }
}
