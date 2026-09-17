import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, defer, map, Observable, of, tap, throwError } from 'rxjs';
import { isInternalSession } from '../models/session-type';
import { API_BASE_URL } from '../../../core/config/api.config';
import { AuthResponse, LoginRequest, RegistroRequest, RegistroResponse } from '../models/auth.models';

function publicSession(value: AuthResponse): AuthResponse {
  return {
    usuario: { idUsuario: value.usuario.idUsuario, nombres: value.usuario.nombres, correo: value.usuario.correo,
      ...(value.usuario.tipo !== undefined ? { tipo: value.usuario.tipo } : {}) },
    rol: { nro: value.rol.nro, descripcion: value.rol.descripcion },
    permisos: [...value.permisos],
    expiraEn: value.expiraEn,
  };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly platform = inject(PLATFORM_ID);
  private readonly base = `${inject(API_BASE_URL).replace(/\/$/, '')}/auth`;
  private readonly state = signal<AuthResponse | null>(null);
  private revision = 0;
  private loginRevision = 0;
  readonly session = this.state.asReadonly();

  requestRecovery(correo: string): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(`${this.base}/recuperar-contrasena`, { correo: correo.trim().toLowerCase() });
  }

  resetPassword(token: string, nueva_contrasena: string): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(`${this.base}/restablecer-contrasena`, { token, nueva_contrasena }).pipe(
      tap(() => { ++this.revision; this.state.set(null); }),
    );
  }

  register(input: RegistroRequest): Observable<RegistroResponse> {
    // Explicit allowlist: never spread form data into the public registration payload.
    const body: RegistroRequest = {
      ci: input.ci.trim(), nombres: input.nombres.trim(), apellidoPat: input.apellidoPat.trim(),
      apellidoMat: input.apellidoMat.trim(), sexo: input.sexo,
      correo: input.correo.trim().toLowerCase(), telefono: input.telefono.trim(),
      direccion: input.direccion.trim(), fechaNac: input.fechaNac, contrasena: input.contrasena,
    };
    return this.http.post<RegistroResponse>(`${this.base}/registro`, body);
  }

  login(input: LoginRequest, portal: 'cliente' | 'admin' = 'cliente'): Observable<AuthResponse> {
    return defer(() => {
      const revision = ++this.revision;
      this.loginRevision = revision;
      return this.http.post<AuthResponse>(`${this.base}/login/${portal}`, {
        correo: input.correo.trim().toLowerCase(), contrasena: input.contrasena,
      }).pipe(
        map(publicSession),
        tap((session) => { if (revision === this.revision) this.state.set(session); }),
        catchError((error: unknown) => {
          if (revision === this.revision) this.state.set(null);
          return throwError(() => error);
        }),
      );
    });
  }

  logout(): Observable<void> {
    return defer(() => {
      const revision = ++this.revision;
      const session = this.state();
      const loginUrl = session && isInternalSession(session) ? '/admin/login' : '/login';
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
        map(publicSession),
        tap((session) => { if (revision === this.revision) this.state.set(session); }),
        catchError((error: unknown) => {
          if (revision === this.revision) this.state.set(null);
          if (error instanceof HttpErrorResponse && error.status === 401) return of(null);
          return throwError(() => error);
        }),
      );
    });
  }
}
