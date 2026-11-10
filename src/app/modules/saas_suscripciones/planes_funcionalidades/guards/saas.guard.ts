import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../../../seguridad-accesos/services/auth.service';

export const saasGuard: CanActivateFn = () => {
  const router = inject(Router);
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return router.createUrlTree(['/saas/login']);
  return inject(AuthService).restore().pipe(
    map(session => session?.plataforma && session.usuario.tipo === 'S'
      ? (session.permisos.includes('SAAS-PLANES') ? true : router.createUrlTree(['/saas']))
      : router.createUrlTree(['/saas/login'])),
    catchError(() => of(router.createUrlTree(['/saas/login']))),
  );
};
