import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { defer, EMPTY, map, Observable } from 'rxjs';
import { API_BASE_URL } from '../../../../core/config/api.config';
import { CompraCrear, VentaDetalle } from '../models/compra.models';

function detalle(value: VentaDetalle): VentaDetalle {
  // Explicit allowlist: totales y precios siempre vienen del servidor.
  return { nroVenta: value.nroVenta, fechaHora: value.fechaHora, estado: value.estado, nit: value.nit,
    sucursal: { nro: value.sucursal.nro, nombre: value.sucursal.nombre, ciudad: value.sucursal.ciudad },
    carrito: value.carrito,
    items: (value.items ?? []).map(item => ({ idDetalleVenta: item.idDetalleVenta, idVar: item.idVar,
      sku: item.sku, producto: item.producto, cantidad: item.cantidad, precioUnitario: item.precioUnitario,
      subtotalBruto: item.subtotalBruto })),
    brutoTotal: value.brutoTotal, descAplicado: value.descAplicado, total: value.total };
}

@Injectable({ providedIn: 'root' })
export class ComprasService {
  private readonly http = inject(HttpClient);
  private readonly platform = inject(PLATFORM_ID);
  private readonly base = `${inject(API_BASE_URL).replace(/\/$/, '')}/cliente/compras`;
  private browser<T>(request: () => Observable<T>): Observable<T> {
    return defer(() => isPlatformBrowser(this.platform) ? request() : EMPTY);
  }
  preparar(input: CompraCrear): Observable<{ venta: VentaDetalle; reutilizada: boolean }> {
    // Solo sucursal y NIT viajan: carrito, precios y totales los resuelve el servidor.
    const body: CompraCrear = { nroSuc: input.nroSuc, ...(input.nit?.trim() ? { nit: input.nit.trim() } : {}) };
    return this.browser(() => this.http.post<VentaDetalle>(`${this.base}/desde-carrito`, body, { observe: 'response' })).pipe(
      map(response => ({ venta: detalle(response.body as VentaDetalle), reutilizada: response.status === 200 })),
    );
  }
  pendiente(): Observable<VentaDetalle | null> {
    return this.browser(() => this.http.get<VentaDetalle | null>(`${this.base}/pendiente`)).pipe(map(value => value ? detalle(value) : null));
  }
  cancelar(nro: number): Observable<VentaDetalle> {
    return this.browser(() => this.http.post<VentaDetalle>(`${this.base}/${nro}/cancelar`, {})).pipe(map(detalle));
  }
  detalle(nro: number): Observable<VentaDetalle> {
    return this.browser(() => this.http.get<VentaDetalle>(`${this.base}/${nro}`)).pipe(map(detalle));
  }
}
