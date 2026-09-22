import { Routes } from '@angular/router';
import { permissionGuard } from '../../../seguridad-accesos/shared/guards/permission.guard';
export const CU21_ROUTES: Routes = [
  { path: '', canActivate: [permissionGuard('CU21')], loadComponent: () => import('../pages/promociones').then(m => m.PromocionesPage) },
];
