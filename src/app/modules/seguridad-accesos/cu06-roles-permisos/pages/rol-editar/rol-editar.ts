import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, Subscription } from 'rxjs';
import { Cu06Layout } from '../../components/cu06-layout';
import { RolFormularioComponent } from '../../components/rol-formulario';
import { RolCrear, RolDetalle, rolDetalleRuta } from '../../models/rol.models';
import { RolesService } from '../../services/roles.service';
import { accesoRechazado, rolError } from '../../services/rol-error';

@Component({ selector: 'app-rol-editar', imports: [Cu06Layout, RolFormularioComponent],
  template: `<app-cu06-layout title="Editar descripción del rol" [error]="error()">
    @if (loading()) { <p role="status">Cargando rol…</p> }
    @if (rol(); as current) { <app-rol-formulario [rol]="current" [busy]="busy()" (guardar)="guardar($event)" /> }
    @else if (!loading()) { <button (click)="load()">Reintentar</button> }
  </app-cu06-layout>`,
})
export class RolEditarPage {
  private readonly service = inject(RolesService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy = inject(DestroyRef);
  private request?: Subscription; private mutation?: Subscription;
  readonly rol = signal<RolDetalle | null>(null);
  readonly loading = signal(false); readonly busy = signal(false); readonly error = signal('');
  constructor() { this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(() => this.load()); }
  load(): void {
    this.mutation?.unsubscribe(); this.request?.unsubscribe(); this.rol.set(null); this.error.set(''); this.loading.set(true);
    const nro = this.route.snapshot.paramMap.get('nro') ?? '';
    this.request = this.service.detalle(nro).pipe(takeUntilDestroyed(this.destroy), finalize(() => this.loading.set(false)))
      .subscribe({ next: rol => this.rol.set(rol), error: (error: unknown) => this.error.set(rolError(error)) });
  }
  guardar(value: RolCrear): void {
    const rol = this.rol();
    if (!rol || this.busy() || value.descripcion.trim() === rol.descripcion) return;
    this.busy.set(true); this.error.set('');
    this.mutation = this.service.editar(rol.nro, value.descripcion).pipe(takeUntilDestroyed(this.destroy), finalize(() => this.busy.set(false))).subscribe({
      next: result => { void this.router.navigate(rolDetalleRuta(result.nro)); },
      error: (error: unknown) => { this.error.set(rolError(error)); if (accesoRechazado(error)) this.rol.set(null); },
    });
  }
}
