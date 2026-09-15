import { Routes } from '@angular/router';
import { clienteGuard } from '../../shared/guards/cliente.guard';

export const CU14_ROUTES: Routes = [
  { path: 'nueva', canActivate: [clienteGuard], title: 'Pago | LiveClothesShop', loadComponent: () => import('../pages/pago/pago').then(m => m.PagoPage) },
  { path: ':id', canActivate: [clienteGuard], title: 'Estado del pago | LiveClothesShop', loadComponent: () => import('../pages/estado-pago/estado-pago').then(m => m.EstadoPagoPage) },
];
