import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, defer, map, Observable, of, tap, throwError, timeout } from 'rxjs';
import { isInternalSession } from '../models/session-type';
import { API_BASE_URL } from '../../../core/config/api.config';
import { PwaSyncService } from '../../../core/offline/pwa-sync.service';
import { AuthResponse, EmpresaAcceso, LoginRequest, MiSuscripcion, RegistroRequest, RegistroResponse } from '../models/auth.models';

const OFFLINE_CASHIER_SESSION = 'fashionstore-offline-cashier-session-v1';

function publicSession(value: AuthResponse): AuthResponse {
  return {
    ...(value.empresa !== undefined ? { empresa: value.empresa } : {}),
    ...(value.plataforma !== undefined ? { plataforma: value.plataforma } : {}),
    usuario: { idUsuario: value.usuario.idUsuario, nombres: value.usuario.nombres, correo: value.usuario.correo,
      ...(value.usuario.tipo !== undefined ? { tipo: value.usuario.tipo } : {}) },
    rol: { nro: value.rol.nro, descripcion: value.rol.descripcion },
    permisos: [...value.permisos],
    expiraEn: value.expiraEn,
  };
}

function cacheCashierSession(session: AuthResponse): void {
  // Keep the historical storage key for compatibility. This public, expiring
  // snapshot now also lets clients reopen their explicitly downloaded catalog.
  // It never authenticates HTTP requests or grants cashier privileges.
  const cashier = isInternalSession(session) && session.usuario.tipo === 'E' && session.permisos.includes('CU24');
  const client = session.usuario.tipo === 'C' && !session.plataforma;
  if ((!cashier && !client) || !session.empresa || typeof localStorage === 'undefined') return;
  // Only a short-lived identity/authorization snapshot is cached, never a token
  // or password. It is honored only while the browser reports offline.
  localStorage.setItem(OFFLINE_CASHIER_SESSION, JSON.stringify(session));
}

