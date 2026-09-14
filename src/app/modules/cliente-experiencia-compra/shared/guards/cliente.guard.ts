import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../../../seguridad-accesos/services/auth.service';

// Guarda de tienda: exige sesión válida de Cliente. La pertenencia real al
// rol cliente (tipo='C' + perfil coherente) la valida el backend mediante
// require_cliente; aquí solo se usa el rol como indicio de UX.
export const clienteGuard: CanActivateFn = () => {
  const router = inject(Router);
  const auth = inject(AuthService);
  // Las rutas de tienda usan RenderMode.Client. Falla cerrado en servidor.
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return false;
  return auth.restore().pipe(
    map(session => {
      if (!session) return router.createUrlTree(['/login']);
      return session.rol.nro === 'cliente' ? true
        : router.createUrlTree(['/acceso'], { queryParams: { motivo: 'sin-permiso' } });
    }),
    catchError((error: unknown) => of(error instanceof HttpErrorResponse && error.status === 401
      ? router.createUrlTree(['/login'])
      : router.createUrlTree(['/acceso'], { queryParams: {
        motivo: error instanceof HttpErrorResponse && error.status === 403 ? 'sin-permiso' : 'verificacion',
      } }))),
  );
};
