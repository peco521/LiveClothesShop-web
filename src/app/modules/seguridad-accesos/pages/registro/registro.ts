import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize, of } from 'rxjs';
import { AuthLayout } from '../../components/auth-layout';
import { FieldError } from '../../components/field-error';
import { EmpresaAcceso } from '../../models/auth.models';
import { normalizedEmail, notBlank, pastDate } from '../../models/auth.validation';
import { authError } from '../../services/auth-error';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-registro',
  imports: [ReactiveFormsModule, RouterLink, AuthLayout, FieldError],
  templateUrl: './registro.html',
  styleUrl: '../admin-login/admin-login.css',
})
export class RegistroPage implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly success = signal(false);
  readonly empresa = signal('');
  readonly companies = signal<EmpresaAcceso[]>([]);
  readonly loadingCompanies = signal(false);
  readonly companiesError = signal('');
  readonly companyMenuOpen = signal(false);
  private readonly companyMenuPinned = signal(false);
  readonly form = this.fb.group({
    ci: ['', [notBlank, Validators.maxLength(100)]],
    nombres: ['', [notBlank, Validators.maxLength(100)]],
    apellidoPat: ['', [notBlank, Validators.maxLength(50)]],
    apellidoMat: ['', [notBlank, Validators.maxLength(50)]],
    sexo: ['' as '' | 'M' | 'F', Validators.required],
    correo: ['', [notBlank, normalizedEmail, Validators.maxLength(100)]],
    telefono: ['', [notBlank, Validators.maxLength(20)]],
    direccion: ['', [notBlank, Validators.maxLength(150)]],
    fechaNac: ['', [Validators.required, pastDate]],
    contrasena: ['', [notBlank, Validators.minLength(12), Validators.maxLength(128)]],
  });
  readonly fields = [
    { name: 'ci', label: 'CI', type: 'text', autocomplete: 'off', max: 100 },
    { name: 'nombres', label: 'Nombres', type: 'text', autocomplete: 'given-name', max: 100 },
    { name: 'apellidoPat', label: 'Apellido paterno', type: 'text', autocomplete: 'family-name', max: 50 },
    { name: 'apellidoMat', label: 'Apellido materno', type: 'text', autocomplete: 'off', max: 50 },
    { name: 'correo', label: 'Correo electrónico', type: 'email', autocomplete: 'email', max: 100 },
    { name: 'telefono', label: 'Teléfono', type: 'tel', autocomplete: 'tel', max: 20 },
    { name: 'direccion', label: 'Dirección', type: 'text', autocomplete: 'street-address', max: 150 },
    { name: 'fechaNac', label: 'Fecha de nacimiento', type: 'date', autocomplete: 'bday', max: null },
  ] as const;

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
      next: (items) => {
        const list = Array.isArray(items) ? items : [];
        this.companies.set(list);
        if (list.length === 1 && !this.empresa()) {
          this.empresa.set(list[0].codigo);
        }
      },
      error: () => {
        this.companies.set([]);
        this.companiesError.set('No se pudo cargar la lista de empresas.');
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
    this.empresa.set(company.codigo);
    this.closeCompanies();
  }

  selectedCompany(): EmpresaAcceso | null {
    const code = this.empresa().trim().toLowerCase();
    if (!code) return null;
    return this.companies().find((item) => item.codigo.toLowerCase() === code) ?? null;
  }

  submit(): void {
    if (this.busy() || this.success()) return;
    this.error.set('');
    this.closeCompanies();
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    if (this.companies().length > 1 && !this.empresa()) {
      this.error.set('Selecciona la empresa en la que deseas registrarte.');
      return;
    }
    const input = this.form.getRawValue();
    if (input.sexo !== 'M' && input.sexo !== 'F') return;
    this.busy.set(true);
    const payload = this.empresa()
      ? { ...input, sexo: input.sexo, empresa: this.empresa() }
      : { ...input, sexo: input.sexo };
    this.auth.register(payload).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => { this.busy.set(false); this.form.controls.contrasena.reset(); }),
    ).subscribe({
      next: () => { this.success.set(true); this.form.reset();
        // CU01: el registro ya dejó la sesión iniciada; se entra directo a la tienda.
        void this.router.navigateByUrl('/tienda'); },
      error: (error: unknown) => this.error.set(authError(error, 'registro')),
    });
  }
}
