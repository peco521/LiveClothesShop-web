import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { API_BASE_URL } from '../config/api.config';

export const apiInterceptor: HttpInterceptorFn = (request, next) => {
  const base = inject(API_BASE_URL).replace(/\/$/, '');
  if (request.url !== base && !request.url.startsWith(`${base}/`)) {
    return next(request);
  }
  const mutable = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
  return next(request.clone({
    withCredentials: true,
    transferCache: false,
    ...(mutable ? { setHeaders: { 'X-CSRF-Protection': '1' } } : {}),
  }));
};
