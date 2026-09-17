import { Routes } from '@angular/router';
import { permissionGuard } from '../../../seguridad-accesos/shared/guards/permission.guard';
export const CU15_ADMIN_ROUTES: Routes = [
  { path: '', canActivate: [permissionGuard('CU15')], title: 'Historial interno | LiveClothesShop', loadComponent: () => import('../pages/historial-admin/historial-admin').then(m => m.HistorialAdminPage) },
];
