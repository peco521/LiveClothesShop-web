import { Routes } from '@angular/router';
import { permissionGuard } from '../../shared/guards/permission.guard';
import { Entidad } from '../models/organizacion.models';

function routes(kind: Entidad): Routes {
  return [
    { path: '', pathMatch: 'full', canActivate: [permissionGuard('CU09')], data: { kind },
      loadComponent: () => import('../pages/organizacion-lista').then(m => m.OrganizacionListaPage) },
    ...(['crear', 'editar', 'detalle'] as const).map(mode => ({
      path: mode === 'crear' ? 'nuevo' : mode === 'editar' ? ':id/editar' : ':id',
      canActivate: [permissionGuard('CU09')], runGuardsAndResolvers: 'always' as const, data: { kind, mode },
      loadComponent: () => import('../pages/organizacion-registro').then(m => m.OrganizacionRegistroPage),
    })),
  ];
}
export const CU09_CIUDADES_ROUTES = routes('ciudades');
export const CU09_SUCURSALES_ROUTES = routes('sucursales');
