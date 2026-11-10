import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { isInternalSession } from '../../models/session-type';

export const internalGuard: CanActivateChildFn = (_route, state) => {
  const router = inject(Router);
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return router.createUrlTree(['/admin/login']);
  return inject(AuthService).restore().pipe(
    map(session => !session ? router.createUrlTree(['/admin/login'])
      : session.offlineOnly
        ? state.url.split('?')[0] === '/admin/caja' ? true : router.createUrlTree(['/admin/caja'])
        : isInternalSession(session) ? true : router.createUrlTree(['/tienda'])),
    catchError((error: unknown) => of(
        error instanceof HttpErrorResponse && error.status === 401
          ? router.createUrlTree(['/admin/login'])
          : error instanceof HttpErrorResponse && error.status === 403
            ? router.createUrlTree(['/acceso'], { queryParams: { motivo: 'sin-permiso' } })
            : router.createUrlTree(['/acceso'], { queryParams: { motivo: 'verificacion' } }),
    )),
  );
};
