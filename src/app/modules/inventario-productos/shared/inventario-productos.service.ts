import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { defer, EMPTY, Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api.config';
import { Filters, Group, Inventory, InventoryReferences, Movement, MovementData, MovementResult, Option, Page,
  Product, ProductData, ProductSummary, ReferenceRow } from './models';

@Injectable({ providedIn: 'root' })
export class InventarioProductosService {
  private readonly http = inject(HttpClient);
  private readonly platform = inject(PLATFORM_ID);
  private readonly base = `${inject(API_BASE_URL).replace(/\/$/, '')}/admin`;
  private browser<T>(run: () => Observable<T>): Observable<T> { return defer(() => isPlatformBrowser(this.platform) ? run() : EMPTY); }
  private params(filters: Filters): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) if (value !== undefined && value !== '') params = params.set(key, value);
    return params;
  }
  private resource(group: Group): string { return group === 'proveedores' ? `${this.base}/proveedores` : `${this.base}/catalogo/${group}`; }
  listGroup(group: Group, filters: Filters) { return this.browser(() => this.http.get<Page<ReferenceRow>>(this.resource(group), { params: this.params(filters) })); }
  saveGroup(group: Group, data: Record<string, unknown>, id?: number) {
    return this.browser(() => id === undefined ? this.http.post<ReferenceRow>(this.resource(group), data) : this.http.put<ReferenceRow>(`${this.resource(group)}/${id}`, data));
  }
  deleteGroup(group: Group, id: number) { return this.browser(() => this.http.delete<void>(`${this.resource(group)}/${id}`)); }
  references() { return this.browser(() => this.http.get<Record<string, Option[]>>(`${this.base}/catalogo/referencias`)); }
  uploadImage(file: File) {
    return this.browser(() => {
      const body = new FormData(); body.append('file', file);
      return this.http.post<{url: string; publicId: string}>(`${this.base}/catalogo/imagenes`, body);
    });
  }
  products(filters: Filters) { return this.browser(() => this.http.get<Page<ProductSummary>>(`${this.base}/catalogo/productos`, { params: this.params(filters) })); }
  product(id: string) { return this.browser(() => this.http.get<Product>(`${this.base}/catalogo/productos/${encodeURIComponent(id)}`)); }
  saveProduct(data: ProductData, id?: string) {
    return this.browser(() => id === undefined ? this.http.post<Product>(`${this.base}/catalogo/productos`, data) : this.http.put<Product>(`${this.base}/catalogo/productos/${encodeURIComponent(id)}`, data));
  }
  deleteProduct(id: string) { return this.browser(() => this.http.delete<void>(`${this.base}/catalogo/productos/${encodeURIComponent(id)}`)); }
  inventory(filters: Filters) { return this.browser(() => this.http.get<Page<Inventory>>(`${this.base}/inventario`, { params: this.params(filters) })); }
  inventoryReferences() { return this.browser(() => this.http.get<InventoryReferences>(`${this.base}/inventario/referencias`)); }
  registerMovement(data: MovementData) { return this.browser(() => this.http.post<MovementResult>(`${this.base}/inventario/movimientos`, data)); }
  movements(id: number, offset = 0) { return this.browser(() => this.http.get<Page<Movement>>(`${this.base}/inventario/${id}/movimientos`, { params: this.params({ offset, limit: 20 }) })); }
}
