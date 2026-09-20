import { Routes } from '@angular/router';
import { clienteGuard } from '../../shared/guards/cliente.guard';

export const CU17_ROUTES: Routes = [
  { path: '', pathMatch: 'full', canActivate: [clienteGuard], title: 'Recomendaciones | LiveClothesShop', loadComponent: () => import('../pages/recomendaciones/recomendaciones').then(m => m.RecomendacionesPage) },
];