function readOfflineCashierSession(): AuthResponse | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const value = JSON.parse(localStorage.getItem(OFFLINE_CASHIER_SESSION) ?? 'null') as AuthResponse | null;
    const cashier = value && isInternalSession(value) && value.usuario.tipo === 'E' && value.permisos.includes('CU24');
    const client = value?.usuario.tipo === 'C' && !value?.plataforma;
    if (!value || (!cashier && !client) || !value.empresa
        || !Number.isFinite(Date.parse(value.expiraEn))
        || Date.parse(value.expiraEn) <= Date.now()) {
      localStorage.removeItem(OFFLINE_CASHIER_SESSION);
      return null;
    }
    return { ...value, offlineOnly: true };
  } catch {
    localStorage.removeItem(OFFLINE_CASHIER_SESSION);
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly platform = inject(PLATFORM_ID);
  private readonly base = `${inject(API_BASE_URL).replace(/\/$/, '')}/auth`;
  private readonly offlineSync = inject(PwaSyncService);
  private readonly state = signal<AuthResponse | null>(null);
  private revision = 0;
  private loginRevision = 0;
  readonly session = this.state.asReadonly();

  listCompanies(): Observable<EmpresaAcceso[]> {
    // Lista pública de empresas activas: solo código y nombre. No expone usuarios
    // ni confirma pertenencia; eso lo valida el backend al iniciar sesión.
    return this.http.get<EmpresaAcceso[]>(`${this.base}/empresas`).pipe(timeout(20000));
  }

  mySubscription(): Observable<MiSuscripcion | null> {
    return this.http.get<MiSuscripcion | null>(`${this.base}/mi-suscripcion`);
  }

  requestRecovery(correo: string): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(`${this.base}/recuperar-contrasena`, { correo: correo.trim().toLowerCase() });
  }

  resetPassword(token: string, nueva_contrasena: string): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(`${this.base}/restablecer-contrasena`, { token, nueva_contrasena }).pipe(
      tap(() => { ++this.revision; this.state.set(null); this.clearOfflineSnapshot(); }),
    );
  }

  register(input: RegistroRequest): Observable<RegistroResponse> {
    // Explicit allowlist: never spread form data into the public registration payload.
    const body: RegistroRequest = {
      ...(input.empresa ? { empresa: input.empresa.trim().toLowerCase() } : {}),
      ci: input.ci.trim(), nombres: input.nombres.trim(), apellidoPat: input.apellidoPat.trim(),
      apellidoMat: input.apellidoMat.trim(), sexo: input.sexo,
      correo: input.correo.trim().toLowerCase(), telefono: input.telefono.trim(),
      direccion: input.direccion.trim(), fechaNac: input.fechaNac, contrasena: input.contrasena,
    };
    return defer(() => {
      const revision = ++this.revision;
      this.loginRevision = revision;
      this.clearOfflineSnapshot();
      return this.http.post<RegistroResponse>(`${this.base}/registro`, body).pipe(
        // CU01: el registro público deja la sesión iniciada igual que el login.
        tap((result) => {
          if (revision === this.revision && result.sesion) {
            const session = publicSession(result.sesion);
            this.state.set(session);
            cacheCashierSession(session);
            this.offlineSync.activate(session.empresa, session.usuario.idUsuario);
          }
        }),
      );
    });
  }

  login(input: LoginRequest, portal: 'cliente' | 'admin' | 'saas' = 'cliente'): Observable<AuthResponse> {
    return defer(() => {
      const revision = ++this.revision;
      this.loginRevision = revision;
      this.clearOfflineSnapshot();
      const path = portal === 'saas' ? '/login/saas' : `/login/${portal}`;
      return this.http.post<AuthResponse>(`${this.base}${path}`, {
        ...(portal !== 'saas' && input.empresa ? { empresa: input.empresa.trim().toLowerCase() } : {}),
        correo: input.correo.trim().toLowerCase(), contrasena: input.contrasena,
      }).pipe(
        timeout(20000),
        map(publicSession),
        tap((session) => { if (revision === this.revision) {
          this.state.set(session);
          cacheCashierSession(session);
          this.offlineSync.activate(session.empresa, session.usuario.idUsuario);
        } }),
        catchError((error: unknown) => {
          if (revision === this.revision) this.state.set(null);
          if (revision === this.revision) this.offlineSync.pause();
          return throwError(() => error);
        }),
      );
    });
  }

  logout(): Observable<void> {
    return defer(() => {
      const revision = ++this.revision;
      const session = this.state();
      this.offlineSync.pause();
      this.clearOfflineSnapshot();
      const loginUrl = session?.usuario.tipo === 'S' || session?.plataforma
        ? '/saas/login' : session && isInternalSession(session) ? '/admin/login' : '/login';
      return this.http.post<void>(`${this.base}/logout`, null).pipe(
        tap(() => {
          // Invalidate even /me requests started during logout, but not a newer login.
          if (this.loginRevision <= revision) {
            ++this.revision;
            this.state.set(null);
            void this.router.navigateByUrl(loginUrl);
          }
        }),
      );
    });
  }

  restore(): Observable<AuthResponse | null> {
    // Session-dependent requests never run on the SSR server or during prerender.
    if (!isPlatformBrowser(this.platform)) return of(null);
    return defer(() => {
      const revision = ++this.revision;
      return this.http.get<AuthResponse>(`${this.base}/me`).pipe(
        timeout(20000),
        map(publicSession),
        tap((session) => { if (revision === this.revision) {
          this.state.set(session);
          cacheCashierSession(session);
          this.offlineSync.activate(session.empresa, session.usuario.idUsuario);
        } }),
        catchError((error: unknown) => {
          if (revision === this.revision) {
            const offline = error instanceof HttpErrorResponse && error.status === 0
              && isPlatformBrowser(this.platform) && !navigator.onLine
              ? readOfflineCashierSession() : null;
            if (offline) {
              this.state.set(offline);
              this.offlineSync.activate(offline.empresa, offline.usuario.idUsuario);
              return of(offline);
            }
            this.state.set(null);
            this.offlineSync.pause();
            if (error instanceof HttpErrorResponse && error.status === 401) this.clearOfflineSnapshot();
          }
          if (error instanceof HttpErrorResponse && error.status === 401) return of(null);
          return throwError(() => error);
        }),
      );
    });
  }

  private clearOfflineSnapshot(): void {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(OFFLINE_CASHIER_SESSION);
  }
}
