import { Routes } from '@angular/router';
import { clienteGuard } from '../../shared/guards/cliente.guard';

export const CU12_ROUTES: Routes = [
  { path: '', pathMatch: 'full', canActivate: [clienteGuard], title: 'Carrito | LiveClothesShop', loadComponent: () => import('../pages/carrito/carrito').then(m => m.CarritoPage) },
];
