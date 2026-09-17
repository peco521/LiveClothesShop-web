import { Routes } from '@angular/router';

import { internalGuard } from './modules/seguridad-accesos/shared/guards/internal.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'admin/login', title: 'Acceso administrativo | LiveClothesShop', loadComponent: () => import('./modules/seguridad-accesos/pages/admin-login/admin-login').then(m => m.AdminLoginPage) },
  {
    path: 'admin',
    canActivateChild: [internalGuard],
    title: 'Panel administrativo | LiveClothesShop',
    loadComponent: () => import('./modules/seguridad-accesos/shared/layout/admin-layout').then(m => m.AdminLayout),
    children: [
      { path: '', pathMatch: 'full', title: 'Panel administrativo | LiveClothesShop', loadComponent: () => import('./modules/seguridad-accesos/pages/dashboard/dashboard').then(m => m.DashboardPage) },
      { path: '', loadChildren: () => import('./modules/seguridad-accesos/cu05-usuarios-empleados/routes/cu05.routes').then(m => m.CU05_ROUTES) },
      { path: 'roles', loadChildren: () => import('./modules/seguridad-accesos/cu06-roles-permisos/routes/cu06.routes').then(m => m.CU06_ROUTES) },
      { path: 'clientes', loadChildren: () => import('./modules/seguridad-accesos/cu07-clientes/routes/cu07.routes').then(m => m.CU07_ROUTES) },
      { path: 'bitacora', loadChildren: () => import('./modules/seguridad-accesos/cu08-bitacora/routes/cu08.routes').then(m => m.CU08_ROUTES) },
      { path: 'ciudades', loadChildren: () => import('./modules/seguridad-accesos/cu09-sucursales-ciudades/routes/cu09.routes').then(m => m.CU09_CIUDADES_ROUTES) },
      { path: 'sucursales', loadChildren: () => import('./modules/seguridad-accesos/cu09-sucursales-ciudades/routes/cu09.routes').then(m => m.CU09_SUCURSALES_ROUTES) },
      { path: 'historial-compras', loadChildren: () => import('./modules/cliente-experiencia-compra/cu15-historial-compra/routes/cu15-admin.routes').then(m => m.CU15_ADMIN_ROUTES) },
      { path: 'catalogo', loadChildren: () => import('./modules/inventario-productos/cu18-gestionar-catalogo/routes/cu18.routes').then(m => m.CU18_ROUTES) },
      { path: 'proveedores', loadChildren: () => import('./modules/inventario-productos/cu19-gestionar-proveedores/routes/cu19.routes').then(m => m.CU19_ROUTES) },
      { path: 'inventario', loadChildren: () => import('./modules/inventario-productos/cu20-gestionar-inventario/routes/cu20.routes').then(m => m.CU20_ROUTES) },
    ],
  },
  { path: '', loadChildren: () => import('./modules/seguridad-accesos/routes/seguridad-accesos.routes').then(m => m.SEGURIDAD_ACCESOS_ROUTES) },
  {
    path: 'tienda',
    title: 'Tienda | LiveClothesShop',
    loadComponent: () => import('./modules/cliente-experiencia-compra/shared/layout/shop-layout').then(m => m.ShopLayout),
    children: [
      { path: '', loadChildren: () => import('./modules/cliente-experiencia-compra/cu10-consultar-prendas/routes/cu10.routes').then(m => m.CU10_ROUTES) },
      { path: 'reservas', loadChildren: () => import('./modules/cliente-experiencia-compra/cu11-gestionar-reserva/routes/cu11.routes').then(m => m.CU11_ROUTES) },
      { path: 'carrito', loadChildren: () => import('./modules/cliente-experiencia-compra/cu12-carrito/routes/cu12.routes').then(m => m.CU12_ROUTES) },
      { path: 'finalizar-compra', loadChildren: () => import('./modules/cliente-experiencia-compra/cu13-compra-digital/routes/cu13.routes').then(m => m.CU13_ROUTES) },
      { path: 'pago', loadChildren: () => import('./modules/cliente-experiencia-compra/cu14-pago-electronico/routes/cu14.routes').then(m => m.CU14_ROUTES) },
      { path: 'historial-compras', loadChildren: () => import('./modules/cliente-experiencia-compra/cu15-historial-compra/routes/cu15.routes').then(m => m.CU15_ROUTES) },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
