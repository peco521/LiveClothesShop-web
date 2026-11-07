import { Routes } from '@angular/router';
import { permissionGuard } from '../../../seguridad-accesos/shared/guards/permission.guard';
export const CU24_ROUTES: Routes = [
  { path: '', canActivate: [permissionGuard('CU24')], loadComponent: () => import('../pages/caja').then(m => m.PuntoDeVentaPage) },
];
