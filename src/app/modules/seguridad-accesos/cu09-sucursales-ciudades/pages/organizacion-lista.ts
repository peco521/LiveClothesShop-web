import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize, Subscription } from 'rxjs';
import { Cu09Layout } from '../components/cu09-layout';
import { Entidad, entero, esSucursal, Estado, Filtros, identificador, Listado } from '../models/organizacion.models';
import { OrganizacionService } from '../services/organizacion.service';
import { organizacionError } from '../services/organizacion-error';

@Component({
  selector: 'app-organizacion-lista', imports: [Cu09Layout, ReactiveFormsModule, RouterLink],
  template: `<app-cu09-layout [title]="kind === 'ciudades' ? 'Ciudades' : 'Sucursales'">
    <a [routerLink]="[base, 'nuevo']">{{ kind === 'ciudades' ? 'Crear ciudad' : 'Crear sucursal' }}</a>
    <form [formGroup]="form" (ngSubmit)="aplicar()">
      <div class="field"><label for="org-q">Buscar por nombre{{ kind === 'sucursales' ? ' o dirección' : '' }}</label><input id="org-q" formControlName="q" maxlength="100"></div>
      @if (kind === 'sucursales') {
        <div class="field"><label for="f-ciudad">Ciudad (identificador)</label><input id="f-ciudad" type="number" formControlName="idCiud" step="1" min="-32768" max="32767"></div>
        <div class="field"><label for="f-estado">Estado</label><select id="f-estado" formControlName="estado"><option value="">Todos</option><option value="activo">activo</option><option value="inactivo">inactivo</option></select></div>
      }
      <button type="submit">Buscar</button>
    </form>
    @if (error()) { <p class="notice error" role="alert">{{ error() }}</p><button (click)="load()">Reintentar</button> }
    @if (loading()) { <p role="status">Cargando…</p> }
    @if (result(); as result) {
      <p>{{ result.total }} registros</p>
      <ul>@for (row of result.items; track id(row)) {
        <li><a [routerLink]="[base, id(row)]">{{ row.nombre }} ({{ id(row) }})</a>
          @if (isBranch(row)) { <span> · {{ row.ciudad.nombre }} · {{ row.direccion }} · {{ row.estado }}</span> }
          · <a [routerLink]="[base, id(row), 'editar']">Editar</a></li>
      } @empty { <li>No hay registros.</li> }</ul>
      <nav aria-label="Paginación"><button [disabled]="loading() || filters.offset === 0" (click)="pagina(-20)">Anterior</button>
        <button [disabled]="loading() || filters.offset + filters.limit >= result.total" (click)="pagina(20)">Siguiente</button></nav>
    }
  </app-cu09-layout>`,
})
export class OrganizacionListaPage {
  readonly kind = inject(ActivatedRoute).snapshot.data['kind'] as Entidad;
  readonly base = '/admin/' + this.kind;
  private readonly service = inject(OrganizacionService);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
  readonly result = signal<Listado | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly id = identificador;
  readonly isBranch = esSucursal;
  filters: Filtros = { offset: 0, limit: 20, q: '' };
  readonly form = new FormGroup({ q: new FormControl('', { nonNullable: true }), idCiud: new FormControl<number | null>(null), estado: new FormControl<Estado | ''>('', { nonNullable: true }) });
  constructor() { this.load(); }
  aplicar(): void {
    const value = this.form.getRawValue();
    if (value.q.trim().length > 100 || (value.idCiud !== null && !entero(value.idCiud, -32768, 32767)) || !['', 'activo', 'inactivo'].includes(value.estado)) {
      this.error.set('Revisa los filtros de búsqueda.'); return;
    }
    const next: Filtros = { offset: 0, limit: 20, q: value.q.trim(),
      ...(this.kind === 'sucursales' && value.idCiud !== null ? { idCiud: value.idCiud } : {}),
      ...(this.kind === 'sucursales' && value.estado ? { estado: value.estado } : {}) };
    if (this.loading() && JSON.stringify(next) === JSON.stringify(this.filters)) return;
    this.filters = next; this.load();
  }
  pagina(delta: number): void {
    if (this.loading()) return;
    const offset = this.filters.offset + delta;
    if (offset < 0 || (delta > 0 && offset >= (this.result()?.total ?? 0))) return;
    this.filters = { ...this.filters, offset }; this.load();
  }
  load(): void {
    this.request?.unsubscribe(); this.loading.set(true); this.error.set(''); this.result.set(null);
    this.request = this.service.listar(this.kind, this.filters).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loading.set(false)))
      .subscribe({ next: value => this.result.set(value), error: (error: unknown) => this.error.set(organizacionError(error)) });
  }
}
