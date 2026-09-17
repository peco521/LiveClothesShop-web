import { Routes } from '@angular/router';
import { clienteGuard } from '../../shared/guards/cliente.guard';

export const CU15_ROUTES: Routes = [
  { path: '', pathMatch: 'full', canActivate: [clienteGuard], title: 'Historial de compras | LiveClothesShop', loadComponent: () => import('../pages/historial-lista/historial-lista').then(m => m.HistorialListaPage) },
  { path: ':nro', canActivate: [clienteGuard], title: 'Detalle de compra | LiveClothesShop', loadComponent: () => import('../pages/historial-detalle/historial-detalle').then(m => m.HistorialDetallePage) },
];
