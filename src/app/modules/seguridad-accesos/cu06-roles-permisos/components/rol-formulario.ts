import { Component, effect, inject, input, output } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { FieldError } from '../../components/field-error';
import { notBlank } from '../../models/auth.validation';
import { RolCrear, RolDetalle } from '../models/rol.models';

function identifier(control: AbstractControl) {
  const value = String(control.value);
  return value !== value.trim() || ['.', '..'].includes(value) || /[/\\%?#\p{C}]/u.test(value) ? { identifier: true } : null;
}

function maxCharacters(limit: number) {
  // PostgreSQL/Pydantic count Unicode code points, not JS UTF-16 code units.
  return (control: AbstractControl) => {
    const length = Array.from(String(control.value)).length;
    return length > limit ? { maxlength: { requiredLength: limit, actualLength: length } } : null;
  };
}

@Component({ selector: 'app-rol-formulario', imports: [ReactiveFormsModule, FieldError],
  template: `<form [formGroup]="form" (ngSubmit)="submit()">
    <label for="rol-nro">Identificador</label>
    <input id="rol-nro" formControlName="nro" [readOnly]="!!rol()" aria-describedby="rol-nro-error rol-nro-help" />
    <small id="rol-nro-help">Máximo 15 caracteres. No se puede cambiar después de crear el rol.</small>
    <app-field-error [control]="form.controls.nro" errorId="rol-nro-error" />
    <label for="rol-descripcion">Descripción</label>
    <input id="rol-descripcion" formControlName="descripcion" aria-describedby="rol-descripcion-error rol-descripcion-help" />
    <small id="rol-descripcion-help">Máximo 50 caracteres.</small>
    <app-field-error [control]="form.controls.descripcion" errorId="rol-descripcion-error" />
    @if (rol() && !cambio()) { <p role="status">No hay cambios en la descripción.</p> }
    <button class="button primary" type="submit" [disabled]="busy() || (!!rol() && !cambio())">{{ busy() ? 'Guardando…' : 'Guardar rol' }}</button>
  </form>`,
  styles: `form { display: grid; gap: 10px; max-width: 560px; } input { width: 100%; padding: 10px; box-sizing: border-box; }`,
})
export class RolFormularioComponent {
  readonly rol = input<RolDetalle | null>(null);
  readonly busy = input(false);
  readonly guardar = output<RolCrear>();
  private readonly fb = inject(NonNullableFormBuilder);
  readonly form = this.fb.group({
    nro: ['', [notBlank, maxCharacters(15), identifier]],
    descripcion: ['', [notBlank, maxCharacters(50)]],
  });
  constructor() { effect(() => { const rol = this.rol(); this.form.reset(rol ? { nro: rol.nro, descripcion: rol.descripcion } : { nro: '', descripcion: '' }); }); }
  cambio(): boolean { return this.form.controls.descripcion.value.trim() !== this.rol()?.descripcion; }
  submit(): void {
    if (this.busy()) return;
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    if (this.rol() && !this.cambio()) return;
    this.guardar.emit({ nro: this.rol()?.nro ?? this.form.controls.nro.value, descripcion: this.form.controls.descripcion.value.trim() });
  }
}
