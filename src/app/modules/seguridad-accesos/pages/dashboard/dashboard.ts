import { afterNextRender, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { authError } from '../../services/auth-error';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class DashboardPage {
  readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  readonly checking = signal(true);
  readonly error = signal('');

  constructor() {
    afterNextRender(() => this.verify());
  }

  verify(): void {
    this.checking.set(true);
    this.error.set('');
    this.auth
      .restore()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.checking.set(false)),
      )
      .subscribe({ error: (error: unknown) => this.error.set(authError(error, 'sesion')) });
  }
}
