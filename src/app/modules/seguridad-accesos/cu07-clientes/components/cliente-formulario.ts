import { Component, effect, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FieldError } from '../../components/field-error';
import { normalizedEmail, notBlank, pastDate } from '../../models/auth.validation';
import { ClienteDetalle, ClienteEditar } from '../models/cliente.models';

@Component({ selector: 'app-cliente-formulario', imports: [ReactiveFormsModule, FieldError], templateUrl: './cliente-formulario.html' })
export class ClienteFormularioComponent {
  readonly cliente = input.required<ClienteDetalle>();
  readonly busy = input(false);
  readonly guardar = output<ClienteEditar>();
  readonly notice = signal('');
  private readonly fb = inject(NonNullableFormBuilder);
  readonly form = this.fb.group({
    ci: ['', [notBlank, Validators.maxLength(100)]], nombres: ['', Validators.maxLength(100)],
    apellidoPat: ['', [notBlank, Validators.maxLength(50)]], apellidoMat: ['', [notBlank, Validators.maxLength(50)]],
    sexo: ['' as '' | 'M' | 'F', Validators.required], correo: ['', [notBlank, normalizedEmail, Validators.maxLength(100)]],
    telefono: ['', [notBlank, Validators.maxLength(20)]], direccion: ['', [notBlank, Validators.maxLength(150)]],
    fechaNac: ['', [Validators.required, pastDate]],
  });
  readonly fields = [
    { name: 'ci', label: 'CI', type: 'text', max: 100 }, { name: 'nombres', label: 'Nombres', type: 'text', max: 100 },
    { name: 'apellidoPat', label: 'Apellido paterno', type: 'text', max: 50 }, { name: 'apellidoMat', label: 'Apellido materno', type: 'text', max: 50 },
    { name: 'correo', label: 'Correo electrónico', type: 'email', max: 100 }, { name: 'telefono', label: 'Teléfono', type: 'text', max: 20 },
    { name: 'direccion', label: 'Dirección', type: 'text', max: 150 }, { name: 'fechaNac', label: 'Fecha de nacimiento', type: 'date', max: null },
  ] as const;
  constructor() {
    effect(() => {
      const user = this.cliente();
      this.form.reset({ ci: user.ci, nombres: user.nombres ?? '', apellidoPat: user.apellidoPat, apellidoMat: user.apellidoMat,
        sexo: user.sexo, correo: user.correo, telefono: user.telefono, direccion: user.direccion, fechaNac: user.fechaNac });
      this.form.controls.nombres.setValidators(user.nombres === null ? [Validators.maxLength(100)] : [notBlank, Validators.maxLength(100)]);
      this.form.controls.nombres.updateValueAndValidity();
      this.notice.set('');
    });
  }
  submit(): void {
    if (this.busy()) return;
    this.notice.set('');
    const value = this.form.getRawValue();
    if (this.form.invalid || (value.sexo !== 'M' && value.sexo !== 'F')) { this.form.markAllAsTouched(); return; }
    const original = this.cliente();
    const body: ClienteEditar = {};
    for (const field of this.fields) {
      const key = field.name;
      // Do not normalize untouched historical values as a side effect of another edit.
      if (value[key] === (original[key] ?? '')) continue;
      const current = key === 'correo' ? value[key].trim().toLowerCase() : value[key].trim();
      // A blank historical null name is unchanged, not an instruction to write "" or null.
      if (key === 'nombres' && original.nombres === null && !current) continue;
      if (current !== original[key]) body[key] = current;
    }
    if (value.sexo !== original.sexo) body.sexo = value.sexo;
    if (!Object.keys(body).length) { this.notice.set('No hay cambios para guardar.'); return; }
    this.guardar.emit(body);
  }
}
