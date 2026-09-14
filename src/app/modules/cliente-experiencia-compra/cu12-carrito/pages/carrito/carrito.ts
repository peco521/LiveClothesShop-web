import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize, Subscription } from 'rxjs';
import { Cu12Layout } from '../../components/cu12-layout';
import { CarritoDetalle } from '../../models/carrito.models';
import { CarritoService } from '../../services/carrito.service';
import { carritoError } from '../../services/carrito-error';

@Component({ selector: 'app-carrito', imports: [Cu12Layout, FormsModule, RouterLink], templateUrl: './carrito.html',
  styles: `.table-scroll { overflow-x: auto; } table { width: 100%; border-collapse: collapse; } th, td { text-align: left; padding: 10px; border-bottom: 1px solid var(--line); }
    .qty { display: inline-flex; gap: 6px; align-items: center; } .qty input { width: 64px; } .thumb { width: 48px; height: 48px; object-fit: cover; border-radius: 8px; }
    .total { font-size: 1.2rem; margin: 16px 0; }`,
})
export class CarritoPage {
  private readonly service = inject(CarritoService);
  private readonly destroy = inject(DestroyRef);
  private request?: Subscription;
  readonly busy = signal(false); readonly error = signal(''); readonly carrito = signal<CarritoDetalle | null>(null);
  readonly cantidades: Record<number, number> = {};
  constructor() { this.load(); }
  load(): void {
    this.request?.unsubscribe();
    this.busy.set(true); this.error.set('');
    this.request = this.service.obtener().pipe(takeUntilDestroyed(this.destroy), finalize(() => this.busy.set(false))).subscribe({
      next: value => { this.carrito.set(value); for (const item of value.items) this.cantidades[item.idDetalleCarro] = item.cantidad; },
      error: (error: unknown) => this.error.set(carritoError(error)),
    });
  }
  cambiar(item: { idDetalleCarro: number }, cantidad: number): void {
    if (!Number.isInteger(cantidad) || cantidad < 1 || this.busy()) return;
    this.mutar(this.service.modificar(item.idDetalleCarro, cantidad));
  }
  quitar(id: number): void {
    if (this.busy()) return;
    this.mutar(this.service.eliminar(id));
  }
  private mutar(request: ReturnType<CarritoService['modificar']>): void {
    this.request?.unsubscribe();
    this.busy.set(true); this.error.set('');
    this.request = request.pipe(takeUntilDestroyed(this.destroy), finalize(() => this.busy.set(false))).subscribe({
      next: value => { this.carrito.set(value); for (const item of value.items) this.cantidades[item.idDetalleCarro] = item.cantidad; },
      error: (error: unknown) => { this.error.set(carritoError(error)); this.load(); },
    });
  }
}
