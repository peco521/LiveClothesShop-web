import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { isInternalSession } from '../../models/session-type';

export const internalGuard: CanActivateChildFn = () => {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return false;
  const router = inject(Router);
  return inject(AuthService).restore().pipe(
    map(session => !session ? router.createUrlTree(['/admin/login'])
      : isInternalSession(session) ? true : router.createUrlTree(['/tienda'])),
    catchError((error: unknown) => of(
      error instanceof HttpErrorResponse && error.status === 401
        ? router.createUrlTree(['/admin/login'])
        : router.createUrlTree(['/acceso'], { queryParams: { motivo: 'verificacion' } }),
    )),
  );
};
