import { Routes } from '@angular/router';
import { permissionGuard } from '../../../seguridad-accesos/shared/guards/permission.guard';
export const CU23_ROUTES: Routes = [
  { path: '', canActivate: [permissionGuard('CU23')], loadComponent: () => import('../pages/devoluciones').then(m => m.DevolucionesPage) },
];
export const CU23_POLITICAS_ROUTES: Routes = [
  { path: '', canActivate: [permissionGuard('CU23')], loadComponent: () => import('../pages/politicas').then(m => m.PoliticasPage) },
];
