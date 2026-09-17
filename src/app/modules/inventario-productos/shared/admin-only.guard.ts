import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../seguridad-accesos/services/auth.service';
export const catalogAdminGuard: CanActivateFn = () => inject(AuthService).session()?.usuario.tipo === 'A'
  ? true : inject(Router).createUrlTree(['/acceso'], { queryParams:{motivo:'sin-permiso'} });
