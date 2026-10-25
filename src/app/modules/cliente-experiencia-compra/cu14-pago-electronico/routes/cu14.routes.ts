import { Routes } from '@angular/router';
import { clienteGuard } from '../../shared/guards/cliente.guard';

export const CU14_ROUTES: Routes = [
  { path: 'nueva', canActivate: [clienteGuard], title: 'Pago | FashionStore', loadComponent: () => import('../pages/pago/pago').then(m => m.PagoPage) },
  { path: ':id', canActivate: [clienteGuard], title: 'Estado del pago | FashionStore', loadComponent: () => import('../pages/estado-pago/estado-pago').then(m => m.EstadoPagoPage) },
];
