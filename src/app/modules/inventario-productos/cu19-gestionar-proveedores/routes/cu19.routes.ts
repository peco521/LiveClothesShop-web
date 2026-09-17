import { Routes } from '@angular/router';
import { permissionGuard } from '../../../seguridad-accesos/shared/guards/permission.guard';
import { catalogAdminGuard } from '../../shared/admin-only.guard';
export const CU19_ROUTES:Routes=[{path:'',data:{kind:'proveedores'},canActivate:[permissionGuard('CU19'),catalogAdminGuard],loadComponent:()=>import('../pages/proveedores').then(m=>m.ProveedoresPage)}];
