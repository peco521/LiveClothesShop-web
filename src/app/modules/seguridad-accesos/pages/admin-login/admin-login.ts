import { HttpErrorResponse } from '@angular/common/http';
import { afterNextRender, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize, of } from 'rxjs';
import { FieldError } from '../../components/field-error';
import { EmpresaAcceso } from '../../models/auth.models';
import { normalizedEmail, notBlank } from '../../models/auth.validation';
import { isInternalSession } from '../../models/session-type';
import { authError } from '../../services/auth-error';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin-login',
  imports: [ReactiveFormsModule, RouterLink, FieldError],
  templateUrl: './admin-login.html',
  styleUrl: './admin-login.css',
})
export class AdminLoginPage implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly companies = signal<EmpresaAcceso[]>([]);
  readonly loadingCompanies = signal(false);
  readonly companiesError = signal('');
  readonly companyMenuOpen = signal(false);
  private readonly companyMenuPinned = signal(false);
  readonly form = this.fb.group({
    empresa: ['', [notBlank, Validators.maxLength(30)]],
    correo: ['', [notBlank, normalizedEmail, Validators.maxLength(100)]],
    contrasena: ['', [Validators.required, Validators.maxLength(128)]],
  });

  constructor() {
    afterNextRender(() => {
      this.auth.restore().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (session) => {
          if (session && isInternalSession(session) && !this.busy() && this.auth.session() === session) void this.router.navigateByUrl('/admin');
        },
        // A failed restoration must not prevent a fresh login.
        error: () => {},
      });
    });
  }

  ngOnInit(): void {
    this.loadCompanies();
  }

  loadCompanies(): void {
    if (this.loadingCompanies()) return;
    const source = this.auth.listCompanies?.() ?? of([]);
    this.loadingCompanies.set(true);
    this.companiesError.set('');
    source.pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loadingCompanies.set(false)),
    ).subscribe({
      next: (items) => this.companies.set(Array.isArray(items) ? items : []),
      error: () => {
        this.companies.set([]);
        this.companiesError.set('No se pudo cargar la lista de empresas. Verifica que el servidor esté disponible.');
      },
    });
  }

  hoverCompanies(): void {
    if (this.busy()) return;
    if (!this.companies().length && !this.loadingCompanies() && !this.companiesError()) {
      this.loadCompanies();
    }
    if (!this.companyMenuPinned()) {
      this.companyMenuOpen.set(true);
    }
  }

  leaveCompanies(): void {
    if (!this.companyMenuPinned()) {
      this.companyMenuOpen.set(false);
    }
  }

  toggleCompanies(): void {
    if (this.busy()) return;
    if (!this.companies().length && !this.loadingCompanies()) {
      this.loadCompanies();
    }
    if (this.companyMenuPinned()) {
      this.closeCompanies();
    } else {
      this.companyMenuPinned.set(true);
      this.companyMenuOpen.set(true);
    }
  }

  closeCompanies(): void {
    this.companyMenuPinned.set(false);
    this.companyMenuOpen.set(false);
  }

  selectCompany(company: EmpresaAcceso): void {
    this.form.controls.empresa.setValue(company.codigo);
    this.form.controls.empresa.markAsDirty();
    this.form.controls.empresa.markAsTouched();
    this.closeCompanies();
  }

  selectedCompany(): EmpresaAcceso | null {
    const code = this.form.controls.empresa.value.trim().toLowerCase();
    if (!code) return null;
    return this.companies().find((item) => item.codigo.toLowerCase() === code) ?? null;
  }

  submit(): void {
    if (this.busy()) return;
    this.error.set('');
    this.closeCompanies();
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.busy.set(true);
    this.auth.login(this.form.getRawValue(), 'admin').pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => { this.busy.set(false); this.form.controls.contrasena.reset(); }),
    ).subscribe({
      next: () => { void this.router.navigateByUrl('/admin'); },
      error: (error: unknown) => this.error.set(
        error instanceof HttpErrorResponse && error.status === 401
          ? 'No pudimos iniciar sesión. Verifica que tu cuenta pertenezca a la empresa seleccionada y que el correo y la contraseña sean correctos.'
          : authError(error, 'login')),
    });
  }
}
