import { Routes } from '@angular/router';
import { clienteGuard } from '../../shared/guards/cliente.guard';

export const CU11_ROUTES: Routes = [
  { path: '', pathMatch: 'full', canActivate: [clienteGuard], title: 'Mis reservas | LiveClothesShop', loadComponent: () => import('../pages/mis-reservas/mis-reservas').then(m => m.MisReservasPage) },
  { path: 'nueva', canActivate: [clienteGuard], title: 'Nueva reserva | LiveClothesShop', loadComponent: () => import('../pages/nueva-reserva/nueva-reserva').then(m => m.NuevaReservaPage) },
  { path: ':nro', canActivate: [clienteGuard], title: 'Detalle de reserva | LiveClothesShop', loadComponent: () => import('../pages/detalle-reserva/detalle-reserva').then(m => m.DetalleReservaPage) },
];
