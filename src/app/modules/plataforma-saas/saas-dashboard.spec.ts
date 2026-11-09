import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../seguridad-accesos/services/auth.service';
import { SaasDashboardPage } from './saas-dashboard';

describe('Panel de plataforma con permiso de planes', () => {
  it('muestra planes y no solicita empresas cuando no tiene ese permiso', () => {
    const session = signal({ usuario: { correo: 'saas@example.com' }, permisos: ['SAAS-PLANES'] });
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: AuthService, useValue: { session } }] });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(SaasDashboardPage);
    fixture.detectChanges();
    expect(fixture.componentInstance.section()).toBe('planes');
    http.expectNone('/api/saas/empresas');
    http.expectOne('/api/saas/planes').flush([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Administrar planes y funcionalidades');
    http.verify();
  });
});
