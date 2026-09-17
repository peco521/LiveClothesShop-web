import { Component, input } from '@angular/core';
import { EstadoPago, EstadoVenta } from '../models/historial.models';

@Component({
  selector: 'app-compra-estados',
  template: `
    <span class="badge" [class.cancelled]="venta() === 'anulada'">{{ venta() === 'anulada' ? 'Anulada' : 'Registrada' }}</span>
    <span class="badge" [class.approved]="pago() === 'aprobado'" [class.cancelled]="pago() === 'rechazado'">
      {{ pago() === 'aprobado' ? 'Pago aprobado' : pago() === 'rechazado' ? 'Pago rechazado' : pago() === 'pendiente' ? 'Pago pendiente' : 'Sin pago registrado' }}
    </span>
  `,
  styles: `
    :host { display: flex; gap: 6px; flex-wrap: wrap; }
    .badge { padding: 4px 10px; border: 1px solid var(--line); background: #f1f1e9; border-radius: 999px; font-size: .78rem; }
    .approved { background: #edf3e9; border-color: #d1dfc9; color: #31492f; }
    .cancelled { background: #fbefec; border-color: #edcdc5; color: #8e2c26; }
  `,
})
export class CompraEstados {
  readonly venta = input.required<EstadoVenta>();
  readonly pago = input<EstadoPago | null>();
}
