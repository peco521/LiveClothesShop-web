import { Routes } from '@angular/router';
import { permissionGuard } from '../../../seguridad-accesos/shared/guards/permission.guard';
export const CU22_ROUTES: Routes = [
  { path: '', canActivate: [permissionGuard('CU22')], loadComponent: () => import('../pages/reservas-sucursal').then(m => m.ReservasSucursalPage) },
];
