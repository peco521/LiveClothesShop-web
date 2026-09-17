import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, Subscription } from 'rxjs';
import { Cu09Layout } from '../components/cu09-layout';
import { OrganizacionFormulario } from '../components/organizacion-formulario';
import { Alta, Cambios, Detalle, DIAS_SEMANA, Entidad, entero, esSucursal, identificador } from '../models/organizacion.models';
import { OrganizacionService } from '../services/organizacion.service';
import { organizacionError } from '../services/organizacion-error';

@Component({
  selector: 'app-organizacion-registro', imports: [Cu09Layout, OrganizacionFormulario, RouterLink],
  template: `<app-cu09-layout [title]="title">
    <a class="back-link" [routerLink]="base">Volver al listado</a>
    @if (error()) { <p class="notice error" role="alert">{{ error() }}</p> }
    @if (loading()) { <p role="status">Cargando…</p> }
    @if (!loading() && !ready()) { <button (click)="load()">Reintentar</button> }
    @if (ready()) {
      @if (mode !== 'detalle') {
        <app-organizacion-formulario [kind]="kind" [initial]="row()" [busy]="busy()" (guardar)="guardar($event)" />
        <a [routerLink]="row() ? [base, id(row()!)] : [base]">Cancelar</a>
      } @else if (row(); as row) {
        @if (saved()) {
          <div class="notice success saved-notice" role="status">
            <span class="success-icon" aria-hidden="true">✓</span>
            <div><strong>{{ kind === 'ciudades' ? 'Ciudad guardada correctamente.' : 'Sucursal guardada correctamente.' }}</strong>
              <p>La información ya está registrada en el sistema.</p></div>
          </div>
        }
        <dl class="record-details">
          <div class="detail-field"><dt>Identificador</dt><dd>{{ id(row) }}</dd></div>
          <div class="detail-field"><dt>Nombre</dt><dd>{{ row.nombre }}</dd></div>
          @if (isBranch(row)) {
            <div class="detail-field"><dt>Ubicación</dt><dd>{{ row.direccion }}</dd></div>
            <div class="detail-field"><dt>Ciudad</dt><dd><a [routerLink]="['/admin/ciudades', row.idCiud]">{{ row.ciudad.nombre }}</a></dd></div>
            <div class="detail-field"><dt>Estado</dt><dd><span class="status-badge" [class.inactive]="row.estado === 'inactivo'">{{ row.estado === 'activo' ? 'Activo' : 'Inactivo' }}</span></dd></div>
            <div class="detail-field wide"><dt>Horario de atención</dt><dd>
              <ul class="schedule-list">@for (range of row.horarios ?? []; track $index) {
                <li><span>{{ dayNames(range.dias) }}</span><strong>{{ range.horaIni }} – {{ range.horaFin }}</strong></li>
              } @empty { <li>Sin horario definido.</li> }</ul>
            </dd></div>
          }
        </dl>
        <div class="detail-actions"><a class="button primary" [routerLink]="[base, id(row), 'editar']">{{ kind === 'ciudades' ? 'Editar ciudad' : 'Editar sucursal' }}</a></div>
      }
    }
  </app-cu09-layout>`,
  styles: `.back-link { display: inline-block; margin-bottom: 24px; }
    .record-details { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin: 0 0 24px; }
    .detail-field { min-width: 0; padding: 18px; border: 1px solid var(--line); border-radius: 10px; }
    .detail-field.wide { grid-column: 1 / -1; }
    dt { color: var(--muted); font-size: .8rem; font-weight: 600; margin-bottom: 8px; }
    dd { margin: 0; font-size: 1rem; line-height: 1.6; overflow-wrap: anywhere; }
    .detail-actions { display: flex; flex-wrap: wrap; gap: 12px; } .detail-actions .button { width: auto; min-width: 160px; }
    .saved-notice { display: flex; align-items: flex-start; gap: 12px; } .saved-notice p { margin: 4px 0 0; font-size: .85rem; }
    .success-icon { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 28px; height: 28px; border-radius: 50%; background: #d1dfc9; font-weight: 700; }
    .status-badge { display: inline-block; padding: 3px 12px; border-radius: 20px; background: #edf3e9; color: #31492f; font-size: .85rem; font-weight: 600; }
    .status-badge.inactive { background: #f1f1e9; color: var(--muted); }
    .schedule-list { list-style: none; padding: 0; margin: 0; } .schedule-list li { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 8px 0; }
    .schedule-list li + li { border-top: 1px solid var(--line); }
    @media (max-width: 600px) { .record-details { grid-template-columns: 1fr; } .detail-actions .button { width: 100%; } }`,
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
  readonly saved = signal(false);
  readonly isBranch = esSucursal;
  readonly id = identificador;
  dayNames(days?: number[]): string { return DIAS_SEMANA.filter(day => (days ?? [1, 2, 3, 4, 5, 6, 7]).includes(day.id)).map(day => day.nombre).join(', '); }
  private target = 0;
  private valid = false;
  private request?: Subscription;
  private mutation?: Subscription;
  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.request?.unsubscribe(); this.mutation?.unsubscribe();
      const raw = params.get('id'); this.target = Number(raw);
      const confirmation = this.router.currentNavigation()?.extras.state?.['savedOrganization'];
      this.saved.set(this.mode === 'detalle' && confirmation?.kind === this.kind && confirmation?.id === this.target);
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
      .subscribe({ next: row => void this.router.navigate([this.base, identificador(row)], {
        state: { savedOrganization: { kind: this.kind, id: identificador(row) } },
      }), error: (error: unknown) => {
        this.error.set(organizacionError(error));
        if (error instanceof HttpErrorResponse && [401, 403, 404].includes(error.status)) { this.row.set(null); this.ready.set(false); }
      } });
  }
}
