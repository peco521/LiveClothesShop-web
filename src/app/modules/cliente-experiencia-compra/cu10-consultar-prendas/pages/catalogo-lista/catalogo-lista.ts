import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, forkJoin, Subscription } from 'rxjs';
import { Cu10Layout } from '../../components/cu10-layout';
import { CatalogoFiltros, FacetasListado, ProductosListado } from '../../models/catalogo.models';
import { CatalogoService } from '../../services/catalogo.service';
import { catalogoError } from '../../services/catalogo-error';

function integer(control: AbstractControl) { return Number.isInteger(control.value) ? null : { integer: true }; }

@Component({ selector: 'app-catalogo-lista', imports: [Cu10Layout, ReactiveFormsModule, RouterLink], templateUrl: './catalogo-lista.html',
  styles: `.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; margin: 20px 0; }
    .card { border: 1px solid var(--line); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
    .card img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 8px; background: #f4f4f4; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 999px; border: 1px solid var(--line); font-size: 0.85rem; }
    .actions { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; margin: 20px 0; }
    .form-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; margin-bottom: 12px; }`,
})
export class CatalogoListaPage {
  private readonly service = inject(CatalogoService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy = inject(DestroyRef);
  private request?: Subscription;
  private filters: CatalogoFiltros = { offset: 0, limit: 20, sort: 'nombre_asc' };
  readonly busy = signal(false); readonly error = signal(''); readonly result = signal<ProductosListado | null>(null);
  readonly facetas = signal<Record<string, FacetasListado>>({});
  readonly form = inject(NonNullableFormBuilder).group({
    q: ['', Validators.maxLength(100)], idCat: [''], idMarca: [''], idCol: [''], idTemp: [''], idTalla: [''], idColor: [''],
    minPrecio: [null as number | null, [Validators.min(0)]], maxPrecio: [null as number | null, [Validators.min(0)]],
    soloDisponibles: [false], sort: ['nombre_asc'],
    limit: [20, [Validators.required, Validators.min(1), Validators.max(100), integer]] });
  constructor() {
    forkJoin({ categorias: this.service.faceta('categorias'), marcas: this.service.faceta('marcas'),
      colecciones: this.service.faceta('colecciones'), temporadas: this.service.faceta('temporadas'),
      tallas: this.service.faceta('tallas'), colores: this.service.faceta('colores') })
      .pipe(takeUntilDestroyed()).subscribe({ next: value => this.facetas.set(value) });
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(params => {
      const offset = Number(params.get('offset') ?? 0), limit = Number(params.get('limit') ?? 20);
      this.filters = { ...this.filters, offset: Number.isSafeInteger(offset) && offset >= 0 ? offset : 0,
        limit: Number.isInteger(limit) && limit >= 1 && limit <= 100 ? limit : 20 };
      this.form.controls.limit.setValue(this.filters.limit);
      this.load();
    });
  }
  aplicar(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const value = this.form.getRawValue();
    const numbered = (raw: string): number | undefined => raw === '' ? undefined : Number(raw);
    this.filters = { offset: 0, limit: value.limit, q: value.q.trim() || undefined,
      idCat: numbered(value.idCat), idMarca: numbered(value.idMarca), idCol: numbered(value.idCol),
      idTemp: numbered(value.idTemp), idTalla: numbered(value.idTalla), idColor: numbered(value.idColor),
      minPrecio: value.minPrecio ?? undefined, maxPrecio: value.maxPrecio ?? undefined,
      soloDisponibles: value.soloDisponibles || undefined, sort: value.sort as CatalogoFiltros['sort'] };
    this.load();
  }
  limpiar(): void {
    this.form.reset({ q: '', idCat: '', idMarca: '', idCol: '', idTemp: '', idTalla: '', idColor: '',
      minPrecio: null, maxPrecio: null, soloDisponibles: false, sort: 'nombre_asc', limit: this.filters.limit });
    this.filters = { offset: 0, limit: this.filters.limit, sort: 'nombre_asc' };
    this.load();
  }
  pagina(offset: number): void {
    if (this.busy()) return;
    void this.router.navigate([], { relativeTo: this.route, queryParams: { offset: Math.max(0, offset), limit: this.filters.limit } });
  }
  load(): void {
    this.request?.unsubscribe();
    this.busy.set(true); this.error.set(''); this.result.set(null);
    this.request = this.service.listar(this.filters).pipe(takeUntilDestroyed(this.destroy), finalize(() => this.busy.set(false))).subscribe({
      next: value => this.result.set(value), error: (error: unknown) => this.error.set(catalogoError(error)),
    });
  }
}
