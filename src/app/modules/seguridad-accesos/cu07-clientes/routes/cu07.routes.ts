import { Routes } from '@angular/router';
import { permissionGuard } from '../../shared/guards/permission.guard';

const cu07 = permissionGuard('CU07');
export const CU07_ROUTES: Routes = [
  { path: '', pathMatch: 'full', canActivate: [cu07], title: 'Clientes | LiveClothesShop', loadComponent: () => import('../pages/clientes-lista/clientes-lista').then(m => m.ClientesListaPage) },
  { path: ':idUsuario/editar', canActivate: [cu07], title: 'Editar cliente | LiveClothesShop', loadComponent: () => import('../pages/cliente-editar/cliente-editar').then(m => m.ClienteEditarPage) },
  { path: ':idUsuario', canActivate: [cu07], title: 'Detalle del cliente | LiveClothesShop', loadComponent: () => import('../pages/cliente-detalle/cliente-detalle').then(m => m.ClienteDetallePage) },
];
