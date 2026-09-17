import { Component, DestroyRef, inject, input, OnChanges, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, expand, finalize, reduce } from 'rxjs';
import { OrganizacionService } from '../services/organizacion.service';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Alta, Cambios, Ciudad, Detalle, DIAS_SEMANA, Entidad, entero, esSucursal, Estado, HorarioSucursal, HorarioSugerencia } from '../models/organizacion.models';

@Component({
  selector: 'app-organizacion-formulario', imports: [ReactiveFormsModule, RouterLink],
  template: `
    <form [formGroup]="form" (ngSubmit)="enviar()">
      <fieldset [disabled]="busy()">
        <div class="field"><label for="org-nombre">Nombre</label>
          <input id="org-nombre" formControlName="nombre" maxlength="50" required></div>
        @if (kind() === 'sucursales') {
          <div class="field"><label for="org-direccion">Dirección</label>
            <input id="org-direccion" formControlName="direccion" maxlength="100" required></div>
          <div class="field"><label for="org-ciudad">Ciudad</label>
            <select id="org-ciudad" formControlName="idCiud" required [attr.title]="cityNames()">
              <option [ngValue]="null">{{ loadingCities() ? 'Cargando ciudades…' : 'Selecciona una ciudad' }}</option>
              @for (city of cities(); track city.id) { <option [ngValue]="city.id">{{ city.nombre }}</option> }
            </select>
            @if (cityError()) { <span class="notice error" role="alert">{{ cityError() }}</span><button type="button" (click)="loadCities()">Reintentar</button> }
            @if (!loadingCities() && !cityError() && !cities().length) { <span class="hint">No hay ciudades registradas. <a routerLink="/admin/ciudades/nuevo">Registrar ciudad</a>.</span> }
          </div>
          <div class="field"><label for="org-estado">Estado</label>

            <select id="org-estado" formControlName="estado"><option value="activo">activo</option><option value="inactivo">inactivo</option></select>
            <span class="hint">No elimina la sucursal ni modifica empleados, inventario, ventas u horarios.</span></div>
          <fieldset formArrayName="horarios">
            <legend>Horario de atención</legend>
            <p class="hint">Selecciona los días y las horas de apertura y cierre. Puedes agregar rangos distintos para otros días o para el descanso.</p>
            @if (loadingSuggestions()) { <p class="hint" role="status">Cargando horarios sugeridos…</p> }
            @if (suggestionError()) { <p class="hint">{{ suggestionError() }} <button class="schedule-button" type="button" (click)="loadSuggestions()">Reintentar sugerencias</button></p> }
            @for (range of form.controls.horarios.controls; track range; let i = $index) {
              <div [formGroupName]="i">
                <p class="hint" [id]="'dias-label-' + i">Días de atención del rango {{ i + 1 }}</p>
                <div class="day-buttons" role="group" [attr.aria-labelledby]="'dias-label-' + i">
                  @for (day of days; track day.id) {
                    <button class="day-button" type="button" [class.selected]="range.controls.dias.value.includes(day.id)" [attr.aria-pressed]="range.controls.dias.value.includes(day.id)" (click)="toggleDay(i, day.id)" [disabled]="busy()">{{ day.nombre }}</button>
                  }
                </div>
                @if (suggestions().length) {
                  <div class="field"><label [for]="'sugerencia-' + i">Usar un horario existente (opcional)</label>
                    <select [id]="'sugerencia-' + i" [value]="''" (change)="applySuggestion(i, $any($event.target).value)">
                      <option value="">Selecciona un horario para copiar sus horas</option>
                      @for (suggestion of suggestions(); track suggestion.idAten) { <option [value]="suggestion.idAten">{{ suggestion.horaIni }} – {{ suggestion.horaFin }}</option> }
                    </select>
                  </div>
                }
                <div class="field"><label [for]="'hora-ini-' + i">Hora de apertura</label><input [id]="'hora-ini-' + i" type="time" step="any" formControlName="horaIni" required></div>
                <div class="field"><label [for]="'hora-fin-' + i">Hora de cierre</label><input [id]="'hora-fin-' + i" type="time" step="any" formControlName="horaFin" required></div>
                <button class="schedule-button" type="button" (click)="form.controls.horarios.removeAt(i)" [disabled]="busy()">Quitar rango {{ i + 1 }}</button>
              </div>
            } @empty { <p class="hint">Sin horario de atención definido.</p> }
            <button class="schedule-button" type="button" (click)="addHours()" [disabled]="busy() || form.controls.horarios.length >= 14">Agregar horario</button>
          </fieldset>
        }
        @if (error()) { <p class="notice error" role="alert">{{ error() }}</p> }
        <button class="button primary" type="submit" [disabled]="busy() || (kind() === 'sucursales' && (loadingCities() || !cities().length))">{{ busy() ? 'Guardando…' : 'Guardar' }}</button>
      </fieldset>
    </form>`,
  styles: `.day-buttons { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0 20px; } .day-button, .schedule-button { padding: 10px 15px; min-height: 44px; border: 1px solid var(--line); border-radius: 8px; background: var(--paper); color: var(--ink); cursor: pointer; font-weight: 600; } .day-button:hover, .schedule-button:hover { background: #edf3e9; border-color: var(--accent); } .day-button.selected { background: var(--accent); color: white; border-color: var(--accent); } .schedule-button { margin: 0 8px 18px 0; } button:disabled { opacity: .6; cursor: not-allowed; } [formGroupName] { padding: 18px; border: 1px solid var(--line); border-radius: 10px; margin-bottom: 16px; } legend { font-weight: 600; padding-top: 12px; }`,
})
export class OrganizacionFormulario implements OnChanges {
  private readonly service = inject(OrganizacionService);
  private readonly destroyRef = inject(DestroyRef);
  readonly cities = signal<Ciudad[]>([]);
  readonly loadingCities = signal(false);
  readonly cityError = signal('');
  readonly days = DIAS_SEMANA;
  readonly suggestions = signal<HorarioSugerencia[]>([]);
  readonly loadingSuggestions = signal(false);
  readonly suggestionError = signal('');
  loadSuggestions(): void {
    if (this.loadingSuggestions()) return;
    this.loadingSuggestions.set(true); this.suggestionError.set('');
    this.service.horariosSugeridos().pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loadingSuggestions.set(false))).subscribe({
      next: rows => this.suggestions.set(rows), error: () => this.suggestionError.set('No se pudieron cargar las sugerencias. Puedes ingresar las horas manualmente.'),
    });
  }
  toggleDay(index: number, day: number): void {
    const control = this.form.controls.horarios.at(index).controls.dias;
    control.setValue(control.value.includes(day) ? control.value.filter(value => value !== day) : [...control.value, day].sort());
  }
  applySuggestion(index: number, id: string): void {
    const suggestion = this.suggestions().find(row => row.idAten === Number(id));
    if (suggestion) this.form.controls.horarios.at(index).patchValue({ horaIni: suggestion.horaIni, horaFin: suggestion.horaFin });
  }
  cityNames(): string { return this.cities().map(city => city.nombre).join('\n'); }
  loadCities(): void {
    if (this.loadingCities()) return;
    this.loadingCities.set(true); this.cityError.set('');
    this.service.listar('ciudades', { offset: 0, limit: 100, q: '' }).pipe(
      expand(page => page.offset + page.items.length < page.total && page.items.length > 0
        ? this.service.listar('ciudades', { offset: page.offset + page.items.length, limit: 100, q: '' }) : EMPTY),
      reduce((cities, page) => [...cities, ...page.items as Ciudad[]], [] as Ciudad[]),
      takeUntilDestroyed(this.destroyRef), finalize(() => this.loadingCities.set(false)),
    ).subscribe({ next: cities => this.cities.set(cities.sort((a, b) => a.nombre.localeCompare(b.nombre))),
      error: () => { this.cities.set([]); this.cityError.set('No se pudieron cargar las ciudades. Inténtalo nuevamente.'); } });
  }
  readonly kind = input.required<Entidad>();
  readonly initial = input<Detalle | null>(null);
  readonly busy = input(false);
  readonly guardar = output<Alta | Cambios>();
  readonly error = signal('');
  readonly form = new FormGroup({
    horarios: new FormArray<FormGroup<{ horaIni: FormControl<string>; horaFin: FormControl<string>; dias: FormControl<number[]> }>>([]),
    nombre: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(50)] }),
    direccion: new FormControl('', { nonNullable: true }),
    idCiud: new FormControl<number | null>(null),
    estado: new FormControl<Estado>('activo', { nonNullable: true }),
  });
  ngOnChanges(changes: Record<string, unknown>): void {
    if (!changes['initial'] && !changes['kind']) return;
    if (changes['kind'] && this.kind() === 'sucursales') { this.loadCities(); this.loadSuggestions(); }
    const row = this.initial();
    this.form.controls.horarios.clear();
    if (row && esSucursal(row)) for (const range of row.horarios ?? []) this.addHours(range);
    if (this.kind() === 'sucursales' && (!row || !this.form.controls.horarios.length)) this.addHours();
    this.error.set('');
    this.form.reset({ nombre: row?.nombre ?? '',
      direccion: row && esSucursal(row) ? row.direccion : '', idCiud: row && esSucursal(row) ? row.idCiud : null,
      estado: row && esSucursal(row) ? row.estado : 'activo' });
  }
  addHours(range?: HorarioSucursal): void {
    this.form.controls.horarios.push(new FormGroup({
      dias: new FormControl(range?.dias ? [...range.dias] : range ? [1, 2, 3, 4, 5, 6, 7] : [], { nonNullable: true }),
      horaIni: new FormControl(range?.horaIni ?? '', { nonNullable: true, validators: [Validators.required] }),
      horaFin: new FormControl(range?.horaFin ?? '', { nonNullable: true, validators: [Validators.required] }),
    }));
  }
  enviar(): void {
    if (this.busy()) return;
    const value = this.form.getRawValue(); const row = this.initial();
    const nombre = value.nombre.trim(); const direccion = value.direccion.trim();
    if (!nombre || nombre.length > 50 ||
      (this.kind() === 'sucursales' && (!direccion || direccion.length > 100 || !entero(value.idCiud, -32768, 32767) || !['activo', 'inactivo'].includes(value.estado)))) {
      this.form.markAllAsTouched(); this.error.set('Completa el nombre (hasta 50 caracteres), la dirección (hasta 100) y selecciona una ciudad.'); return;
    }
    const body: Cambios = this.kind() === 'ciudades' ? { nombre }
      : { nombre, direccion, estado: value.estado, idCiud: value.idCiud! };
    if (this.kind() === 'sucursales') {
      const normalize = (time: string) => time.length === 5 ? time + ':00' : time;
      const configured = value.horarios.filter(h => h.horaIni || h.horaFin || h.dias.length);
      const ranges = configured.map(h => ({ horaIni: normalize(h.horaIni), horaFin: normalize(h.horaFin), dias: [...h.dias].sort() })).sort((a, b) => a.horaIni.localeCompare(b.horaIni));
      const validTime = /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?$/;
      if (ranges.length > 14 || ranges.some(h => !h.dias.length || !validTime.test(h.horaIni) || !validTime.test(h.horaFin) || h.horaIni >= h.horaFin)
        || ranges.some((h, i) => ranges.slice(i + 1).some(other => (h.horaIni === other.horaIni && h.horaFin === other.horaFin) || (h.dias.some(day => other.dias.includes(day)) && h.horaFin >= other.horaIni)))) {
        this.form.markAllAsTouched(); this.error.set('Selecciona días y completa apertura y cierre. Los rangos del mismo día no deben superponerse; el cierre debe ser posterior a la apertura.'); return;
      }
      const previous = row && esSucursal(row) ? (row.horarios ?? []).map(h => ({ horaIni: normalize(h.horaIni), horaFin: normalize(h.horaFin), dias: [...(h.dias ?? [1, 2, 3, 4, 5, 6, 7])].sort() })).sort((a, b) => a.horaIni.localeCompare(b.horaIni)) : [];
      if (JSON.stringify(ranges) !== JSON.stringify(previous)) body.horarios = ranges;
    }
    if (row) {
      const old: Cambios = esSucursal(row) ? row : { nombre: row.nombre };
      for (const key of ['nombre', 'direccion', 'estado', 'idCiud'] as const) if (body[key] === old[key]) delete body[key];
      if (!Object.keys(body).length) { this.error.set('No hay cambios para guardar.'); return; }
    }
    this.error.set('');
    if (this.kind() === 'sucursales' && (this.loadingCities() || !this.cities().some(city => city.id === value.idCiud))) {
      this.error.set('Selecciona una ciudad registrada.'); return;
    }
    this.guardar.emit(body);
  }
}
