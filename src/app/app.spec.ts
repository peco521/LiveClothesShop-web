import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { App } from './app';

@Component({ template: '' }) class EmptyPage {}
const paths = ['admin', 'admin/login', 'login', 'registro', 'recuperar-contrasena', 'tienda', 'tienda/carrito'];

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App], providers: [provideRouter(paths.map(path => ({ path, component: EmptyPage })))],
    }).compileComponents();
  });
  it('crea la aplicación y conserva el enlace para saltar al contenido', () => {
    const fixture = TestBed.createComponent(App); fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
    expect(fixture.nativeElement.querySelector('a.skip-link[href="#main"]')).toBeTruthy();
  });
  it('no muestra la cabecera global en ninguna página', async () => {
    const fixture = TestBed.createComponent(App); fixture.detectChanges();
    for (const path of paths) {
      await TestBed.inject(Router).navigateByUrl(`/${path}`); fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.site-header')).toBeNull();
      expect(fixture.nativeElement.querySelector('nav[aria-label="Acceso a la tienda"]')).toBeNull();
      expect(fixture.nativeElement.querySelector('main#main')).toBeTruthy();
    }
  });
  it('conserva el comportamiento del pie de página y el espacio del panel', async () => {
    const fixture = TestBed.createComponent(App); fixture.detectChanges();
    await TestBed.inject(Router).navigateByUrl('/admin'); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.site-footer')).toBeNull();
    expect(fixture.nativeElement.querySelector('main.admin-route')).toBeTruthy();
    await TestBed.inject(Router).navigateByUrl('/login'); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.site-footer')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('main.admin-route')).toBeNull();
  });
});
