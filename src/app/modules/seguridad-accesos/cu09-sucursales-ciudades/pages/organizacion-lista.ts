import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EMPTY, expand, finalize, reduce, Subscription } from 'rxjs';
import { Cu09Layout } from '../components/cu09-layout';
import { Ciudad, Detalle, Entidad, entero, esSucursal, Estado, Filtros, identificador, Listado } from '../models/organizacion.models';
import { OrganizacionService } from '../services/organizacion.service';
import { organizacionError } from '../services/organizacion-error';

@Component({
  selector: 'app-organizacion-lista', imports: [Cu09Layout, ReactiveFormsModule, RouterLink],
  template: `<app-cu09-layout [title]="kind === 'ciudades' ? 'Ciudades' : 'Sucursales'">
    <a [routerLink]="[base, 'nuevo']">{{ kind === 'ciudades' ? 'Crear ciudad' : 'Crear sucursal' }}</a>
    <form [formGroup]="form" (ngSubmit)="aplicar()">
      <div class="field"><label for="org-q">Buscar por nombre{{ kind === 'sucursales' ? ' o dirección' : '' }}</label><input id="org-q" formControlName="q" maxlength="100"></div>
      @if (kind === 'sucursales') {
        <div class="field"><label for="f-ciudad">Ciudad</label>
          <select id="f-ciudad" formControlName="idCiud" [attr.title]="cityNames()">
            <option [ngValue]="null">{{ loadingCities() ? 'Cargando ciudades…' : 'Todas las ciudades' }}</option>
            @for (city of cities(); track city.id) { <option [ngValue]="city.id">{{ city.nombre }}</option> }
          </select>
          @if (cityError()) { <span class="notice error" role="alert">{{ cityError() }}</span><button type="button" (click)="loadCities()">Reintentar ciudades</button> }
        </div>
        <div class="field"><label for="f-estado">Estado</label><select id="f-estado" formControlName="estado"><option value="">Todos</option><option value="activo">activo</option><option value="inactivo">inactivo</option></select></div>
      }
      <button type="submit">Buscar</button>
    </form>
    @if (error()) { <p class="notice error" role="alert">{{ error() }}</p><button (click)="load()">Reintentar</button> }
    @if (loading()) { <p role="status">Cargando…</p> }
    @if (result(); as result) {
      <p>{{ result.total }} registros</p>
      @if (!result.items.length) { <p>No hay registros.</p> }
      @else {
        <div class="table-scroll"><table [class.branch-table]="kind === 'sucursales'">
          <caption class="visually-hidden">{{ kind === 'ciudades' ? 'Ciudades registradas' : 'Sucursales registradas' }}</caption>
          <thead><tr>
            @if (kind === 'ciudades') { <th scope="col">ID</th> }
            <th scope="col">Nombre</th>
            @if (kind === 'sucursales') { <th scope="col">Ciudad</th><th scope="col">Ubicación</th><th scope="col">Estado</th> }
            <th scope="col">Acciones</th>
          </tr></thead>
          <tbody>@for (row of result.items; track id(row)) {
            <tr>
              @if (kind === 'ciudades') { <td>{{ id(row) }}</td> }
              <td><a [routerLink]="[base, id(row)]">{{ row.nombre }}</a></td>
              @if (isBranch(row)) { <td>{{ row.ciudad.nombre }}</td>
                <td>{{ row.direccion }}@if (coordenadas(row); as coords) { <br /><a [href]="mapa(coords)" target="_blank" rel="noopener noreferrer">Ver ubicación ({{ coords }})</a> } @else { <br /><span class="muted">Sin ubicación validada</span> }</td>
                <td>{{ row.estado }}</td> }
              <td class="actions-cell"><a [routerLink]="[base, id(row), 'editar']" [attr.aria-label]="'Editar ' + row.nombre">Editar</a></td>
            </tr>
          }</tbody>
        </table></div>
      }
      <nav aria-label="Paginación"><button [disabled]="loading() || filters.offset === 0" (click)="pagina(-20)">Anterior</button>
        <button [disabled]="loading() || filters.offset + filters.limit >= result.total" (click)="pagina(20)">Siguiente</button></nav>
    }
  </app-cu09-layout>`,
  styles: `.table-scroll { overflow-x: auto; margin: 20px 0; } table { width: 100%; border-collapse: collapse; } .branch-table { min-width: 640px; } th, td { text-align: left; padding: 12px; border-bottom: 1px solid var(--line); } th { white-space: nowrap; } td { overflow-wrap: anywhere; } .actions-cell { white-space: nowrap; } nav { display: flex; gap: 16px; flex-wrap: wrap; align-items: center; margin: 20px 0; }`,
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
  readonly cities = signal<Ciudad[]>([]);
  readonly loadingCities = signal(false);
  readonly cityError = signal('');
  constructor() { this.load(); if (this.kind === 'sucursales') this.loadCities(); }
  cityNames(): string { return this.cities().map(city => city.nombre).join('\n'); }
  /** CU09: coordenadas válidas o null (nunca se construye un mapa inválido). */
  coordenadas(row: Detalle): string | null {
    if (!esSucursal(row) || row.latitud === null || row.latitud === undefined
        || row.longitud === null || row.longitud === undefined) return null;
    const lat = Number(row.latitud); const lon = Number(row.longitud);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
  }
  mapa(coords: string): string {
    const [lat, lon] = coords.split(', ').map(Number);
    return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`;
  }
  loadCities(): void {
    if (this.loadingCities()) return;
    this.loadingCities.set(true); this.cityError.set('');
    this.service.listar('ciudades', { offset: 0, limit: 100, q: '' }).pipe(
      expand(page => page.offset + page.items.length < page.total && page.items.length > 0
        ? this.service.listar('ciudades', { offset: page.offset + page.items.length, limit: 100, q: '' }) : EMPTY),
      reduce((cities, page) => [...cities, ...page.items as Ciudad[]], [] as Ciudad[]),
      takeUntilDestroyed(this.destroyRef), finalize(() => this.loadingCities.set(false)),
    ).subscribe({ next: cities => this.cities.set(cities.sort((a, b) => a.nombre.localeCompare(b.nombre))),
      error: () => { this.cities.set([]); this.cityError.set('No se pudieron cargar las ciudades.'); } });
  }
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
