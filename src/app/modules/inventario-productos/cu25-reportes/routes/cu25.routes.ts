import { Routes } from '@angular/router';
import { permissionGuard } from '../../../seguridad-accesos/shared/guards/permission.guard';
export const CU25_ROUTES: Routes = [
  { path: '', canActivate: [permissionGuard('CU25')], loadComponent: () => import('../pages/reportes').then(m => m.ReportesPage) },
];
