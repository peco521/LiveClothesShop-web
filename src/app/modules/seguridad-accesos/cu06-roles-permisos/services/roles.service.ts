import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { defer, EMPTY, map, Observable } from 'rxjs';
import { API_BASE_URL } from '../../../../core/config/api.config';
import { FuncionDetalle, PermisosDetalle, RolCrear, RolDetalle, RolesListado } from '../models/rol.models';

function rol(value: RolDetalle): RolDetalle {
  return { nro: value.nro, descripcion: value.descripcion, esRolCliente: value.esRolCliente };
}
function permisos(value: PermisosDetalle): PermisosDetalle {
  return { nroRol: value.nroRol, esRolCliente: value.esRolCliente, permisos: [...value.permisos] };
}

@Injectable({ providedIn: 'root' })
export class RolesService {
  private readonly http = inject(HttpClient);
  private readonly platform = inject(PLATFORM_ID);
  private readonly base = `${inject(API_BASE_URL).replace(/\/$/, '')}/admin`;
  private browser<T>(request: () => Observable<T>): Observable<T> {
    return defer(() => isPlatformBrowser(this.platform) ? request() : EMPTY);
  }
  listar(offset = 0, limit = 20): Observable<RolesListado> {
    const params = new HttpParams().set('offset', offset).set('limit', limit);
    return this.browser(() => this.http.get<RolesListado>(`${this.base}/roles`, { params })).pipe(
      map(value => ({ items: value.items.map(rol), total: value.total, offset: value.offset, limit: value.limit })),
    );
  }
  detalle(nro: string): Observable<RolDetalle> {
    return this.browser(() => this.http.get<RolDetalle>(`${this.base}/roles/${encodeURIComponent(nro)}`)).pipe(map(rol));
  }
  crear(value: RolCrear): Observable<RolDetalle> {
    return this.browser(() => this.http.post<RolDetalle>(`${this.base}/roles`, {
      nro: value.nro, descripcion: value.descripcion.trim(),
    })).pipe(map(rol));
  }
  editar(nro: string, descripcion: string): Observable<RolDetalle> {
    return this.browser(() => this.http.patch<RolDetalle>(`${this.base}/roles/${encodeURIComponent(nro)}`, {
      descripcion: descripcion.trim(),
    })).pipe(map(rol));
  }
  funciones(): Observable<FuncionDetalle[]> {
    return this.browser(() => this.http.get<FuncionDetalle[]>(`${this.base}/funciones`)).pipe(
      map(rows => rows.map(row => ({ id: row.id, descripcion: row.descripcion }))),
    );
  }
  permisos(nro: string): Observable<PermisosDetalle> {
    return this.browser(() => this.http.get<PermisosDetalle>(`${this.base}/roles/${encodeURIComponent(nro)}/permisos`)).pipe(map(permisos));
  }
  reemplazarPermisos(nro: string, ids: string[]): Observable<PermisosDetalle> {
    return this.browser(() => this.http.put<PermisosDetalle>(`${this.base}/roles/${encodeURIComponent(nro)}/permisos`, {
      permisos: [...ids],
    })).pipe(map(permisos));
  }
}
