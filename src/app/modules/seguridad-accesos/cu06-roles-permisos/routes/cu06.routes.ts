import { Routes } from '@angular/router';
import { permissionGuard } from '../../shared/guards/permission.guard';

const cu06 = permissionGuard('CU06');
export const CU06_ROUTES: Routes = [
  { path: '', pathMatch: 'full', canActivate: [cu06], title: 'Roles y permisos | FashionStore', loadComponent: () => import('../pages/roles-lista/roles-lista').then(m => m.RolesListaPage) },
  { path: 'nuevo', canMatch: [(_route, segments) => segments[0]?.parameters['detalle'] !== '1'], canActivate: [cu06], title: 'Crear rol | FashionStore', loadComponent: () => import('../pages/rol-crear/rol-crear').then(m => m.RolCrearPage) },
  { path: ':nro/editar', canActivate: [cu06], title: 'Editar rol | FashionStore', loadComponent: () => import('../pages/rol-editar/rol-editar').then(m => m.RolEditarPage) },
  { path: ':nro', canActivate: [cu06], title: 'Detalle de rol | FashionStore', loadComponent: () => import('../pages/rol-detalle/rol-detalle').then(m => m.RolDetallePage) },
];
