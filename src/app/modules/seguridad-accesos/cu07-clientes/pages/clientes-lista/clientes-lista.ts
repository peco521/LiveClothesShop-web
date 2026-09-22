import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, Subscription } from 'rxjs';
import { Cu07Layout } from '../../components/cu07-layout';
import { ClienteCrear, ClienteDetalle, ClientesFiltros, ClientesListado } from '../../models/cliente.models';
import { ClientesService } from '../../services/clientes.service';
import { clienteError } from '../../services/cliente-error';
import { clienteNavigationParams } from '../../routes/cliente-navigation';

@Component({ selector: 'app-clientes-lista', imports: [Cu07Layout, FormsModule, ReactiveFormsModule, RouterLink], templateUrl: './clientes-lista.html',
  styles: `.table-scroll { overflow-x: auto; } table { width: 100%; border-collapse: collapse; } th, td { text-align: left; padding: 12px; border-bottom: 1px solid var(--line); } .actions { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; margin: 20px 0; }`,
})
export class ClientesListaPage {
  private readonly service = inject(ClientesService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy = inject(DestroyRef);
  private request?: Subscription;
  private query = '';
  private filters: ClientesFiltros = { offset: 0, limit: 20 };
  readonly busy = signal(false); readonly error = signal(''); readonly result = signal<ClientesListado | null>(null);
  // CU07: alta administrativa (no cambia la sesión) y baja lógica/reactivación.
  readonly registrando = signal(false);
  readonly busyId = signal('');
  readonly success = signal('');
  nuevo: ClienteCrear = { ci: '', nombres: '', apellidoPat: '', apellidoMat: '', sexo: 'F',
    correo: '', telefono: '', direccion: '', fechaNac: '', contrasena: '' };
  readonly form = inject(NonNullableFormBuilder).group({ q: ['', Validators.maxLength(100)],
    limit: [20, [Validators.required, Validators.min(1), Validators.max(100), (control: AbstractControl) => Number.isInteger(control.value) ? null : { integer: true }]] });
  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(params => {
      if (params.has('q')) {
        // Ignore legacy search URLs and replace the current entry; never restore q.
        void this.router.navigate([], { relativeTo: this.route, queryParams: clienteNavigationParams(params), replaceUrl: true });
        return;
      }
      const offset = Number(params.get('offset') ?? 0), limit = Number(params.get('limit') ?? 20);
      this.filters = { offset: Number.isSafeInteger(offset) && offset >= 0 ? offset : 0,
        limit: Number.isInteger(limit) && limit >= 1 && limit <= 100 ? limit : 20,
        q: this.query };
      this.form.reset({ q: this.filters.q ?? '', limit: this.filters.limit });
      this.load();
    });
  }
  get navigationParams() { return clienteNavigationParams(this.route.snapshot.queryParamMap); }
  aplicar(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const value = this.form.getRawValue();
    this.navigate({ offset: 0, limit: value.limit, q: value.q.trim() });
  }
  pagina(offset: number): void { if (!this.busy()) this.navigate({ ...this.filters, offset: Math.max(0, offset) }); }
  private navigate(filters: ClientesFiltros): void {
    if (JSON.stringify(filters) === JSON.stringify(this.filters)) { if (!this.busy()) this.load(); return; }
    this.query = filters.q ?? '';
    const samePage = filters.offset === this.filters.offset && filters.limit === this.filters.limit;
    if (samePage) { this.filters = filters; this.load(); return; }
    const queryParams = { offset: filters.offset, limit: filters.limit };
    void this.router.navigate([], { relativeTo: this.route, queryParams });
  }
  load(): void {
    this.request?.unsubscribe();
    this.busy.set(true); this.error.set(''); this.result.set(null);
    this.request = this.service.listar(this.filters).pipe(takeUntilDestroyed(this.destroy), finalize(() => this.busy.set(false))).subscribe({
      next: value => this.result.set(value), error: (error: unknown) => this.error.set(clienteError(error)),
    });
  }
  /** CU07: crea el cliente desde administración manteniendo la sesión actual. */
  registrar(): void {
    if (this.busy()) return;
    const data = this.nuevo;
    if (!data.ci.trim() || !data.nombres.trim() || !data.apellidoPat.trim() || !data.apellidoMat.trim()
        || !data.correo.trim() || !data.telefono.trim() || !data.direccion.trim() || !data.fechaNac
        || data.contrasena.length < 12) {
      this.error.set('Completa los datos del cliente (la contraseña debe tener al menos 12 caracteres).'); return;
    }
    this.busy.set(true); this.error.set(''); this.success.set('');
    this.service.crear(data).pipe(takeUntilDestroyed(this.destroy), finalize(() => this.busy.set(false))).subscribe({
      next: () => {
        this.nuevo = { ci: '', nombres: '', apellidoPat: '', apellidoMat: '', sexo: 'F',
          correo: '', telefono: '', direccion: '', fechaNac: '', contrasena: '' };
        this.registrando.set(false);
        this.success.set('Cliente registrado. Tu sesión de administrador no cambia.');
        this.load();
      },
      error: (error: unknown) => this.error.set(clienteError(error)),
    });
  }
  /** CU07: inactivo conserva historial, ventas y reservas; se puede reactivar. */
  cambiarEstado(user: ClienteDetalle): void {
    if (this.busy() || this.busyId()) return;
    this.busyId.set(user.idUsuario); this.error.set(''); this.success.set('');
    this.service.estadoCuenta(user.idUsuario, user.cliente.estado === 'inactivo').pipe(
      takeUntilDestroyed(this.destroy), finalize(() => this.busyId.set('')),
    ).subscribe({
      next: value => { this.success.set(value.cliente.estado === 'inactivo'
          ? 'Cliente desactivado: no podrá iniciar sesión y conserva su historial.'
          : 'Cliente reactivado.'); this.load(); },
      error: (error: unknown) => this.error.set(clienteError(error)),
    });
  }
}
