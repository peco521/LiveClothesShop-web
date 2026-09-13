import { Component, input, OnChanges, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Alta, Cambios, Detalle, Entidad, entero, esSucursal, Estado } from '../models/organizacion.models';

@Component({
  selector: 'app-organizacion-formulario', imports: [ReactiveFormsModule, RouterLink],
  template: `
    <form [formGroup]="form" (ngSubmit)="enviar()">
      <fieldset [disabled]="busy()">
        @if (kind() === 'ciudades' && !initial()) {
          <div class="field"><label for="ciudad-id">Identificador de ciudad</label>
            <input id="ciudad-id" type="number" step="1" min="-32768" max="32767" formControlName="id" required>
            <span class="hint">Entero entre -32768 y 32767. No se genera automáticamente.</span></div>
        }
        <div class="field"><label for="org-nombre">Nombre</label>
          <input id="org-nombre" formControlName="nombre" maxlength="50" required></div>
        @if (kind() === 'sucursales') {
          <div class="field"><label for="org-direccion">Dirección</label>
            <input id="org-direccion" formControlName="direccion" maxlength="100" required></div>
          <div class="field"><label for="org-ciudad">Identificador de ciudad</label>
            <input id="org-ciudad" type="number" step="1" min="-32768" max="32767" formControlName="idCiud" required>
            <span class="hint">Debe existir. <a routerLink="/admin/ciudades">Consultar ciudades</a>.</span></div>
          <div class="field"><label for="org-estado">Estado</label>
            <select id="org-estado" formControlName="estado"><option value="activo">activo</option><option value="inactivo">inactivo</option></select>
            <span class="hint">No elimina la sucursal ni modifica empleados, inventario, ventas u horarios.</span></div>
        }
        @if (error()) { <p class="notice error" role="alert">{{ error() }}</p> }
        <button class="button primary" type="submit" [disabled]="busy()">{{ busy() ? 'Guardando…' : 'Guardar' }}</button>
      </fieldset>
    </form>`,
})
export class OrganizacionFormulario implements OnChanges {
  readonly kind = input.required<Entidad>();
  readonly initial = input<Detalle | null>(null);
  readonly busy = input(false);
  readonly guardar = output<Alta | Cambios>();
  readonly error = signal('');
  readonly form = new FormGroup({
    id: new FormControl<number | null>(null),
    nombre: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(50)] }),
    direccion: new FormControl('', { nonNullable: true }),
    idCiud: new FormControl<number | null>(null),
    estado: new FormControl<Estado>('activo', { nonNullable: true }),
  });
  ngOnChanges(changes: Record<string, unknown>): void {
    if (!changes['initial'] && !changes['kind']) return;
    const row = this.initial();
    this.error.set('');
    this.form.reset({ id: row && !esSucursal(row) ? row.id : null, nombre: row?.nombre ?? '',
      direccion: row && esSucursal(row) ? row.direccion : '', idCiud: row && esSucursal(row) ? row.idCiud : null,
      estado: row && esSucursal(row) ? row.estado : 'activo' });
  }
  enviar(): void {
    if (this.busy()) return;
    const value = this.form.getRawValue(); const row = this.initial();
    const nombre = value.nombre.trim(); const direccion = value.direccion.trim();
    if (!nombre || nombre.length > 50 ||
      (this.kind() === 'ciudades' && !row && !entero(value.id, -32768, 32767)) ||
      (this.kind() === 'sucursales' && (!direccion || direccion.length > 100 || !entero(value.idCiud, -32768, 32767) || !['activo', 'inactivo'].includes(value.estado)))) {
      this.form.markAllAsTouched(); this.error.set('Completa los campos: nombre hasta 50 caracteres, dirección hasta 100 e identificadores enteros válidos.'); return;
    }
    const body: Cambios = this.kind() === 'ciudades' ? { nombre }
      : { nombre, direccion, estado: value.estado, idCiud: value.idCiud! };
    if (row) {
      const old: Cambios = esSucursal(row) ? row : { nombre: row.nombre };
      for (const key of ['nombre', 'direccion', 'estado', 'idCiud'] as const) if (body[key] === old[key]) delete body[key];
      if (!Object.keys(body).length) { this.error.set('No hay cambios para guardar.'); return; }
    }
    this.error.set('');
    this.guardar.emit(!row && this.kind() === 'ciudades' ? { id: value.id!, nombre } : body);
  }
}
