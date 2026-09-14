import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom, isObservable, of, throwError } from 'rxjs';
import { AuthResponse } from '../../../seguridad-accesos/models/auth.models';
import { AuthService } from '../../../seguridad-accesos/services/auth.service';
import { clienteGuard } from './cliente.guard';
import { clienteSession, adminSession } from '../../cu10-consultar-prendas/tests/catalogo.fixtures';

async function setup(session: AuthResponse | null | number) {
  const restore = typeof session === 'number'
    ? () => throwError(() => new HttpErrorResponse({ status: session }))
    : () => of(session);
  TestBed.configureTestingModule({ providers: [provideRouter([]),
    { provide: AuthService, useValue: { restore, session: signal(typeof session === 'number' ? null : session) } }] });
  const result = TestBed.runInInjectionContext(() => clienteGuard({} as never, {} as never));
  const value = isObservable(result) ? await firstValueFrom(result) : result;
  return typeof value === 'boolean' ? 'ALLOW' : String(value);
}

describe('clienteGuard (tienda)', () => {
  it('permite sesión de cliente', async () => {
    await expect(setup(clienteSession)).resolves.toBe('ALLOW');
  });
  it('redirige a login sin sesión', async () => {
    await expect(setup(null)).resolves.toContain('/login');
  });
  it('redirige a acceso para rol no cliente (el backend es la autoridad final)', async () => {
    await expect(setup(adminSession)).resolves.toContain('/acceso');
  });
  it('redirige a login ante 401', async () => {
    await expect(setup(401)).resolves.toContain('/login');
  });
  it('redirige a acceso ante error inesperado', async () => {
    await expect(setup(500)).resolves.toContain('/acceso');
  });
});
