import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, Subscription } from 'rxjs';
import { Cu07Layout } from '../../components/cu07-layout';
import { ClienteFormularioComponent } from '../../components/cliente-formulario';
import { ClienteDetalle, ClienteEditar } from '../../models/cliente.models';
import { ClientesService } from '../../services/clientes.service';
import { clienteError, clienteNoDisponible } from '../../services/cliente-error';
import { clienteNavigationParams } from '../../routes/cliente-navigation';

@Component({ selector: 'app-cliente-editar', imports: [Cu07Layout, ClienteFormularioComponent, RouterLink], templateUrl: './cliente-editar.html' })
export class ClienteEditarPage {
  private readonly service = inject(ClientesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  private request?: Subscription; private mutation?: Subscription;
  readonly cliente = signal<ClienteDetalle | null>(null);
  readonly loading = signal(false); readonly busy = signal(false); readonly error = signal('');
  constructor() { this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(() => this.load()); }
  get navigationParams() { return clienteNavigationParams(this.route.snapshot.queryParamMap); }
  load(): void {
    this.mutation?.unsubscribe(); this.request?.unsubscribe();
    this.cliente.set(null); this.error.set(''); this.loading.set(true);
    this.request = this.service.detalle(this.route.snapshot.paramMap.get('idUsuario') ?? '').pipe(
      takeUntilDestroyed(this.destroy), finalize(() => this.loading.set(false)),
    ).subscribe({ next: value => this.cliente.set(value), error: (error: unknown) => this.error.set(clienteError(error)) });
  }
  guardar(value: ClienteEditar): void {
    const user = this.cliente(); if (!user || this.busy() || !Object.keys(value).length) return;
    this.busy.set(true); this.error.set('');
    this.mutation = this.service.editar(user.idUsuario, value).pipe(takeUntilDestroyed(this.destroy), finalize(() => this.busy.set(false))).subscribe({
      next: result => { void this.router.navigate(['/admin/clientes', result.idUsuario], { queryParams: this.navigationParams }); },
      error: (error: unknown) => { this.error.set(clienteError(error)); if (clienteNoDisponible(error)) this.cliente.set(null); },
    });
  }
}
