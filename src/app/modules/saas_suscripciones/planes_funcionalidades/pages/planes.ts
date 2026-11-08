import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize, forkJoin, Observable } from 'rxjs';
import { API_BASE_URL } from '../../../../core/config/api.config';
import { AuthService } from '../../../seguridad-accesos/services/auth.service';

interface Feature { codigo: string; descripcion: string }
interface Plan { idPlan: number; nombre: string; maxSucursales: number; estado: 'activo' | 'inactivo'; funcionalidades: string[] }
interface Subscription { idSuscripcion: number; idEmpresa: number; empresa: string; version: number; maxSucursales: number; sucursalesActivas: number }
interface Draft { nombre: string; maxSucursales: number; estado: 'activo' | 'inactivo'; funcionalidades: string[] }
interface Impact { confirmacionImpacto: string; seleccionadas: number; conservanVersion: number }

@Component({
  selector: 'app-saas-planes',
  imports: [FormsModule],
  templateUrl: './planes.html',
  styleUrl: './planes.css',
})
export class SaasPlanesPage {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly base = `${inject(API_BASE_URL).replace(/\/$/, '')}/saas/planes`;
  readonly plans = signal<Plan[]>([]);
  readonly features = signal<Feature[]>([]);
  readonly subscriptions = signal<Subscription[]>([]);
  readonly loading = signal(false);
  readonly working = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly impact = signal<Impact | null>(null);
  readonly selected = signal<number[]>([]);
  editing: number | null = null;
  editorOpen = false;
  draft: Draft = this.empty();

  constructor() { this.load(); }
  private empty(): Draft { return { nombre: '', maxSucursales: 1, estado: 'activo', funcionalidades: [] }; }
  private message(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 503) return 'El servicio no está disponible. Comprueba que la configuración de versiones de planes esté habilitada.';
      if (error.status === 0) return 'No se pudo conectar con el servidor.';
      if (typeof error.error?.error?.message === 'string') return error.error.error.message;
    }
    return 'No se pudo completar la operación. Inténtalo de nuevo.';
  }
  load(): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({ plans: this.http.get<Plan[]>(this.base), features: this.http.get<Feature[]>(`${this.base}/funcionalidades`) })
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loading.set(false)))
      .subscribe({ next: result => { this.plans.set(result.plans); this.features.set(result.features); },
        error: error => this.error.set(this.message(error)) });
  }
  create(): void {
    this.editing = null; this.draft = this.empty(); this.subscriptions.set([]); this.selected.set([]);
    this.impact.set(null); this.error.set(''); this.notice.set(''); this.editorOpen = true;
  }
  edit(plan: Plan): void {
    if (plan.estado !== 'activo' || this.working()) return;
    this.editing = plan.idPlan;
    this.draft = { nombre: plan.nombre, maxSucursales: plan.maxSucursales, estado: plan.estado, funcionalidades: [...plan.funcionalidades] };
    this.editorOpen = true; this.selected.set([]); this.subscriptions.set([]); this.impact.set(null); this.error.set(''); this.notice.set('');
    this.working.set(true);
    this.http.get<Subscription[]>(`${this.base}/${plan.idPlan}/suscripciones`)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.working.set(false)))
      .subscribe({ next: rows => this.subscriptions.set(rows), error: error => { this.error.set(this.message(error)); this.editorOpen = false; } });
  }
  featureName(code: string): string { return this.features().find(item => item.codigo === code)?.descripcion ?? code; }
  toggleFeature(code: string, checked: boolean): void {
    this.draft.funcionalidades = checked ? [...this.draft.funcionalidades, code] : this.draft.funcionalidades.filter(value => value !== code);
    this.invalidate();
  }
  toggleSubscription(companyId: number, checked: boolean): void {
    const ids = this.subscriptions().filter(item => item.idEmpresa === companyId).map(item => item.idSuscripcion);
    this.selected.update(current => checked ? [...new Set([...current, ...ids])] : current.filter(value => !ids.includes(value)));
    this.invalidate();
  }
  invalidate(): void { this.impact.set(null); }
  private valid(): boolean {
    if (!this.draft.nombre.trim() || this.draft.nombre.trim().length > 30 || !Number.isInteger(this.draft.maxSucursales)
        || this.draft.maxSucursales < 1 || this.draft.maxSucursales > 32767) {
      this.error.set('Indica un nombre válido y un límite de sucursales entre 1 y 32767.'); return false;
    }
    return true;
  }
  private payload() { return { ...this.draft, nombre: this.draft.nombre.trim(), funcionalidades: [...this.draft.funcionalidades] }; }
  review(): void {
    if (this.working() || !this.valid()) return;
    this.error.set(''); this.working.set(true);
    const request: Observable<Plan | Impact> = this.editing === null ? this.http.post<Plan>(this.base, this.payload())
      : this.http.post<Impact>(`${this.base}/${this.editing}/impacto`, { ...this.payload(), suscripcionesSeleccionadas: this.selected() });
    request.pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.working.set(false))).subscribe({
      next: result => {
        if ('confirmacionImpacto' in result) this.impact.set(result);
        else { this.editorOpen = false; this.load(); this.notice.set('Plan creado correctamente.'); }
      }, error: error => this.error.set(this.message(error)),
    });
  }
  confirm(): void {
    const impact = this.impact();
    if (this.working() || this.editing === null || !impact || !this.valid()) return;
    this.error.set(''); this.working.set(true);
    this.http.put<Plan>(`${this.base}/${this.editing}`, { ...this.payload(), suscripcionesSeleccionadas: this.selected(), confirmacionImpacto: impact.confirmacionImpacto })
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.working.set(false)))
      .subscribe({ next: () => { this.editorOpen = false; this.impact.set(null); this.load(); this.notice.set('Plan actualizado. Las empresas no seleccionadas conservan su versión anterior.'); },
        error: error => { this.impact.set(null); this.error.set(this.message(error)); } });
  }
  back(): void { void this.router.navigateByUrl('/saas'); }
  logout(): void {
    this.auth.logout().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => void this.router.navigateByUrl('/saas/login'), error: error => this.error.set(this.message(error)),
    });
  }
}
