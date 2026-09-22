import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../../seguridad-accesos/services/auth.service';
import { InventarioPanel, requestError } from '../../shared/panel';
import { OperacionesService } from '../../shared/operaciones.service';
import { Policy, PolicyData } from '../../shared/operaciones.models';
import { ProductoDetalle, ProductosListado } from '../../../cliente-experiencia-compra/cu10-consultar-prendas/models/catalogo.models';

@Component({ selector: 'app-politicas-devolucion', imports: [FormsModule, InventarioPanel],
  templateUrl: './politicas.html', styleUrls: ['../../shared/panel.css', '../../shared/operaciones.css'] })
export class PoliticasPage {
  private readonly service = inject(OperacionesService);
  private readonly destroy = inject(DestroyRef);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);
  readonly policies = signal<Policy[]>([]);
  readonly products = signal<ProductosListado | null>(null);
  readonly product = signal<ProductoDetalle | null>(null);
  readonly busy = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  productQ = '';
  policy: PolicyData = { idProd: '', idVar: null, dias: 0, porcentaje: 0 };

  constructor() { this.load(); this.searchProducts(); }

  isAdmin(): boolean { return this.auth.session()?.usuario.tipo === 'A'; }

  load(): void {
    if (this.busy()) return;
    this.busy.set(true); this.error.set('');
    this.service.get<Policy[]>('devoluciones/politicas')
      .pipe(takeUntilDestroyed(this.destroy), finalize(() => this.busy.set(false)))
      .subscribe({ next: rows => this.policies.set(rows), error: e => { this.policies.set([]); this.error.set(requestError(e, this.router)); } });
  }

  searchProducts(offset = 0): void {
    this.service.get<ProductosListado>('devoluciones/productos', { q: this.productQ.trim(), offset, limit: 12 })
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: rows => this.products.set(rows),
        error: e => { this.products.set(null); this.error.set(requestError(e, this.router)); },
      });
  }

  selectProduct(idProd: string): void {
    this.error.set(''); this.success.set('');
    this.service.get<ProductoDetalle>(`devoluciones/productos/${encodeURIComponent(idProd)}`)
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: value => { this.product.set(value); this.policy = { idProd: value.idProd, idVar: null, dias: 0, porcentaje: 0 }; },
        error: e => this.error.set(requestError(e, this.router)),
      });
  }

  clearProduct(): void { if (!this.saving()) { this.product.set(null); this.policy = { idProd: '', idVar: null, dias: 0, porcentaje: 0 }; } }

  savePolicy(form: NgForm): void {
    if (this.saving()) return;
    if (form.invalid) { form.form.markAllAsTouched(); return; }
    if (!this.policy.idProd) { this.error.set('Selecciona la prenda a la que aplica la política.'); return; }
    const dias = Number(this.policy.dias); const porcentaje = Number(this.policy.porcentaje);
    if (!Number.isInteger(dias) || dias < 1) { this.error.set('El plazo debe ser de al menos un día.'); return; }
    if (!(porcentaje > 0) || porcentaje > 100) { this.error.set('El porcentaje debe ser mayor que cero y como máximo 100.'); return; }
    const body: PolicyData = { idProd: this.policy.idProd, idVar: this.policy.idVar, dias, porcentaje };
    this.saving.set(true); this.error.set(''); this.success.set('');
    this.service.send<Policy>('devoluciones/politicas', body, 'PUT')
      .pipe(takeUntilDestroyed(this.destroy), finalize(() => this.saving.set(false))).subscribe({
        next: () => { this.success.set('Política de devolución guardada correctamente.'); this.load(); },
        error: e => this.error.set(requestError(e, this.router)),
      });
  }

  invalid(form: NgForm, name: string): boolean {
    const control = form.controls[name];
    return !!control && control.invalid && (control.touched || control.dirty);
  }
}
