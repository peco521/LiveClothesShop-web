import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { defer, EMPTY, map, Observable } from 'rxjs';
import { API_BASE_URL } from '../../../../core/config/api.config';
import { HorariosSucursal, ReservaCrear, ReservaDetalle, ReservasFiltros, ReservasListado, SucursalCliente } from '../models/reserva.models';

function detalle(value: ReservaDetalle): ReservaDetalle {
  // Explicit allowlist: nunca conservar campos inesperados ni identidad ajena.
  return { nroReserva: value.nroReserva, fechaReserva: value.fechaReserva, horaAtencion: value.horaAtencion,
    estado: value.estado,
    sucursal: { nro: value.sucursal.nro, nombre: value.sucursal.nombre, ciudad: value.sucursal.ciudad },
    items: (value.items ?? []).map(item => ({ idDetalleRes: item.idDetalleRes, idVar: item.idVar,
      sku: item.sku, producto: item.producto, cantidad: item.cantidad })),
    totalUnidades: value.totalUnidades, vencida: value.vencida };
}

@Injectable({ providedIn: 'root' })
export class ReservasService {
  private readonly http = inject(HttpClient);
  private readonly platform = inject(PLATFORM_ID);
  private readonly base = `${inject(API_BASE_URL).replace(/\/$/, '')}/cliente`;
  private browser<T>(request: () => Observable<T>): Observable<T> {
    return defer(() => isPlatformBrowser(this.platform) ? request() : EMPTY);
  }
  crear(input: ReservaCrear): Observable<ReservaDetalle> {
    // El propietario se resuelve en el backend desde la sesión; jamás se envía.
    const body: ReservaCrear = { nroSuc: input.nroSuc, fechaReserva: input.fechaReserva, horaAtencion: input.horaAtencion,
      items: input.items.map(item => ({ idVar: item.idVar.trim(), cantidad: item.cantidad })) };
    return this.browser(() => this.http.post<ReservaDetalle>(`${this.base}/reservas`, body)).pipe(map(detalle));
  }
  listar(filters: ReservasFiltros): Observable<ReservasListado> {
    let params = new HttpParams().set('offset', filters.offset).set('limit', filters.limit);
    if (filters.estado) params = params.set('estado', filters.estado);
    return this.browser(() => this.http.get<ReservasListado>(`${this.base}/reservas`, { params })).pipe(
      map(value => ({ items: value.items.map(detalle), total: value.total, offset: value.offset, limit: value.limit })),
    );
  }
  detalle(nro: number): Observable<ReservaDetalle> {
    return this.browser(() => this.http.get<ReservaDetalle>(`${this.base}/reservas/${nro}`)).pipe(map(detalle));
  }
  cancelar(nro: number): Observable<ReservaDetalle> {
    return this.browser(() => this.http.patch<ReservaDetalle>(`${this.base}/reservas/${nro}/cancelar`, {})).pipe(map(detalle));
  }
  sucursales(): Observable<SucursalCliente[]> {
    return this.browser(() => this.http.get<{ items: SucursalCliente[]; total: number }>(`${this.base}/sucursales`)).pipe(
      map(value => value.items.map(item => ({ nro: item.nro, nombre: item.nombre, direccion: item.direccion, ciudad: item.ciudad }))),
    );
  }
  horarios(nro: number): Observable<HorariosSucursal> {
    return this.browser(() => this.http.get<HorariosSucursal>(`${this.base}/sucursales/${nro}/horarios`)).pipe(
      map(value => ({ nroSuc: value.nroSuc, rangos: (value.rangos ?? []).map(r => ({ horaIni: r.horaIni, horaFin: r.horaFin, ...(r.dias ? { dias: [...r.dias] } : {}) })) })),
    );
  }
}
