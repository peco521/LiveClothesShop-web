import { Routes } from '@angular/router';
import { permissionGuard } from '../../shared/guards/permission.guard';

const cu05 = permissionGuard('CU05');
export const CU05_ROUTES: Routes = [
  { path: 'usuarios', canActivate: [cu05], title: 'Usuarios internos | LiveClothesShop', loadComponent: () => import('../pages/usuarios-lista/usuarios-lista').then(m => m.UsuariosListaPage) },
  { path: 'empleados/nuevo', canActivate: [cu05], title: 'Crear empleado | LiveClothesShop', loadComponent: () => import('../pages/empleado-crear/empleado-crear').then(m => m.EmpleadoCrearPage) },
  { path: 'empleados/:idUsuario/editar', canActivate: [cu05], title: 'Editar empleado | LiveClothesShop', loadComponent: () => import('../pages/empleado-editar/empleado-editar').then(m => m.EmpleadoEditarPage) },
  { path: 'usuarios/:idUsuario', canActivate: [cu05], title: 'Detalle de usuario | LiveClothesShop', loadComponent: () => import('../pages/usuario-detalle/usuario-detalle').then(m => m.UsuarioDetallePage) },
];
