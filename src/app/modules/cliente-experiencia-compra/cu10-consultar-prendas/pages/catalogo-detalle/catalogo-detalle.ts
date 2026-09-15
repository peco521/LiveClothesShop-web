import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { Cu10Layout } from '../../components/cu10-layout';
import { ProductoDetalle } from '../../models/catalogo.models';
import { CatalogoService } from '../../services/catalogo.service';
import { catalogoError } from '../../services/catalogo-error';
import { CarritoService } from '../../../cu12-carrito/services/carrito.service';
import { carritoError } from '../../../cu12-carrito/services/carrito-error';

@Component({ selector: 'app-catalogo-detalle', imports: [Cu10Layout, FormsModule, RouterLink], templateUrl: './catalogo-detalle.html',
  styles: `.meta { display: grid; gap: 4px; margin: 12px 0; } .table-scroll { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; } th, td { text-align: left; padding: 10px; border-bottom: 1px solid var(--line); }
    .variant { border: 1px solid var(--line); border-radius: 12px; padding: 12px; margin: 12px 0; }
    .variant.selected { outline: 2px solid currentColor; } .swatch { display: inline-block; width: 16px; height: 16px; border-radius: 50%; border: 1px solid var(--line); vertical-align: middle; }
    .actions { display: flex; gap: 12px; align-items: end; margin: 12px 0; flex-wrap: wrap; }`,
})
export class CatalogoDetallePage {
  private readonly service = inject(CatalogoService);
  private readonly carrito = inject(CarritoService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy = inject(DestroyRef);
  readonly busy = signal(false); readonly error = signal(''); readonly item = signal<ProductoDetalle | null>(null);
  readonly seleccion = signal<string | null>(null);
  readonly actual = signal('');
  readonly cantidad = signal(1);
  readonly agregando = signal(false); readonly agregado = signal(false); readonly carritoErrorMsg = signal('');
  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(params => { this.actual.set(params.get('id') ?? ''); this.load(this.actual()); });
  }
  elegir(idVariante: string): void { this.seleccion.set(idVariante); this.agregado.set(false); this.carritoErrorMsg.set(''); }
  load(id: string): void {
    this.busy.set(true); this.error.set(''); this.item.set(null); this.seleccion.set(null);
    this.agregado.set(false); this.carritoErrorMsg.set(''); this.cantidad.set(1);
    this.service.detalle(id).pipe(takeUntilDestroyed(this.destroy), finalize(() => this.busy.set(false))).subscribe({
      next: value => { this.item.set(value); if (value.variantes.length === 1) this.seleccion.set(value.variantes[0].idVariante); },
      error: (error: unknown) => this.error.set(catalogoError(error)),
    });
  }
  agregar(): void {
    const idVar = this.seleccion();
    const cantidad = Math.floor(this.cantidad());
    if (!idVar || !Number.isInteger(cantidad) || cantidad < 1 || this.agregando()) return;
    this.agregando.set(true); this.agregado.set(false); this.carritoErrorMsg.set('');
    this.carrito.agregar({ idVar, cantidad }).pipe(takeUntilDestroyed(this.destroy), finalize(() => this.agregando.set(false))).subscribe({
      next: () => this.agregado.set(true),
      error: (error: unknown) => this.carritoErrorMsg.set(carritoError(error)),
    });
  }
}
