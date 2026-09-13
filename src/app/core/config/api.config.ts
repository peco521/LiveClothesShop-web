import { InjectionToken } from '@angular/core';

// Same-origin /api: Angular dev proxy locally, reverse proxy in production.
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => '/api',
});
