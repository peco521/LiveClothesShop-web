import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize, forkJoin, Subscription } from 'rxjs';
import { Cu05Layout } from '../../components/cu05-layout';
import { SucursalOpcion, UsuarioDetalle } from '../../models/usuario.models';
import { UsuariosService } from '../../services/usuarios.service';
import { usuarioError } from '../../services/usuario-error';

@Component({ selector: 'app-usuario-detalle', imports: [Cu05Layout, RouterLink], templateUrl: './usuario-detalle.html',
  styles: `dl { display: grid; grid-template-columns: minmax(100px, 1fr) 2fr; gap: 12px; } dt { font-weight: 600; } dd { margin: 0; overflow-wrap: anywhere; } .actions { display: flex; gap: 16px; flex-wrap: wrap; margin: 24px 0; }`,
})
export class UsuarioDetallePage {
  private readonly service = inject(UsuariosService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy = inject(DestroyRef);
  private request?: Subscription;
  readonly usuario = signal<UsuarioDetalle | null>(null);
  readonly sucursal = signal<SucursalOpcion | null>(null);
  readonly loading = signal(false); readonly busy = signal(false); readonly error = signal('');
  constructor() { this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(() => this.load()); }
  cambiarEstado(): void {
    const user = this.usuario();
    if (!user?.estado || this.busy()) return;
    this.busy.set(true); this.error.set('');
    this.service.estadoCuenta(user.idUsuario, user.estado === 'inactivo').pipe(
      takeUntilDestroyed(this.destroy), finalize(() => this.busy.set(false)),
    ).subscribe({ next: () => this.load(), error: (error: unknown) => this.error.set(usuarioError(error)) });
  }
  load(): void {
    this.request?.unsubscribe(); this.usuario.set(null); this.sucursal.set(null); this.error.set(''); this.loading.set(true);
    const id = this.route.snapshot.paramMap.get('idUsuario') ?? '';
    this.request = forkJoin({ user: this.service.detalle(id), branches: this.service.sucursales() }).pipe(
      takeUntilDestroyed(this.destroy), finalize(() => this.loading.set(false)),
    ).subscribe({ next: ({ user, branches }) => {
      this.usuario.set(user); this.sucursal.set(branches.find(branch => branch.nro === user.empleado?.nroSuc) ?? null);
    }, error: (error: unknown) => this.error.set(usuarioError(error)) });
  }
}
