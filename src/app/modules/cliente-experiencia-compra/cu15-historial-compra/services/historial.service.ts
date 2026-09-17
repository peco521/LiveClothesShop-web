import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { defer, EMPTY, map, Observable } from 'rxjs';
import { API_BASE_URL } from '../../../../core/config/api.config';
import { CompraDetalle, HistorialCompras, ProductoCompra } from '../models/historial.models';

const producto = (item: ProductoCompra): ProductoCompra => ({
  idVar: item.idVar, sku: item.sku, producto: item.producto, cantidad: item.cantidad,
});

@Injectable({ providedIn: 'root' })
export class HistorialService {
  private readonly http = inject(HttpClient);
  private readonly platform = inject(PLATFORM_ID);
  private readonly base = `${inject(API_BASE_URL).replace(/\/$/, '')}/cliente/historial-compras`;

  private browser<T>(request: () => Observable<T>): Observable<T> {
    return defer(() => isPlatformBrowser(this.platform) ? request() : EMPTY);
  }

  listar(offset = 0, limit = 20): Observable<HistorialCompras> {
    const params = new HttpParams().set('offset', offset).set('limit', limit);
    return this.browser(() => this.http.get<HistorialCompras>(this.base, { params })).pipe(
      map(value => ({
        total: value.total, offset: value.offset, limit: value.limit,
        items: value.items.map(item => ({
          nroVenta: item.nroVenta, fechaHora: item.fechaHora, estado: item.estado,
          estadoPago: item.estadoPago, monto: item.monto, productos: item.productos.map(producto),
        })),
      })),
    );
  }

  detalle(nro: number): Observable<CompraDetalle> {
    return this.browser(() => this.http.get<CompraDetalle>(`${this.base}/${nro}`)).pipe(
      map(value => ({
        nroVenta: value.nroVenta, fechaHora: value.fechaHora, estado: value.estado,
        estadoPago: value.estadoPago, nit: value.nit, idCarrito: value.idCarrito,
        nroReserva: value.nroReserva,
        sucursal: { nro: value.sucursal.nro, nombre: value.sucursal.nombre, ciudad: value.sucursal.ciudad },
        items: value.items.map(item => ({
          ...producto(item), idDetalleVenta: item.idDetalleVenta,
          precioUnitario: item.precioUnitario, subtotalBruto: item.subtotalBruto,
        })),
        brutoTotal: value.brutoTotal, descAplicado: value.descAplicado, total: value.total,
        pago: value.pago ? {
          idPago: value.pago.idPago, metodo: value.pago.metodo, monto: value.pago.monto,
          estado: value.pago.estado, fechaHora: value.pago.fechaHora, referencia: value.pago.referencia,
        } : null,
      })),
    );
  }
}
