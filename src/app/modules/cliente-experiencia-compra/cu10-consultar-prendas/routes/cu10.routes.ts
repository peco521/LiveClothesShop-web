import { Routes } from '@angular/router';
import { clienteGuard } from '../../shared/guards/cliente.guard';

export const CU10_ROUTES: Routes = [
  { path: '', pathMatch: 'full', canActivate: [clienteGuard], title: 'Catálogo | LiveClothesShop', loadComponent: () => import('../pages/catalogo-lista/catalogo-lista').then(m => m.CatalogoListaPage) },
  { path: 'prendas/:id', canActivate: [clienteGuard], title: 'Detalle de prenda | LiveClothesShop', loadComponent: () => import('../pages/catalogo-detalle/catalogo-detalle').then(m => m.CatalogoDetallePage) },
];
