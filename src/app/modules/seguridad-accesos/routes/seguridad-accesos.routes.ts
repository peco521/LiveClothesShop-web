import { Routes } from '@angular/router';

export const SEGURIDAD_ACCESOS_ROUTES: Routes = [
  { path: 'olvide-contrasena', title: 'Recuperar contraseña | FashionStore', loadComponent: () => import('../pages/recuperacion/recuperacion').then(m => m.RecuperacionPage) },
  { path: 'restablecer-contrasena', title: 'Restablecer contraseña | FashionStore', loadComponent: () => import('../pages/recuperacion/restablecer').then(m => m.RestablecerPage) },
  { path: 'registro', title: 'Crear cuenta | FashionStore', loadComponent: () => import('../pages/registro/registro').then(m => m.RegistroPage) },
  { path: 'login', title: 'Iniciar sesión | FashionStore', loadComponent: () => import('../pages/login/login').then(m => m.LoginPage) },
  { path: 'acceso', title: 'Tu acceso | FashionStore', loadComponent: () => import('../pages/acceso/acceso').then(m => m.AccesoPage) },
];
