import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../seguridad-accesos/services/auth.service';

export const platformGuard: CanActivateFn = () => {
  const router = inject(Router);
  // SSR cannot inspect the HttpOnly session, so fail closed with the SaaS
  // login route rather than cancelling navigation and hydrating a blank page.
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return router.createUrlTree(['/saas/login']);
  return inject(AuthService).restore().pipe(map(session => session?.plataforma
    ? true : router.createUrlTree(['/saas/login'])),
  catchError(() => of(router.createUrlTree(['/saas/login']))));
};
