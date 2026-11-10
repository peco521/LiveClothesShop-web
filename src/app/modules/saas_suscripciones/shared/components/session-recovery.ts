import { Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { AuthService } from '../../../seguridad-accesos/services/auth.service';
import { authError } from '../../../seguridad-accesos/services/auth-error';

@Component({
 selector: 'app-saas-session-recovery', imports: [FormsModule],
 template: `<section role="alert" aria-label="Renovar sesión SaaS">
   <h2>Vuelve a iniciar sesión como administrador SaaS</h2>
   <p>La sesión dejó de ser válida. Los datos del formulario se conservan; después de ingresar, vuelve a confirmar la operación.</p>
   <form (ngSubmit)="submit()">
     <label>Correo SaaS<input name="saasRecoveryEmail" type="email" [(ngModel)]="email" required autocomplete="username"></label>
     <label>Contraseña<input name="saasRecoveryPassword" type="password" [(ngModel)]="password" required autocomplete="current-password"></label>
     <button type="submit" [disabled]="busy()">{{ busy() ? 'Ingresando…' : 'Renovar sesión' }}</button>
   </form>
   @if (error()) { <p>{{ error() }}</p> }
 </section>`,
 styles: [`section{padding:20px;margin:16px 0;border:1px solid #b76b29;border-radius:12px;background:#fffaf1}form{display:flex;flex-wrap:wrap;gap:12px;align-items:end}label{display:grid;gap:6px}input,button{font:inherit;padding:10px}h2{font-size:1.1rem}`],
})
export class SaasSessionRecovery {
 private readonly auth = inject(AuthService);
 readonly recovered = output<void>();
 readonly busy = signal(false);
 readonly error = signal('');
 email = this.auth.session()?.usuario.tipo === 'S' ? this.auth.session()!.usuario.correo : '';
 password = '';
 submit(): void {
   if (this.busy() || !this.email.trim() || !this.password) return;
   this.busy.set(true); this.error.set('');
   this.auth.login({correo:this.email, contrasena:this.password}, 'saas')
     .pipe(finalize(() => {this.busy.set(false);this.password='';}))
     .subscribe({next:()=>this.recovered.emit(), error:e=>this.error.set(authError(e,'login'))});
 }
}
