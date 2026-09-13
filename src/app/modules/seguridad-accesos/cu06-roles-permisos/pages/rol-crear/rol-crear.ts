import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { Cu06Layout } from '../../components/cu06-layout';
import { RolFormularioComponent } from '../../components/rol-formulario';
import { RolCrear, rolDetalleRuta } from '../../models/rol.models';
import { RolesService } from '../../services/roles.service';
import { accesoRechazado, rolError } from '../../services/rol-error';

@Component({ selector: 'app-rol-crear', imports: [Cu06Layout, RolFormularioComponent],
  template: `<app-cu06-layout title="Crear rol" [error]="error()">
    @if (!denied()) { <app-rol-formulario [busy]="busy()" (guardar)="guardar($event)" /> }
  </app-cu06-layout>`,
})
export class RolCrearPage {
  private readonly service = inject(RolesService);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  readonly busy = signal(false); readonly error = signal(''); readonly denied = signal(false);
  guardar(value: RolCrear): void {
    if (this.busy() || this.denied()) return;
    this.busy.set(true); this.error.set('');
    this.service.crear(value).pipe(takeUntilDestroyed(this.destroy), finalize(() => this.busy.set(false))).subscribe({
      next: rol => { void this.router.navigate(rolDetalleRuta(rol.nro)); },
      error: (error: unknown) => { this.error.set(rolError(error)); this.denied.set(accesoRechazado(error)); },
    });
  }
}
