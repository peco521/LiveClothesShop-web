import { Routes } from '@angular/router';
import { permissionGuard } from '../../../seguridad-accesos/shared/guards/permission.guard';
export const CU25_ROUTES: Routes = [
  { path: 'dinamicos', canActivate: [permissionGuard('CU25')], loadComponent: () => import('../pages/dinamicos').then(m => m.ReportesDinamicosPage) },
  { path: '', canActivate: [permissionGuard('CU25')], loadComponent: () => import('../pages/reportes').then(m => m.ReportesPage) },
];
