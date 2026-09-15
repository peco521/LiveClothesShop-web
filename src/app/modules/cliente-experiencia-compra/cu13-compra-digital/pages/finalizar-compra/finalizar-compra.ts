import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize, Subscription } from 'rxjs';
import { Cu13Layout } from '../../components/cu13-layout';
import { CarritoDetalle } from '../../../cu12-carrito/models/carrito.models';
import { CarritoService } from '../../../cu12-carrito/services/carrito.service';
import { SucursalCliente } from '../../../cu11-gestionar-reserva/models/reserva.models';
import { ReservasService } from '../../../cu11-gestionar-reserva/services/reservas.service';
import { ComprasService } from '../../services/compras.service';
import { compraError } from '../../services/compra-error';

@Component({ selector: 'app-finalizar-compra', imports: [Cu13Layout, ReactiveFormsModule, RouterLink], templateUrl: './finalizar-compra.html',
  styles: `.table-scroll { overflow-x: auto; } table { width: 100%; border-collapse: collapse; } th, td { text-align: left; padding: 10px; border-bottom: 1px solid var(--line); } .form-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; margin-bottom: 12px; } .total { font-size: 1.2rem; margin: 16px 0; }`,
})
export class FinalizarCompraPage {
  private readonly carritoService = inject(CarritoService);
  private readonly reservasService = inject(ReservasService);
  private readonly compras = inject(ComprasService);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  private request?: Subscription;
  readonly busy = signal(false); readonly error = signal('');
  readonly carrito = signal<CarritoDetalle | null>(null);
  readonly sucursales = signal<SucursalCliente[]>([]);
  readonly form = inject(NonNullableFormBuilder).group({
    nroSuc: [0, [Validators.required, Validators.min(1)]],
    nit: ['', Validators.maxLength(30)],
  });
  constructor() {
    this.carritoService.obtener().pipe(takeUntilDestroyed()).subscribe({ next: value => this.carrito.set(value) });
    this.reservasService.sucursales().pipe(takeUntilDestroyed()).subscribe({ next: rows => this.sucursales.set(rows) });
  }
  confirmar(): void {
    if (this.form.invalid || this.busy()) { this.form.markAllAsTouched(); return; }
    const value = this.form.getRawValue();
    this.busy.set(true); this.error.set('');
    this.request?.unsubscribe();
    this.request = this.compras.preparar({ nroSuc: value.nroSuc, nit: value.nit || undefined })
      .pipe(takeUntilDestroyed(this.destroy), finalize(() => this.busy.set(false))).subscribe({
        next: ({ venta }) => void this.router.navigate(['/tienda/finalizar-compra', venta.nroVenta]),
        error: (error: unknown) => this.error.set(compraError(error)),
      });
  }
}
