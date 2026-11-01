import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { apiInterceptor } from './core/interceptors/api.interceptor';
import { PwaSyncService } from './core/offline/pwa-sync.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([apiInterceptor])),
    provideRouter(routes),
    provideAppInitializer(() => inject(PwaSyncService).initialize()),
    provideClientHydration(withEventReplay())
  ]
};
