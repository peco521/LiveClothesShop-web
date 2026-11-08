import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { OfflineCatalogStorage } from '../../../../core/offline/offline-catalog-storage';
import { AuthService } from '../../../seguridad-accesos/services/auth.service';
import { CatalogoFiltros, FacetasListado, ProductoDetalle, ProductoResumen, ProductosListado } from '../models/catalogo.models';

export interface CatalogoDescargado {
  version: 1;
  actualizado: string;
  productos: ProductoDetalle[];
}

/** Only these local, fixed messages may be rendered by the catalog error mapper. */
export class CatalogoOfflineError extends Error {}

@Injectable({ providedIn: 'root' })
export class CatalogoOfflineRepository {
  private readonly storage = inject(OfflineCatalogStorage);
  private readonly auth = inject(AuthService);
  private readonly saved = signal<{ owner: ReturnType<AuthService['session']>; data: CatalogoDescargado } | null>(null);
  private readonly offlineOwner = signal<ReturnType<AuthService['session']>>(null);
  readonly snapshot = computed(() => this.saved()?.owner === this.auth.session() ? this.saved()!.data : null);
  readonly usingOffline = computed(() => !!this.auth.session() && this.offlineOwner() === this.auth.session());
  readonly stale = computed(() => this.usingOffline() || !!this.snapshot() && Date.now() - Date.parse(this.snapshot()!.actualizado) > 86_400_000);

  constructor() {
    effect(() => {
      const owner = this.auth.session();
      untracked(() => {
        this.saved.set(null); this.offlineOwner.set(null);
        if (owner?.empresa) void this.read(owner).catch(() => undefined);
      });
    });
  }

  owner() { return this.auth.session(); }
  current(owner: ReturnType<AuthService['session']>): boolean { return !!owner?.empresa && owner === this.auth.session(); }

  async read(owner = this.owner()): Promise<CatalogoDescargado | null> {
    if (!this.current(owner)) return null;
    const data = await this.storage.read<CatalogoDescargado>(owner!.empresa!, owner!.usuario.idUsuario);
    if (!this.current(owner)) return null;
    if (data?.version === 1 && Array.isArray(data.productos)) { this.saved.set({ owner, data }); return data; }
    return null;
  }

  async save(productos: ProductoDetalle[], owner: ReturnType<AuthService['session']>): Promise<void> {
    if (!this.current(owner)) throw new Error('La sesión cambió. Descarga de nuevo el catálogo.');
    const data: CatalogoDescargado = { version: 1, actualizado: new Date().toISOString(), productos };
    await this.storage.write(owner!.empresa!, owner!.usuario.idUsuario, data);
    // A late write remains in its original partition; never publish it to a newer session.
    if (this.current(owner)) { this.saved.set({ owner, data }); this.offlineOwner.set(null); }
  }

  async remove(): Promise<void> {
    const owner = this.owner();
    if (!this.current(owner)) return;
    await this.storage.remove(owner!.empresa!, owner!.usuario.idUsuario);
    if (this.current(owner)) { this.saved.set(null); this.offlineOwner.set(null); }
  }

  online(owner: ReturnType<AuthService['session']>): void { if (this.current(owner)) this.offlineOwner.set(null); }

  async fallback<T>(owner: ReturnType<AuthService['session']>, select: (data: CatalogoDescargado) => T): Promise<T> {
    const data = await this.read(owner);
    if (!data) throw new CatalogoOfflineError('Sin conexión. Descarga explícitamente una página del catálogo cuando tengas red para consultarla aquí.');
    const value = select(data);
    if (!this.current(owner)) throw new Error('La sesión cambió.');
    this.offlineOwner.set(owner);
    return value;
  }

  list(data: CatalogoDescargado, filters: CatalogoFiltros): ProductosListado {
    // Seasons are not returned by the detail endpoint; do not invent membership.
    if (filters.idTemp !== undefined) throw new CatalogoOfflineError('El filtro de temporada requiere conexión.');
    const items = data.productos.filter(product => {
      const variants = product.variantes;
      return (!filters.q?.trim() || product.descripcion.toLocaleLowerCase().includes(filters.q.trim().toLocaleLowerCase()))
        && (filters.idCat === undefined || product.categoria.idCat === filters.idCat)
        && (filters.idMarca === undefined || product.marca.idMarca === filters.idMarca)
        && (filters.idCol === undefined || product.coleccion.idCol === filters.idCol)
        && variants.some(variant => (filters.idTalla === undefined || variant.talla.idTalla === filters.idTalla)
          && (filters.idColor === undefined || variant.colores.some(color => color.idColor === filters.idColor))
          && (filters.minPrecio === undefined || Number(variant.precio) >= filters.minPrecio)
          && (filters.maxPrecio === undefined || Number(variant.precio) <= filters.maxPrecio))
        && (!filters.soloDisponibles || product.disponibilidad.some(branch => branch.cantDisp > 0));
    }).map(product => this.summary(product));
    items.sort((a, b) => filters.sort?.startsWith('precio')
      ? (Number(a.precioMin) - Number(b.precioMin)) * (filters.sort === 'precio_desc' ? -1 : 1)
      : a.descripcion.localeCompare(b.descripcion) * (filters.sort === 'nombre_desc' ? -1 : 1));
    // An online page may have had offset 20+, while its download is now the whole local subset.
    const offset = filters.offset >= items.length ? 0 : filters.offset;
    return { items: items.slice(offset, offset + filters.limit), total: items.length, offset, limit: filters.limit };
  }

  facets(data: CatalogoDescargado, group: string, idCat?: number): FacetasListado {
    const products = data.productos.filter(product => idCat === undefined || product.categoria.idCat === idCat);
    const values = products.flatMap(product => {
      switch (group) {
        case 'categorias': return [{ id: product.categoria.idCat, nombre: product.categoria.descripcion }];
        case 'marcas': return [{ id: product.marca.idMarca, nombre: product.marca.nombre }];
        case 'colecciones': return [{ id: product.coleccion.idCol, nombre: product.coleccion.descripcion }];
        case 'tallas': return product.variantes.map(variant => ({ id: variant.talla.idTalla, nombre: variant.talla.descripcion }));
        case 'colores': return product.variantes.flatMap(variant => variant.colores.map(color => ({ id: color.idColor, nombre: color.descripcion })));
        default: return [];
      }
    });
    const items = [...new Map(values.map(value => [value.id, value])).values()];
    return { items, total: items.length };
  }

  private summary(product: ProductoDetalle): ProductoResumen {
    const prices = product.variantes.map(variant => Number(variant.precio));
    return { idProd: product.idProd, descripcion: product.descripcion, categoria: product.categoria, marca: product.marca,
      coleccion: product.coleccion, promocion: product.promocion, precioMin: prices.length ? Math.min(...prices) : null,
      precioMax: prices.length ? Math.max(...prices) : null, imagen: product.variantes.find(variant => variant.imagen)?.imagen ?? null,
      disponible: product.disponibilidad.some(branch => branch.cantDisp > 0), totalVariantes: product.variantes.length };
  }
}
