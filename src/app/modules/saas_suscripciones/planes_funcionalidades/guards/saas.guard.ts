import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../../../seguridad-accesos/services/auth.service';

export const saasGuard: CanActivateFn = () => {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return false;
  const router = inject(Router);
  return inject(AuthService).restore().pipe(
    map(session => session?.usuario.tipo === 'S' ? true : router.createUrlTree(['/saas/login'])),
    catchError(() => of(router.createUrlTree(['/saas/login']))),
  );
};
