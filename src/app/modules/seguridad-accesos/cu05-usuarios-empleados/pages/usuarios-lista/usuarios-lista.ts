import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { Cu05Layout } from '../../components/cu05-layout';
import { UsuariosFiltros, UsuariosListado } from '../../models/usuario.models';
import { UsuariosService } from '../../services/usuarios.service';
import { usuarioError } from '../../services/usuario-error';

@Component({ selector: 'app-usuarios-lista', imports: [Cu05Layout, ReactiveFormsModule, RouterLink],
  templateUrl: './usuarios-lista.html',
  styles: `.table-scroll { overflow-x: auto; } table { width: 100%; border-collapse: collapse; } th, td { text-align: left; padding: 12px; border-bottom: 1px solid var(--line); } .actions { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; margin: 20px 0; }`,
})
export class UsuariosListaPage {
  private readonly service = inject(UsuariosService);
  private readonly destroy = inject(DestroyRef);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly result = signal<UsuariosListado | null>(null);
  readonly form = inject(NonNullableFormBuilder).group({ q: [''], tipo: ['' as '' | 'A' | 'E'], limit: [20] });
  private filters: UsuariosFiltros = { offset: 0, limit: 20 };
  constructor() { this.load(0); }
  aplicar(): void {
    if (this.busy()) return;
    const value = this.form.getRawValue();
    this.filters = { offset: 0, limit: value.limit, q: value.q, ...(value.tipo ? { tipo: value.tipo } : {}) };
    this.load(0);
  }
  load(offset = this.filters.offset): void {
    if (this.busy()) return;
    this.filters = { ...this.filters, offset };
    this.busy.set(true); this.error.set(''); this.result.set(null);
    this.service.listar(this.filters).pipe(takeUntilDestroyed(this.destroy), finalize(() => this.busy.set(false))).subscribe({
      next: value => this.result.set(value), error: (error: unknown) => this.error.set(usuarioError(error)),
    });
  }
}
