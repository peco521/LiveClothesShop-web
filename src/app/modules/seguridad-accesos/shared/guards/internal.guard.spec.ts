import { HttpErrorResponse } from '@angular/common/http';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom, isObservable, of, throwError } from 'rxjs';
import { AuthResponse } from '../../models/auth.models';
import { AuthService } from '../../services/auth.service';
import { internalGuard } from './internal.guard';
import { clienteGuard } from '../../../cliente-experiencia-compra/shared/guards/cliente.guard';

function session(tipo: 'A' | 'C' | 'E'): AuthResponse {
  return { usuario: { idUsuario: 'test', tipo, nombres: 'Test', correo: 'test@example.com' },
    rol: { nro: tipo === 'C' ? 'C' : 'A', descripcion: 'Rol existente' }, permisos: [],
    expiraEn: '2030-01-01T00:00:00Z' };
}
async function check(value: AuthResponse | null | number, customer = false) {
  TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: PLATFORM_ID, useValue: 'browser' },
    { provide: AuthService, useValue: { restore: () => typeof value === 'number'
      ? throwError(() => new HttpErrorResponse({ status: value })) : of(value) } }] });
  const result = TestBed.runInInjectionContext(() =>
    customer ? clienteGuard({} as never, {} as never) : internalGuard({} as never, {} as never));
  const resolved = isObservable(result) ? await firstValueFrom(result) : result;
  return String(resolved);
}
describe('Separación de rutas por tipo de usuario', () => {
  it.each(['A', 'E'] as const)('permite usuario interno %s sin inventar permisos', async tipo => {
    expect(await check(session(tipo))).toBe('true');
  });
  it('envía a cliente fuera del panel administrativo', async () => {
    expect(await check(session('C'))).toBe('/tienda');
  });
  it('envía a personal sin sesión al login administrativo', async () => {
    expect(await check(null)).toBe('/admin/login');
  });
  it('envía a personal con sesión expirada al login administrativo', async () => {
    expect(await check(401)).toBe('/admin/login');
  });
  it('no trata errores del servidor como ausencia de permisos', async () => {
    expect(await check(503)).toContain('/acceso');
  });
  it('admite al cliente con el identificador real C', async () => {
    expect(await check(session('C'), true)).toBe('true');
  });
  it('no admite un administrador como cliente por el nombre de su rol', async () => {
    expect(await check({ ...session('A'), rol: { nro: 'C', descripcion: 'Cliente' } }, true)).toContain('/acceso');
  });
});
