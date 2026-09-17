import { Component, computed, effect, inject, input, output } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FieldError } from '../../components/field-error';
import { normalizedEmail, notBlank, pastDate } from '../../models/auth.validation';
import { EmpleadoFormulario, EmpleadoOpciones, UsuarioDetalle } from '../models/usuario.models';

@Component({
  selector: 'app-empleado-formulario', imports: [ReactiveFormsModule, FieldError],
  templateUrl: './empleado-formulario.html',
})
export class EmpleadoFormularioComponent {
  readonly usuario = input<UsuarioDetalle | null>(null);
  readonly opciones = input.required<EmpleadoOpciones>();
  readonly busy = input(false);
  readonly guardar = output<EmpleadoFormulario>();
  readonly editando = computed(() => this.usuario() !== null);
  private readonly fb = inject(NonNullableFormBuilder);
  readonly form = this.fb.group({
    ci: ['', [notBlank, Validators.maxLength(100)]], nombres: ['', [notBlank, Validators.maxLength(100)]],
    apellidoPat: ['', [notBlank, Validators.maxLength(50)]], apellidoMat: ['', [notBlank, Validators.maxLength(50)]],
    sexo: ['' as '' | 'M' | 'F', Validators.required], correo: ['', [notBlank, normalizedEmail, Validators.maxLength(100)]],
    telefono: ['', [notBlank, Validators.maxLength(20)]], direccion: ['', [notBlank, Validators.maxLength(150)]],
    fechaNac: ['', [Validators.required, pastDate]], nroRol: ['', [notBlank, Validators.maxLength(15)]],
    cargo: ['', [notBlank, Validators.maxLength(50)]],
    nroSuc: this.fb.control<number | null>(null, Validators.required),
    ciudad: this.fb.control<number | null>(null), contrasena: [''],
  });
  readonly fields = [
    { name: 'ci', label: 'CI', type: 'text', max: 100 }, { name: 'nombres', label: 'Nombres', type: 'text', max: 100 },
    { name: 'apellidoPat', label: 'Apellido paterno', type: 'text', max: 50 }, { name: 'apellidoMat', label: 'Apellido materno', type: 'text', max: 50 },
    { name: 'correo', label: 'Correo electrónico', type: 'email', max: 100 }, { name: 'telefono', label: 'Teléfono', type: 'text', max: 20 },
    { name: 'direccion', label: 'Dirección', type: 'text', max: 150 }, { name: 'fechaNac', label: 'Fecha de nacimiento', type: 'date', max: null },
    { name: 'cargo', label: 'Cargo', type: 'text', max: 50 },
  ] as const;

  constructor() {
    effect(() => {
      const user = this.usuario();
      if (user?.empleado) {
        this.form.patchValue({ ci: user.ci, nombres: user.nombres ?? '', apellidoPat: user.apellidoPat,
          apellidoMat: user.apellidoMat, sexo: user.sexo, correo: user.correo, telefono: user.telefono,
          direccion: user.direccion, fechaNac: user.fechaNac, nroRol: user.nroRol,
          cargo: user.empleado.cargo, nroSuc: user.empleado.nroSuc });
      }
      this.form.controls.contrasena.setValidators(user ? [] : [notBlank, Validators.minLength(12), Validators.maxLength(128)]);
      this.form.controls.contrasena.reset();
    });
  }

  sucursalesVisibles() {
    const city = this.form.controls.ciudad.value;
    return this.opciones().sucursales.filter(branch => city === null || branch.idCiud === city);
  }
  cambiarCiudad(): void {
    if (!this.sucursalesVisibles().some(branch => branch.nro === this.form.controls.nroSuc.value)) this.form.controls.nroSuc.reset();
  }
  submit(): void {
    if (this.busy()) return;
    const value = this.form.getRawValue();
    if (!this.opciones().roles.some(role => role.nro === value.nroRol)) this.form.controls.nroRol.setErrors({ opcion: true });
    if (!this.opciones().sucursales.some(branch => branch.nro === value.nroSuc)) this.form.controls.nroSuc.setErrors({ opcion: true });
    if (this.form.invalid || (value.sexo !== 'M' && value.sexo !== 'F') || value.nroSuc === null) {
      this.form.markAllAsTouched(); return;
    }
    const body: EmpleadoFormulario = { ci: value.ci, nombres: value.nombres, apellidoPat: value.apellidoPat,
      apellidoMat: value.apellidoMat, sexo: value.sexo, correo: value.correo, telefono: value.telefono,
      direccion: value.direccion, fechaNac: value.fechaNac, nroRol: value.nroRol,
      cargo: value.cargo, nroSuc: value.nroSuc, ...(!this.editando() ? { contrasena: value.contrasena } : {}) };
    this.guardar.emit(body);
    this.form.controls.contrasena.reset();
  }
}
