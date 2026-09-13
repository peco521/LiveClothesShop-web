import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({ selector: 'app-cu06-layout', imports: [RouterLink],
  template: `<section aria-labelledby="cu06-title">
    <nav aria-label="Administración de roles"><a routerLink="/acceso">Mi acceso</a> · <a routerLink="/admin/roles">Roles y permisos</a></nav>
    <h1 id="cu06-title">{{ title() }}</h1>
    @if (error()) { <div class="notice error" role="alert"><p>{{ error() }}</p><a routerLink="/acceso">Verificar mi acceso</a></div> }
    <ng-content />
  </section>`,
  styles: `:host { display: block; max-width: 1080px; margin: 32px auto; padding: 20px; }
    section { background: var(--paper); padding: clamp(16px, 4vw, 40px); border: 1px solid var(--line); border-radius: 12px; }
    nav { line-height: 1.8; } h1 { font-size: 1.7rem; }`,
})
export class Cu06Layout {
  readonly title = input.required<string>();
  readonly error = input('');
}
