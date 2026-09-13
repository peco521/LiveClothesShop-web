import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { Cu05Layout } from '../../components/cu05-layout';
import { EmpleadoFormularioComponent } from '../../components/empleado-formulario';
import { EmpleadoFormulario, EmpleadoOpciones } from '../../models/usuario.models';
import { UsuariosService } from '../../services/usuarios.service';
import { accesoRechazado, usuarioError } from '../../services/usuario-error';

@Component({ selector: 'app-empleado-crear', imports: [Cu05Layout, EmpleadoFormularioComponent],
  template: `<app-cu05-layout title="Crear empleado" [error]="error()">
    @if (loading()) { <p role="status">Cargando opciones…</p> }
    @if (opciones(); as options) { <app-empleado-formulario [opciones]="options" [busy]="busy()" (guardar)="guardar($event)" /> }
    @else if (!loading()) { <button (click)="load()">Reintentar carga de opciones</button> }
  </app-cu05-layout>`,
})
export class EmpleadoCrearPage {
  private readonly service = inject(UsuariosService);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  readonly opciones = signal<EmpleadoOpciones | null>(null);
  readonly loading = signal(false); readonly busy = signal(false); readonly error = signal('');
  constructor() { this.load(); }
  load(): void {
    if (this.loading()) return;
    this.loading.set(true); this.error.set('');
    this.service.opciones().pipe(takeUntilDestroyed(this.destroy), finalize(() => this.loading.set(false))).subscribe({
      next: value => this.opciones.set(value), error: (error: unknown) => this.error.set(usuarioError(error)),
    });
  }
  guardar(value: EmpleadoFormulario): void {
    if (this.busy() || value.contrasena === undefined) return;
    this.busy.set(true); this.error.set('');
    this.service.crear({ ...value, contrasena: value.contrasena }).pipe(takeUntilDestroyed(this.destroy), finalize(() => this.busy.set(false))).subscribe({
      next: user => { void this.router.navigate(['/admin/usuarios', user.idUsuario]); },
      error: (error: unknown) => { this.error.set(usuarioError(error)); if (accesoRechazado(error)) this.opciones.set(null); },
    });
  }
}
