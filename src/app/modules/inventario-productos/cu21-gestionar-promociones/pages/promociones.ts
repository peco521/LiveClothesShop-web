import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { InventarioPanel, requestError } from '../../shared/panel';
import { OperacionesService } from '../../shared/operaciones.service';
import { Promotion, PromotionData, PromotionForm } from '../../shared/operaciones.models';
import { Page } from '../../shared/models';
import { ProductosListado } from '../../../cliente-experiencia-compra/cu10-consultar-prendas/models/catalogo.models';

@Component({ selector: 'app-promociones', imports: [FormsModule, DatePipe, InventarioPanel],
  templateUrl: './promociones.html', styleUrls: ['../../shared/panel.css', '../../shared/operaciones.css'] })
export class PromocionesPage {
  private readonly service = inject(OperacionesService);
  private readonly destroy = inject(DestroyRef);
  private readonly router = inject(Router);
  readonly page = signal<Page<Promotion> | null>(null);
  readonly products = signal<ProductosListado | null>(null);
  readonly busy = signal(false);
  readonly saving = signal(false);
  readonly editor = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  q = '';
  productQ = '';
  promotionId: number | null = null;
  promotion: PromotionForm = { nombre: '', descripcion: '', tipoDescuento: 'porcentaje', valorDescuento: 10, fechaIni: '', fechaFin: '' };
  selectedProducts: string[] = [];

  constructor() { this.load(); this.searchProducts(); }

  load(offset = 0): void {
    if (this.busy()) return;
    this.busy.set(true); this.error.set('');
    this.service.get<Page<Promotion>>('promociones', { q: this.q.trim(), offset, limit: 20 })
      .pipe(takeUntilDestroyed(this.destroy), finalize(() => this.busy.set(false)))
      .subscribe({ next: r => this.page.set(r), error: e => { this.page.set(null); this.error.set(requestError(e, this.router)); } });
  }

  newPromotion(row?: Promotion): void {
    if (this.saving()) return;
    this.editor.set(true); this.error.set(''); this.success.set('');
    this.promotionId = row?.idPromo ?? null;
    this.selectedProducts = row ? [...row.productos] : [];
    this.promotion = row
      ? { nombre: row.nombre, descripcion: row.descripcion, tipoDescuento: row.tipoDescuento,
          valorDescuento: Number(row.valorDescuento), fechaIni: row.fechaIni, fechaFin: row.fechaFin }
      : { nombre: '', descripcion: '', tipoDescuento: 'porcentaje', valorDescuento: 10, fechaIni: '', fechaFin: '' };
  }

  closeEditor(): void { if (!this.saving()) { this.editor.set(false); this.error.set(''); } }

  savePromotion(form: NgForm): void {
    if (this.saving()) return;
    if (form.invalid) { form.form.markAllAsTouched(); return; }
    if (this.promotion.fechaFin <= this.promotion.fechaIni) { this.error.set('La fecha de fin debe ser posterior a la fecha de inicio.'); return; }
    if (this.promotion.tipoDescuento === 'porcentaje' && Number(this.promotion.valorDescuento) > 100) { this.error.set('El porcentaje no puede superar 100.'); return; }
    if (!this.selectedProducts.length) { this.error.set('Selecciona al menos una prenda en el catálogo.'); return; }
    const body: PromotionData = { ...this.promotion, valorDescuento: Number(this.promotion.valorDescuento), productos: [...this.selectedProducts] };
    this.saving.set(true); this.error.set(''); this.success.set('');
    const request = this.promotionId ? this.service.send<Promotion>(`promociones/${this.promotionId}`, body, 'PUT') : this.service.send<Promotion>('promociones', body);
    request.pipe(takeUntilDestroyed(this.destroy), finalize(() => this.saving.set(false))).subscribe({
      next: () => { this.editor.set(false); this.success.set('Promoción guardada correctamente.'); this.load(); },
      error: e => this.error.set(requestError(e, this.router)),
    });
  }

  deactivate(row: Promotion): void {
    if (this.saving()) return;
    if (!window.confirm(`¿Desactivar la promoción "${row.nombre}"?`)) return;
    this.saving.set(true); this.error.set(''); this.success.set('');
    this.service.send<Promotion>(`promociones/${row.idPromo}/desactivar`)
      .pipe(takeUntilDestroyed(this.destroy), finalize(() => this.saving.set(false))).subscribe({
        next: () => { this.success.set('Promoción desactivada.'); this.load(); },
        error: e => this.error.set(requestError(e, this.router)),
      });
  }

  toggleProduct(id: string): void {
    const index = this.selectedProducts.indexOf(id);
    if (index >= 0) this.selectedProducts.splice(index, 1); else this.selectedProducts.push(id);
  }

  searchProducts(offset = 0): void {
    this.service.get<ProductosListado>('promociones/productos', { q: this.productQ.trim(), offset, limit: 12 })
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: r => this.products.set(r),
        error: e => { this.products.set(null); this.error.set(requestError(e, this.router)); },
      });
  }

  invalid(form: NgForm, name: string): boolean {
    const control = form.controls[name];
    return !!control && control.invalid && (control.touched || control.dirty);
  }
}
