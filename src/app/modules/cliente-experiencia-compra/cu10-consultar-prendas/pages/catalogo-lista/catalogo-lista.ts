import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, forkJoin, Subscription } from 'rxjs';
import { Cu10Layout } from '../../components/cu10-layout';
import { CatalogoFiltros, FacetaItem, FacetasListado, ProductosListado } from '../../models/catalogo.models';
import { CatalogoService } from '../../services/catalogo.service';
import { catalogoError } from '../../services/catalogo-error';

function integer(control: AbstractControl) { return Number.isInteger(control.value) ? null : { integer: true }; }

@Component({ selector: 'app-catalogo-lista', imports: [Cu10Layout, ReactiveFormsModule, RouterLink], templateUrl: './catalogo-lista.html',
  styleUrl: './catalogo-lista.css',
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
  readonly categoriesOpen = signal(false);
  readonly advancedOpen = signal(false);
  readonly activeCategory = signal<FacetaItem | null>(null);
  readonly preview = signal<{ brands: FacetasListado; products: ProductosListado } | null>(null);
  readonly previewBusy = signal(false);
  readonly previewError = signal('');
  readonly facetsError = signal('');
  private previewRequest?: Subscription;
  private readonly previewCache = new Map<number, { brands: FacetasListado; products: ProductosListado }>();
  readonly form = inject(NonNullableFormBuilder).group({
    q: ['', Validators.maxLength(100)], idCat: [''], idMarca: [''], idCol: [''], idTemp: [''], idTalla: [''], idColor: [''],
    minPrecio: [null as number | null, [Validators.min(0)]], maxPrecio: [null as number | null, [Validators.min(0)]],
    soloDisponibles: [false], sort: ['nombre_asc'],
    limit: [20, [Validators.required, Validators.min(1), Validators.max(100), integer]] });
  constructor() {
    forkJoin({ categorias: this.service.faceta('categorias'), marcas: this.service.faceta('marcas'),
      colecciones: this.service.faceta('colecciones'), temporadas: this.service.faceta('temporadas'),
      tallas: this.service.faceta('tallas'), colores: this.service.faceta('colores') })
      .pipe(takeUntilDestroyed()).subscribe({ next: value => this.facetas.set(value),
        error: () => this.facetsError.set('No pudimos cargar las categorías. Recarga la página para intentarlo de nuevo.') });
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(params => {
      const offset = Number(params.get('offset') ?? 0), limit = Number(params.get('limit') ?? 20);
      this.filters = { ...this.filters, offset: Number.isSafeInteger(offset) && offset >= 0 ? offset : 0,
        limit: Number.isInteger(limit) && limit >= 1 && limit <= 100 ? limit : 20 };
      this.form.controls.limit.setValue(this.filters.limit);
      this.load();
    });
  }
  openCategories(): void {
    this.categoriesOpen.set(true);
    const first = this.facetas()['categorias']?.items[0];
    if (!this.activeCategory() && first) this.explore(first);
  }
  toggleCategories(): void {
    if (this.categoriesOpen()) this.categoriesOpen.set(false);
    else this.openCategories();
  }
  explore(category: FacetaItem, retry = false): void {
    if (!retry && this.activeCategory()?.id === category.id && (this.preview() || this.previewBusy())) return;
    this.previewRequest?.unsubscribe();
    this.activeCategory.set(category); this.previewError.set(''); this.preview.set(null); this.previewBusy.set(false);
    const cached = this.previewCache.get(category.id);
    if (cached && !retry) { this.preview.set(cached); return; }
    this.previewBusy.set(true);
    this.previewRequest = forkJoin({ brands: this.service.faceta('marcas', category.id),
      products: this.service.listar({ offset: 0, limit: 6, idCat: category.id, sort: 'nombre_asc' }) })
      .pipe(takeUntilDestroyed(this.destroy), finalize(() => this.previewBusy.set(false))).subscribe({
        next: value => { this.previewCache.set(category.id, value); this.preview.set(value); },
        error: () => this.previewError.set('No pudimos cargar esta categoría. Inténtalo de nuevo.'),
      });
  }
  chooseCategory(category: FacetaItem, brand?: FacetaItem): void {
    this.form.patchValue({ idCat: String(category.id), idMarca: brand ? String(brand.id) : '' });
    this.aplicar(); this.categoriesOpen.set(false);
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
