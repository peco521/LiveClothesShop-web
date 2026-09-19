import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, Subscription } from 'rxjs';
import { Cu14Layout } from '../../components/cu14-layout';
import { EscenarioMock, MetodoPago } from '../../models/pago.models';
import { PagosService } from '../../services/pagos.service';
import { pagoError } from '../../services/pago-error';

@Component({ selector: 'app-pago', imports: [Cu14Layout, ReactiveFormsModule, RouterLink], templateUrl: './pago.html',
  styleUrls:['../../../shared/commerce.css','./pago.css'],
  styles: `.form-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; margin-bottom: 12px; } .sandbox { border: 1px dashed var(--line); border-radius: 8px; padding: 12px; margin: 12px 0; }`,
})
export class PagoPage {
  private readonly service = inject(PagosService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy = inject(DestroyRef);
  private request?: Subscription;
  readonly busy = signal(false); readonly error = signal('');
  private readonly document = inject(DOCUMENT);
  readonly config = signal<{ proveedor: 'mock' | 'stripe'; simulacion: boolean; disponible: boolean; moneda: string | null } | null>(null);
  readonly nroVenta = signal(0);
  readonly form = inject(NonNullableFormBuilder).group({
    metodo: ['tarjeta' as MetodoPago, Validators.required],
    escenario: ['aprobado' as EscenarioMock, Validators.required],
  });
  constructor() {
    this.service.configuracion().pipe(takeUntilDestroyed()).subscribe({
      next: value => { this.config.set(value); if (!value.disponible) this.error.set('La pasarela no está disponible.'); },
      error: () => this.error.set('No se pudo cargar la configuración de pago.'),
    });
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(params => {
      const nro = Number(params.get('nroVenta') ?? 0);
      this.nroVenta.set(Number.isInteger(nro) && nro >= 1 ? nro : 0);
    });
  }
  pagar(): void {
    if (this.form.invalid || !this.nroVenta() || this.busy() || !this.config()?.disponible) { this.form.markAllAsTouched(); return; }
    const value = this.form.getRawValue();
    this.busy.set(true); this.error.set('');
    this.request?.unsubscribe();
    this.request = this.service.pagar({ nroVenta: this.nroVenta(), metodo: this.config()?.proveedor === 'stripe' ? 'tarjeta' : value.metodo,
      ...(this.config()?.simulacion ? { escenario: value.escenario } : {}) })
      .pipe(takeUntilDestroyed(this.destroy), finalize(() => this.busy.set(false))).subscribe({
        next: ({ pago }) => {
          if (pago.checkoutUrl) {
            try {
              const url = new URL(pago.checkoutUrl);
              if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com') throw new Error();
              this.document.defaultView?.location.assign(url.href);
            } catch { this.error.set('La dirección de pago no es válida.'); }
          } else void this.router.navigate(['/tienda/pago', pago.idPago]);
        },
        error: (error: unknown) => this.error.set(pagoError(error)),
      });
  }
}
