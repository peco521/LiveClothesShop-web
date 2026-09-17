import { Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';

export function requestError(error: unknown, router: Router): string {
  if (error instanceof HttpErrorResponse && error.status === 401) {
    void router.navigate(['/admin/login']); return 'Tu sesión expiró. Inicia sesión nuevamente.';
  }
  if (error instanceof HttpErrorResponse && error.status === 403) return 'No tienes permiso para esta operación.';
  if (error instanceof HttpErrorResponse && [409, 422, 404, 413, 415, 502, 503].includes(error.status)) return error.error?.error?.message ?? 'No se pudo completar la operación.';
  return 'No se pudo completar la operación. Inténtalo nuevamente.';
}

@Component({ selector: 'app-inventario-panel', imports: [RouterLink, RouterLinkActive],
  template: `<section class="panel"><nav aria-label="Catálogo" class="tabs">
    @if (catalog()) { @for (item of tabs; track item.path) { <a [routerLink]="item.path" routerLinkActive="active">{{ item.label }}</a> } }
    @else { <a routerLink="/admin">Mi acceso</a> }
  </nav><h1>{{ title() }}</h1>@if (error()) { <p class="notice error" role="alert">{{ error() }}</p> }
  @if (success()) { <p class="notice success" role="status">✓ {{ success() }}</p> }<ng-content /></section>`,
  styles: `:host { display:block; max-width:1160px; margin:32px auto; padding:20px; }
    .panel { background:var(--paper); padding:clamp(16px,4vw,40px); border:1px solid var(--line); border-radius:12px; }
    h1 { font-size:1.7rem; }.tabs { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:24px; }
    .tabs a { text-decoration:none; font-size:.85rem; padding:9px 12px; border-radius:8px; border:1px solid var(--line); }
    .tabs a.active { background:#edf3e9; border-color:#c6d7bd; font-weight:600; }
    @media(max-width:600px) { :host { margin:12px auto; padding:0; } }`,
})
export class InventarioPanel {
  readonly title = input.required<string>(); readonly error = input(''); readonly success = input(''); readonly catalog = input(false);
  readonly tabs = [ { path:'/admin/catalogo/productos', label:'Productos' }, { path:'/admin/catalogo/tallas', label:'Tallas' },
    { path:'/admin/catalogo/colores', label:'Colores' }, { path:'/admin/catalogo/colecciones', label:'Colecciones' },
    { path:'/admin/catalogo/temporadas', label:'Temporadas' }, { path:'/admin/catalogo/categorias', label:'Categorías' },
    { path:'/admin/catalogo/marcas', label:'Marcas' } ];
}
