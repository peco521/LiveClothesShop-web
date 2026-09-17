import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize, Subscription } from 'rxjs';
import { Cu07Layout } from '../../components/cu07-layout';
import { ClienteDetalle } from '../../models/cliente.models';
import { ClientesService } from '../../services/clientes.service';
import { clienteError } from '../../services/cliente-error';
import { clienteNavigationParams } from '../../routes/cliente-navigation';

@Component({ selector: 'app-cliente-detalle', imports: [Cu07Layout, RouterLink], templateUrl: './cliente-detalle.html',
  styles: `dl { display: grid; grid-template-columns: minmax(100px, 1fr) 2fr; gap: 12px; } dt { font-weight: 600; } dd { margin: 0; overflow-wrap: anywhere; } .actions { display: flex; gap: 16px; flex-wrap: wrap; margin: 24px 0; }`,
})
export class ClienteDetallePage {
  private readonly service = inject(ClientesService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy = inject(DestroyRef);
  private request?: Subscription;
  readonly cliente = signal<ClienteDetalle | null>(null);
  readonly loading = signal(false); readonly error = signal('');
  constructor() { this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(() => this.load()); }
  get navigationParams() { return clienteNavigationParams(this.route.snapshot.queryParamMap); }
  load(): void {
    this.request?.unsubscribe();
    this.cliente.set(null); this.error.set(''); this.loading.set(true);
    this.request = this.service.detalle(this.route.snapshot.paramMap.get('idUsuario') ?? '').pipe(
      takeUntilDestroyed(this.destroy), finalize(() => this.loading.set(false)),
    ).subscribe({ next: value => this.cliente.set(value), error: (error: unknown) => this.error.set(clienteError(error)) });
  }
}
