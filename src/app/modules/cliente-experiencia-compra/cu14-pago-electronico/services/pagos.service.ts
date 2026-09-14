import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { defer, EMPTY, map, Observable } from 'rxjs';
import { API_BASE_URL } from '../../../../core/config/api.config';
import { PagoCrear, PagoDetalle } from '../models/pago.models';

function detalle(value: PagoDetalle): PagoDetalle {
  // Explicit allowlist: monto, estado y referencia siempre vienen del servidor.
  return { idPago: value.idPago, metodo: value.metodo, monto: value.monto, estado: value.estado,
    fechaHora: value.fechaHora, referencia: value.referencia, nroVenta: value.nroVenta,
    estadoVenta: value.estadoVenta };
}

@Injectable({ providedIn: 'root' })
export class PagosService {
  private readonly http = inject(HttpClient);
  private readonly platform = inject(PLATFORM_ID);
  private readonly base = `${inject(API_BASE_URL).replace(/\/$/, '')}/cliente/pagos`;
  private browser<T>(request: () => Observable<T>): Observable<T> {
    return defer(() => isPlatformBrowser(this.platform) ? request() : EMPTY);
  }
  pagar(input: PagoCrear): Observable<{ pago: PagoDetalle; reutilizado: boolean }> {
    // Solo venta, método y escenario de simulación: el monto lo fija el servidor.
    const body: PagoCrear = { nroVenta: input.nroVenta, metodo: input.metodo,
      ...(input.escenario ? { escenario: input.escenario } : {}) };
    return this.browser(() => this.http.post<PagoDetalle>(this.base, body, { observe: 'response' })).pipe(
      map(response => ({ pago: detalle(response.body as PagoDetalle), reutilizado: response.status === 200 })),
    );
  }
  detalle(id: number): Observable<PagoDetalle> {
    return this.browser(() => this.http.get<PagoDetalle>(`${this.base}/${id}`)).pipe(map(detalle));
  }
  procesar(id: number, escenario?: PagoCrear['escenario']): Observable<PagoDetalle> {
    const body = escenario ? { escenario } : {};
    return this.browser(() => this.http.post<PagoDetalle>(`${this.base}/${id}/procesar`, body)).pipe(map(detalle));
  }
}
