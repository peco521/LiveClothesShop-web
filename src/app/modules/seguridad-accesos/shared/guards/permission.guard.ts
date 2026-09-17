import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../../services/auth.service';

export function permissionGuard(permission: string): CanActivateFn {
  return () => {
    const router = inject(Router);
    const auth = inject(AuthService);
    // Private routes use RenderMode.Client. Fail closed if invoked on the server.
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return false;
    return auth.restore().pipe(
      map(session => !session ? router.createUrlTree(['/admin/login'])
        : session.permisos.includes(permission) ? true
        : router.createUrlTree(['/acceso'], { queryParams: { motivo: 'sin-permiso' } })),
      catchError((error: unknown) => of(error instanceof HttpErrorResponse && error.status === 401
        ? router.createUrlTree(['/admin/login'])
        : router.createUrlTree(['/acceso'], { queryParams: {
          motivo: error instanceof HttpErrorResponse && error.status === 403 ? 'sin-permiso' : 'verificacion',
        } }))),
    );
  };
}
