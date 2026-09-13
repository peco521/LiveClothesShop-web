import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, finalize, forkJoin, of, Subscription, switchMap, tap } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { Cu06Layout } from '../../components/cu06-layout';
import { PermisosSelectorComponent } from '../../components/permisos-selector';
import { FuncionDetalle, mismosPermisos, PermisosDetalle, RolDetalle } from '../../models/rol.models';
import { RolesService } from '../../services/roles.service';
import { accesoRechazado, rolError } from '../../services/rol-error';

@Component({ selector: 'app-rol-detalle', imports: [Cu06Layout, PermisosSelectorComponent, RouterLink],
  template: `<app-cu06-layout title="Detalle del rol" [error]="error()">
    @if (loading()) { <p role="status">Cargando rol y funciones…</p> }
    @if (success()) { <p class="notice success" role="status">{{ success() }}</p> }
    @if (warning()) { <p class="notice" role="alert">{{ warning() }} <a routerLink="/acceso">Verificar mi acceso</a></p> }
    @if (rol(); as current) {
      <h2>{{ current.nro }}</h2><p>{{ current.descripcion }}</p>
      <a [routerLink]="['/admin/roles', current.nro, 'editar']">Editar descripción</a>
      @if (permisos(); as assigned) { <app-permisos-selector [funciones]="funciones()" [actual]="assigned" [busy]="busy() || refreshFailed()" (guardar)="guardar($event)" /> }
    } @else if (!loading()) { <button (click)="load()">Reintentar consulta</button> }
  </app-cu06-layout>`,
})
export class RolDetallePage {
  private readonly service = inject(RolesService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy = inject(DestroyRef);
  private request?: Subscription; private mutation?: Subscription;
  readonly rol = signal<RolDetalle | null>(null);
  readonly permisos = signal<PermisosDetalle | null>(null);
  readonly funciones = signal<FuncionDetalle[]>([]);
  readonly loading = signal(false); readonly busy = signal(false); readonly error = signal('');
  readonly success = signal(''); readonly warning = signal(''); readonly refreshFailed = signal(false);
  constructor() { this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(() => this.load()); }
  load(): void {
    this.mutation?.unsubscribe(); this.request?.unsubscribe();
    this.rol.set(null); this.permisos.set(null); this.funciones.set([]); this.error.set('');
    this.success.set(''); this.warning.set(''); this.refreshFailed.set(false); this.loading.set(true);
    const nro = this.route.snapshot.paramMap.get('nro') ?? '';
    this.request = forkJoin({ rol: this.service.detalle(nro), permisos: this.service.permisos(nro), funciones: this.service.funciones() })
      .pipe(takeUntilDestroyed(this.destroy), finalize(() => this.loading.set(false))).subscribe({
        next: value => { this.rol.set(value.rol); this.permisos.set(value.permisos); this.funciones.set(value.funciones); },
        error: (error: unknown) => this.error.set(rolError(error)),
      });
  }
  guardar(ids: string[]): void {
    const current = this.permisos();
    if (!current || this.busy() || this.refreshFailed() || mismosPermisos(ids, current.permisos)) return;
    if ((current.esRolCliente && ids.length) || new Set(ids).size !== ids.length || ids.some(id => !this.funciones().some(f => f.id === id))) return;
    this.busy.set(true); this.error.set(''); this.success.set(''); this.warning.set('');
    this.mutation = this.service.reemplazarPermisos(current.nroRol, ids).pipe(
      tap(result => { this.permisos.set(result); this.success.set('Permisos guardados correctamente.'); }),
      // Only the refresh error is caught here: a confirmed PUT remains successful.
      switchMap(() => this.auth.restore().pipe(catchError(() => {
        this.refreshFailed.set(true);
        this.warning.set('El guardado fue confirmado, pero no se pudo verificar tu acceso actualizado. Verifica tu sesión antes de continuar.');
        return of(undefined);
      }))),
      takeUntilDestroyed(this.destroy), finalize(() => this.busy.set(false)),
    ).subscribe({
      next: session => {
        if (session === undefined) return;
        if (!session || !session.permisos.includes('CU06')) {
          this.rol.set(null); this.permisos.set(null); this.funciones.set([]);
          void this.router.navigate(['/acceso'], { queryParams: { motivo: session ? 'sin-permiso' : 'verificacion' } });
        }
      },
      error: (error: unknown) => {
        this.error.set(rolError(error));
        if (accesoRechazado(error)) { this.rol.set(null); this.permisos.set(null); this.funciones.set([]); }
      },
    });
  }
}
