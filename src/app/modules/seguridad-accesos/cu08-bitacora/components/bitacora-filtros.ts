import { Component, inject, output } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FieldError } from '../../components/field-error';
import { ACCIONES, BitacoraFiltros, esAccion } from '../models/bitacora.models';
import { microsegundosISO } from '../models/bitacora-fecha';

@Component({ selector: 'app-bitacora-filtros', imports: [ReactiveFormsModule, FieldError], templateUrl: './bitacora-filtros.html',
  styles: `.filters { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); } label { display: block; } input, select { width: 100%; box-sizing: border-box; } button { margin: 16px 0; }`,
})
export class BitacoraFiltrosComponent {
  readonly acciones = ACCIONES;
  readonly aplicar = output<BitacoraFiltros>();
  readonly form = inject(NonNullableFormBuilder).group({
    accion: ['', (c: AbstractControl) => c.value === '' || esAccion(c.value) ? null : { accion: true }],
    usuario_id: ['', Validators.maxLength(100)],
    desde: ['', isoValidator], hasta: ['', isoValidator],
    limit: [20, [Validators.required, Validators.min(1), Validators.max(100),
      (c: AbstractControl) => Number.isInteger(c.value) ? null : { integer: true }]],
  }, { validators: (group: AbstractControl) => {
    const from = microsegundosISO(group.get('desde')?.value), to = microsegundosISO(group.get('hasta')?.value);
    return from !== null && to !== null && from > to ? { rango: true } : null;
  } });
  enviar(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const value = this.form.getRawValue();
    this.aplicar.emit({ offset: 0, limit: value.limit,
      ...(esAccion(value.accion) ? { accion: value.accion } : {}),
      ...(value.usuario_id !== '' ? { usuario_id: value.usuario_id } : {}),
      ...(value.desde !== '' ? { desde: value.desde } : {}), ...(value.hasta !== '' ? { hasta: value.hasta } : {}),
    });
  }
}
function isoValidator(control: AbstractControl) {
  return control.value === '' || microsegundosISO(control.value) !== null ? null : { iso: true };
}
