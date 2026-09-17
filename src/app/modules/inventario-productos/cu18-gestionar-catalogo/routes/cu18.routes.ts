import { Routes } from '@angular/router';
import { permissionGuard } from '../../../seguridad-accesos/shared/guards/permission.guard';
import { catalogAdminGuard } from '../../shared/admin-only.guard';
export const CU18_ROUTES: Routes = [
  {path:'',pathMatch:'full',redirectTo:'productos'},
  {path:'productos',canActivate:[permissionGuard('CU18'),catalogAdminGuard],loadComponent:()=>import('../pages/productos').then(m=>m.ProductosPage)},
  ...['tallas','colores','colecciones','temporadas','categorias','marcas'].map(kind=>({path:kind,data:{kind},canActivate:[permissionGuard('CU18'),catalogAdminGuard],loadComponent:()=>import('../pages/referencias').then(m=>m.ReferenciasPage)})),
];
