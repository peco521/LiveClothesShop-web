import { Routes } from '@angular/router';
import { permissionGuard } from '../../shared/guards/permission.guard';

const cu08 = permissionGuard('CU08');
export const CU08_ROUTES: Routes = [
  { path: '', pathMatch: 'full', canActivate: [cu08], title: 'Bitácora | LiveClothesShop', loadComponent: () => import('../pages/bitacora-lista/bitacora-lista').then(m => m.BitacoraListaPage) },
  { path: ':id', canActivate: [cu08], title: 'Detalle de bitácora | LiveClothesShop', loadComponent: () => import('../pages/bitacora-detalle/bitacora-detalle').then(m => m.BitacoraDetallePage) },
];
