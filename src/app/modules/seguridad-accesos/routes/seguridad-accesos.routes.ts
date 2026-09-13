import { Routes } from '@angular/router';

export const SEGURIDAD_ACCESOS_ROUTES: Routes = [
  { path: 'olvide-contrasena', title: 'Recuperar contraseña | LiveClothesShop', loadComponent: () => import('../pages/recuperacion/recuperacion').then(m => m.RecuperacionPage) },
  { path: 'restablecer-contrasena', title: 'Restablecer contraseña | LiveClothesShop', loadComponent: () => import('../pages/recuperacion/restablecer').then(m => m.RestablecerPage) },
  { path: 'registro', title: 'Crear cuenta | LiveClothesShop', loadComponent: () => import('../pages/registro/registro').then(m => m.RegistroPage) },
  { path: 'login', title: 'Iniciar sesión | LiveClothesShop', loadComponent: () => import('../pages/login/login').then(m => m.LoginPage) },
  { path: 'acceso', title: 'Tu acceso | LiveClothesShop', loadComponent: () => import('../pages/acceso/acceso').then(m => m.AccesoPage) },
];
