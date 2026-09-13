import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, forkJoin, Subscription } from 'rxjs';
import { Cu05Layout } from '../../components/cu05-layout';
import { EmpleadoFormularioComponent } from '../../components/empleado-formulario';
import { EmpleadoFormulario, EmpleadoOpciones, UsuarioDetalle } from '../../models/usuario.models';
import { UsuariosService } from '../../services/usuarios.service';
import { accesoRechazado, usuarioError } from '../../services/usuario-error';

@Component({ selector: 'app-empleado-editar', imports: [Cu05Layout, EmpleadoFormularioComponent],
  template: `<app-cu05-layout title="Editar empleado" [error]="error()">
    @if (loading()) { <p role="status">Cargando empleado…</p> }
    @if (usuario(); as user) {
      @if (opciones(); as options) { <app-empleado-formulario [usuario]="user" [opciones]="options" [busy]="busy()" (guardar)="guardar($event)" /> }
    } @else if (!loading()) { <button (click)="load()">Reintentar</button> }
  </app-cu05-layout>`,
})
export class EmpleadoEditarPage {
  private readonly service = inject(UsuariosService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy = inject(DestroyRef);
  private request?: Subscription;
  private mutation?: Subscription;
  readonly usuario = signal<UsuarioDetalle | null>(null);
  readonly opciones = signal<EmpleadoOpciones | null>(null);
  readonly loading = signal(false); readonly busy = signal(false); readonly error = signal('');
  constructor() { this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(() => this.load()); }
  load(): void {
    this.mutation?.unsubscribe();
    this.request?.unsubscribe(); this.usuario.set(null); this.opciones.set(null); this.error.set(''); this.loading.set(true);
    const id = this.route.snapshot.paramMap.get('idUsuario') ?? '';
    this.request = forkJoin({ user: this.service.detalle(id), options: this.service.opciones() }).pipe(
      takeUntilDestroyed(this.destroy), finalize(() => this.loading.set(false)),
    ).subscribe({ next: ({ user, options }) => {
      if (user.tipo !== 'E' || !user.empleado) { this.error.set('Solo se pueden editar empleados desde esta pantalla.'); return; }
      this.usuario.set(user); this.opciones.set(options);
    }, error: (error: unknown) => this.error.set(usuarioError(error)) });
  }
  guardar(value: EmpleadoFormulario): void {
    const user = this.usuario(); if (!user || this.busy()) return;
    this.busy.set(true); this.error.set('');
    this.mutation = this.service.editar(user.idUsuario, value).pipe(takeUntilDestroyed(this.destroy), finalize(() => this.busy.set(false))).subscribe({
      next: result => { void this.router.navigate(['/admin/usuarios', result.idUsuario]); },
      error: (error: unknown) => { this.error.set(usuarioError(error)); if (accesoRechazado(error)) this.usuario.set(null); },
    });
  }
}
