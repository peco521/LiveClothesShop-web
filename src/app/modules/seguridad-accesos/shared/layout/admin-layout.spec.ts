import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AdminLayout } from './admin-layout';
import { AuthService } from '../../services/auth.service';
import { AuthResponse } from '../../models/auth.models';

describe('AdminLayout', () => {
  const session: AuthResponse = { usuario: { idUsuario: '1', nombres: 'Ana', correo: 'ana@example.com' },
    rol: { nro: '1', descripcion: 'SuperAdmin' }, permisos: ['CU05', 'CU09'], expiraEn: '2030-01-01T00:00:00Z' };
  const auth = { logout: vi.fn(), session: signal<AuthResponse | null>(null) };

  beforeEach(() => {
    auth.logout.mockReset().mockReturnValue(of(undefined)); auth.session.set(session);
    TestBed.configureTestingModule({ imports: [AdminLayout], providers: [
      provideRouter([]), { provide: AuthService, useValue: auth },
    ] });
  });

  it('muestra solo las opciones con permiso real, sin bypass por rol', async () => {
    const fixture = TestBed.createComponent(AdminLayout);
    fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    const nav: string = fixture.nativeElement.querySelector('.side-nav').textContent;
    expect(nav).toContain('Usuarios y empleados');
    expect(nav).toContain('Sucursales'); expect(nav).toContain('Ciudades');
    expect(nav).not.toContain('Roles y permisos');
    expect(nav).not.toContain('Bitácora');
    expect(fixture.nativeElement.querySelector('a[href="/admin/usuarios"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('a[href="/admin/roles"]')).toBeFalsy();
  });

  it('cierra sesión con AuthService.logout sin manipular la cookie', () => {
    const fixture = TestBed.createComponent(AdminLayout);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.admin-header .header-logout').click();
    expect(fixture.nativeElement.querySelector('.side-footer .button')).toBeNull();
    expect(auth.logout).toHaveBeenCalledOnce();
    expect(document.cookie).not.toContain('session');
  });

  it('muestra compras únicamente con CU15 y abre módulos al pasar el mouse o hacer clic', () => {
    auth.session.set({ ...session, permisos: ['CU15'] });
    const fixture = TestBed.createComponent(AdminLayout); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a[href="/admin/historial-compras"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('a[href="/tienda/carrito"]')).toBeNull();
    const group = fixture.nativeElement.querySelector('.module-group'); group.dispatchEvent(new MouseEvent('mouseenter')); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.module-button').getAttribute('aria-expanded')).toBe('true');
    group.dispatchEvent(new MouseEvent('mouseleave')); fixture.detectChanges();
    fixture.nativeElement.querySelector('.module-button').click(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.module-button').getAttribute('aria-expanded')).toBe('true');
    auth.session.set({ ...session, permisos: [] }); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a[href="/admin/historial-compras"]')).toBeNull();
  });
  it('permite colapsar el menú en pantallas pequeñas', () => {
    const fixture = TestBed.createComponent(AdminLayout);
    fixture.detectChanges();
    expect(fixture.componentInstance.menuOpen()).toBe(false);
    fixture.nativeElement.querySelector('.menu-button').click();
    expect(fixture.componentInstance.menuOpen()).toBe(true);
  });

  it('el segundo clic cierra el módulo incluso con hover y foco en el botón', () => {
    const fixture = TestBed.createComponent(AdminLayout); fixture.detectChanges();
    const group = fixture.nativeElement.querySelector('.module-group') as HTMLElement;
    const button = group.querySelector('.module-button') as HTMLButtonElement;
    const items = group.querySelector('.module-items') as HTMLElement;
    group.dispatchEvent(new MouseEvent('mouseenter')); fixture.detectChanges();
    button.focus(); button.click(); fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    group.dispatchEvent(new MouseEvent('mouseleave')); fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    group.dispatchEvent(new MouseEvent('mouseenter')); button.click(); fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(items.classList.contains('expanded')).toBe(false);
    expect(items.inert).toBe(true);
    expect(items.getAttribute('aria-hidden')).toBe('true');
  });

  it('abre otro módulo con clic y permite cerrarlo con Escape', () => {
    auth.session.set({ ...session, permisos: ['CU05', 'CU15'] });
    const fixture = TestBed.createComponent(AdminLayout);
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('.module-button') as NodeListOf<HTMLButtonElement>;
    buttons[0].click(); buttons[1].click(); fixture.detectChanges();
    expect(buttons[0].getAttribute('aria-expanded')).toBe('false');
    expect(buttons[1].getAttribute('aria-expanded')).toBe('true');
    buttons[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); fixture.detectChanges();
    expect(buttons[1].getAttribute('aria-expanded')).toBe('false');
    buttons[1].click(); fixture.detectChanges();
    expect(buttons[1].getAttribute('aria-expanded')).toBe('true');
  });
});
