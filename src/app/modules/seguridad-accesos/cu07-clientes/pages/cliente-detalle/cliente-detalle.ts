import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize, Subscription } from 'rxjs';
import { Cu07Layout } from '../../components/cu07-layout';
import { ClienteDetalle } from '../../models/cliente.models';
import { ClientesService } from '../../services/clientes.service';
import { clienteError, clienteNoDisponible } from '../../services/cliente-error';
import { clienteNavigationParams } from '../../routes/cliente-navigation';

@Component({ selector: 'app-cliente-detalle', imports: [Cu07Layout, RouterLink], templateUrl: './cliente-detalle.html',
  styles: `dl { display: grid; grid-template-columns: minmax(100px, 1fr) 2fr; gap: 12px; } dt { font-weight: 600; } dd { margin: 0; overflow-wrap: anywhere; } .actions { display: flex; gap: 16px; flex-wrap: wrap; margin: 24px 0; }`,
})
export class ClienteDetallePage {
  private readonly service = inject(ClientesService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy = inject(DestroyRef);
  private request?: Subscription; private mutation?: Subscription;
  readonly cliente = signal<ClienteDetalle | null>(null);
  readonly loading = signal(false); readonly busy = signal(false); readonly error = signal('');
  readonly confirmar = signal(false); readonly success = signal('');
  constructor() { this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(() => this.load()); }
  get navigationParams() { return clienteNavigationParams(this.route.snapshot.queryParamMap); }
  load(): void {
    this.mutation?.unsubscribe(); this.request?.unsubscribe();
    this.cliente.set(null); this.error.set(''); this.success.set(''); this.confirmar.set(false); this.loading.set(true);
    this.request = this.service.detalle(this.route.snapshot.paramMap.get('idUsuario') ?? '').pipe(
      takeUntilDestroyed(this.destroy), finalize(() => this.loading.set(false)),
    ).subscribe({ next: value => this.cliente.set(value), error: (error: unknown) => this.error.set(clienteError(error)) });
  }
  cambiarEstado(): void {
    const user = this.cliente(); if (!user || this.busy() || !this.confirmar()) return;
    this.busy.set(true); this.error.set(''); this.success.set('');
    this.mutation = this.service.estado(user.idUsuario, !user.activo).pipe(takeUntilDestroyed(this.destroy), finalize(() => this.busy.set(false))).subscribe({
      next: value => { this.cliente.set(value); this.confirmar.set(false); this.success.set(value.activo ? 'Cuenta activada. Las sesiones anteriores no se restauran.' : 'Cuenta desactivada. Sesiones revocadas y recuperaciones pendientes invalidadas.'); },
      error: (error: unknown) => { this.error.set(clienteError(error)); this.confirmar.set(false); if (clienteNoDisponible(error)) this.cliente.set(null); },
    });
  }
}
