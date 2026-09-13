import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { finalize, Subscription } from 'rxjs';
import { Cu08Layout } from '../../components/cu08-layout';
import { BitacoraDatos } from '../../components/bitacora-datos';
import { BitacoraDetalle } from '../../models/bitacora.models';
import { BitacoraService } from '../../services/bitacora.service';
import { bitacoraError } from '../../services/bitacora-error';

@Component({ selector: 'app-bitacora-detalle', imports: [Cu08Layout, BitacoraDatos],
  template: `<app-cu08-layout title="Detalle de bitácora" [error]="error()">
    @if (busy()) { <p role="status">Cargando registro…</p> }
    @if (error()) { <button type="button" class="button" (click)="load()" [disabled]="busy()">Reintentar</button> }
    @if (registro(); as value) { <app-bitacora-datos [registro]="value" /> }
  </app-cu08-layout>`,
})
export class BitacoraDetallePage {
  private readonly service = inject(BitacoraService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy = inject(DestroyRef);
  private request?: Subscription;
  readonly registro = signal<BitacoraDetalle | null>(null); readonly busy = signal(false); readonly error = signal('');
  constructor() { this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(() => this.load()); }
  load(): void {
    this.request?.unsubscribe(); this.registro.set(null); this.error.set(''); this.busy.set(true);
    this.request = this.service.detalle(this.route.snapshot.paramMap.get('id') ?? '').pipe(
      takeUntilDestroyed(this.destroy), finalize(() => this.busy.set(false)),
    ).subscribe({ next: value => this.registro.set(value), error: (error: unknown) => this.error.set(bitacoraError(error)) });
  }
}
