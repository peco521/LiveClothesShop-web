import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, Subscription } from 'rxjs';
import { Cu09Layout } from '../components/cu09-layout';
import { OrganizacionFormulario } from '../components/organizacion-formulario';
import { Alta, Cambios, Detalle, Entidad, entero, esSucursal, identificador } from '../models/organizacion.models';
import { OrganizacionService } from '../services/organizacion.service';
import { organizacionError } from '../services/organizacion-error';

@Component({
  selector: 'app-organizacion-registro', imports: [Cu09Layout, OrganizacionFormulario, RouterLink],
  template: `<app-cu09-layout [title]="title">
    <a [routerLink]="base">Volver al listado</a>
    @if (error()) { <p class="notice error" role="alert">{{ error() }}</p> }
    @if (loading()) { <p role="status">Cargando…</p> }
    @if (!loading() && !ready()) { <button (click)="load()">Reintentar</button> }
    @if (ready()) {
      @if (mode !== 'detalle') {
        <app-organizacion-formulario [kind]="kind" [initial]="row()" [busy]="busy()" (guardar)="guardar($event)" />
        <a [routerLink]="row() ? [base, id(row()!)] : [base]">Cancelar</a>
      } @else if (row(); as row) {
        <dl><dt>Identificador</dt><dd>{{ id(row) }}</dd><dt>Nombre</dt><dd>{{ row.nombre }}</dd>
        @if (isBranch(row)) {
          <dt>Dirección</dt><dd>{{ row.direccion }}</dd><dt>Ciudad</dt><dd><a [routerLink]="['/admin/ciudades', row.idCiud]">{{ row.ciudad.nombre }} ({{ row.idCiud }})</a></dd>
          <dt>Estado</dt><dd>{{ row.estado }}</dd>
          <p>El estado no elimina la sucursal ni modifica sus empleados, inventario, ventas u horarios.</p>
        }</dl>
        <a [routerLink]="[base, id(row), 'editar']">Editar{{ isBranch(row) ? ' / cambiar ciudad o estado' : ' nombre' }}</a>
      }
    }
  </app-cu09-layout>`,
})
export class OrganizacionRegistroPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(OrganizacionService);
  private readonly destroyRef = inject(DestroyRef);
  readonly kind = this.route.snapshot.data['kind'] as Entidad;
  readonly mode = this.route.snapshot.data['mode'] as 'crear' | 'editar' | 'detalle';
  readonly base = '/admin/' + this.kind;
  readonly title = `${this.mode === 'crear' ? 'Crear' : this.mode === 'editar' ? 'Editar' : 'Detalle de'} ${this.kind === 'ciudades' ? 'ciudad' : 'sucursal'}`;
  readonly row = signal<Detalle | null>(null);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly ready = signal(false);
  readonly error = signal('');
  readonly isBranch = esSucursal;
  readonly id = identificador;
  private target = 0;
  private valid = false;
  private request?: Subscription;
  private mutation?: Subscription;
  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.request?.unsubscribe(); this.mutation?.unsubscribe();
      const raw = params.get('id'); this.target = Number(raw);
      this.valid = this.mode === 'crear' || (raw !== null && /^-?\d+$/.test(raw) && entero(this.target,
        this.kind === 'ciudades' ? -32768 : -2147483648, this.kind === 'ciudades' ? 32767 : 2147483647));
      this.load();
    });
  }
  load(): void {
    this.request?.unsubscribe(); this.row.set(null); this.ready.set(false); this.error.set('');
    if (!this.valid) { this.error.set('Identificador inválido.'); return; }
    if (this.mode === 'crear') { this.ready.set(true); return; }
    this.loading.set(true);
    this.request = this.service.detalle(this.kind, this.target).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loading.set(false)))
      .subscribe({ next: row => { this.row.set(row); this.ready.set(true); }, error: (error: unknown) => this.error.set(organizacionError(error)) });
  }
  guardar(input: Alta | Cambios): void {
    if (this.busy() || !this.ready() || this.mode === 'detalle' || !Object.keys(input).length) return;
    this.busy.set(true); this.error.set('');
    const request = this.mode === 'crear' ? this.service.crear(this.kind, input as Alta) : this.service.editar(this.kind, this.target, input);
    this.mutation = request.pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(false)))
      .subscribe({ next: row => void this.router.navigate([this.base, identificador(row)]), error: (error: unknown) => {
        this.error.set(organizacionError(error));
        if (error instanceof HttpErrorResponse && [401, 403, 404].includes(error.status)) { this.row.set(null); this.ready.set(false); }
      } });
  }
}
