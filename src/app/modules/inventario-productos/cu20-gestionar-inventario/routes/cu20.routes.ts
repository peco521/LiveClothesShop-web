import { Routes } from '@angular/router';
import { permissionGuard } from '../../../seguridad-accesos/shared/guards/permission.guard';
export const CU20_ROUTES:Routes=[{path:'',canActivate:[permissionGuard('CU20')],loadComponent:()=>import('../pages/inventario').then(m=>m.InventarioPage)}];
