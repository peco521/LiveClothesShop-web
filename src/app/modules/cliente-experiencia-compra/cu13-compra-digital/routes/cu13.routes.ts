import { Routes } from '@angular/router';
import { clienteGuard } from '../../shared/guards/cliente.guard';

export const CU13_ROUTES: Routes = [
  { path: '', pathMatch: 'full', canActivate: [clienteGuard], title: 'Finalizar compra | LiveClothesShop', loadComponent: () => import('../pages/finalizar-compra/finalizar-compra').then(m => m.FinalizarCompraPage) },
  { path: ':nro', canActivate: [clienteGuard], title: 'Compra preparada | LiveClothesShop', loadComponent: () => import('../pages/compra-preparada/compra-preparada').then(m => m.CompraPreparadaPage) },
];
