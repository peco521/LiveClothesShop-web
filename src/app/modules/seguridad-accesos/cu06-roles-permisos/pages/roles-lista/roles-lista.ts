import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { finalize, Subscription } from 'rxjs';
import { Cu06Layout } from '../../components/cu06-layout';
import { rolDetalleRuta, RolesListado } from '../../models/rol.models';
import { RolesService } from '../../services/roles.service';
import { rolError } from '../../services/rol-error';

@Component({ selector: 'app-roles-lista', imports: [Cu06Layout, RouterLink],
  template: `<app-cu06-layout title="Roles y permisos" [error]="error()">
    <a class="button primary" routerLink="/admin/roles/nuevo">Crear rol</a>
    @if (loading()) { <p role="status">Cargando roles…</p> }
    @if (result(); as rows) {
      <p>{{ rows.total }} roles</p>
      <ul>@for (rol of rows.items; track rol.nro) {
        <li><a [routerLink]="detalleRuta(rol.nro)">{{ rol.nro }} — {{ rol.descripcion }}</a>
          @if (rol.esRolCliente) { <span> · Rol cliente protegido</span> }
          · <a [routerLink]="['/admin/roles', rol.nro, 'editar']">Editar descripción</a></li>
      } @empty { <li>No hay roles para mostrar.</li> }</ul>
      <nav aria-label="Paginación de roles">
        <button [disabled]="loading() || rows.offset === 0" (click)="load(rows.offset - rows.limit)">Anterior</button>
        <button [disabled]="loading() || rows.offset + rows.limit >= rows.total" (click)="load(rows.offset + rows.limit)">Siguiente</button>
      </nav>
    } @else if (!loading()) { <button (click)="load()">Reintentar</button> }
  </app-cu06-layout>`,
})
export class RolesListaPage {
  readonly detalleRuta = rolDetalleRuta;
  private readonly service = inject(RolesService);
  private readonly destroy = inject(DestroyRef);
  private request?: Subscription;
  readonly result = signal<RolesListado | null>(null);
  readonly loading = signal(false); readonly error = signal('');
  constructor() { this.load(); }
  load(offset = 0): void {
    this.request?.unsubscribe(); this.result.set(null); this.error.set(''); this.loading.set(true);
    this.request = this.service.listar(Math.max(0, offset), 20).pipe(takeUntilDestroyed(this.destroy), finalize(() => this.loading.set(false)))
      .subscribe({ next: rows => this.result.set(rows), error: (error: unknown) => this.error.set(rolError(error)) });
  }
}
