import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { effect, inject, Injectable, PLATFORM_ID, signal, untracked } from '@angular/core';
import { catchError, defer, EMPTY, filter, map, Observable, tap, throwError } from 'rxjs';
import { AuthService } from '../../../seguridad-accesos/services/auth.service';
import { API_BASE_URL } from '../../../../core/config/api.config';
import { CarritoDetalle, ItemAgregar, ItemCantidad } from '../models/carrito.models';

export const carritoVacio: CarritoDetalle = { idCarrito: null, items: [], cantidadItems: 0, subtotal: 0 };

function detalle(value: CarritoDetalle): CarritoDetalle {
  // Explicit allowlist: precios y totales siempre vienen del servidor.
  return { idCarrito: value.idCarrito,
    items: (value.items ?? []).map(item => ({ idDetalleCarro: item.idDetalleCarro, idVar: item.idVar,
      sku: item.sku, imagen: item.imagen, producto: item.producto,
      talla: { idTalla: item.talla.idTalla, descripcion: item.talla.descripcion },
      colores: (item.colores ?? []).map(color => ({ idColor: color.idColor, descripcion: color.descripcion, hex: color.hex })),
      precio: item.precio,
      promocion: item.promocion ? { idPromo: item.promocion.idPromo, nombre: item.promocion.nombre,
        tipoDescuento: item.promocion.tipoDescuento, valorDescuento: item.promocion.valorDescuento } : null,
      cantidad: item.cantidad, subtotal: item.subtotal,
      disponible: item.disponible, cantidadDisponible: item.cantidadDisponible })),
    cantidadItems: value.cantidadItems, subtotal: value.subtotal };
}

@Injectable({ providedIn: 'root' })
export class CarritoService {
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly platform = inject(PLATFORM_ID);
  private readonly base = `${inject(API_BASE_URL).replace(/\/$/, '')}/cliente/carrito`;
  // Resumen real del carrito para la navegación (contador del ShopLayout).
  readonly estado = signal<CarritoDetalle | null>(null);
  private key(): string { const value = this.auth.session(); return JSON.stringify(value ? [value.empresa, value.usuario.idUsuario, value.expiraEn] : null); }
  constructor() {
    let previous = this.key();
    effect(() => { const current = this.key(); if (previous !== current) { previous = current; untracked(() => this.estado.set(null)); } });
  }
  private browser<T>(request: () => Observable<T>): Observable<T> {
    return defer(() => {
      if (!isPlatformBrowser(this.platform)) return EMPTY;
      const owner = this.key();
      return request().pipe(filter(() => owner === this.key()),
        catchError(error => owner === this.key() ? throwError(() => error) : EMPTY));
    });
  }
  obtener(): Observable<CarritoDetalle> {
    return this.browser(() => this.http.get<CarritoDetalle>(this.base)).pipe(
      map(detalle), tap(value => this.estado.set(value)));
  }
  agregar(input: ItemAgregar): Observable<CarritoDetalle> {
    const body: ItemAgregar = { idVar: input.idVar.trim(), cantidad: input.cantidad };
    return this.browser(() => this.http.post<CarritoDetalle>(`${this.base}/items`, body)).pipe(
      map(detalle), tap(value => this.estado.set(value)));
  }
  modificar(id: number, cantidad: number): Observable<CarritoDetalle> {
    const body: ItemCantidad = { cantidad };
    return this.browser(() => this.http.patch<CarritoDetalle>(`${this.base}/items/${id}`, body)).pipe(
      map(detalle), tap(value => this.estado.set(value)));
  }
  eliminar(id: number): Observable<CarritoDetalle> {
    return this.browser(() => this.http.delete<CarritoDetalle>(`${this.base}/items/${id}`)).pipe(
      map(detalle), tap(value => this.estado.set(value)));
  }
}
