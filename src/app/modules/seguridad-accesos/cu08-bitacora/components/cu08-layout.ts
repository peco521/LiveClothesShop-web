import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({ selector: 'app-cu08-layout', imports: [RouterLink],
  template: `<section aria-labelledby="cu08-title">
    <nav aria-label="Administración"><a routerLink="/acceso">Mi acceso</a> · <a routerLink="/admin/bitacora">Bitácora</a></nav>
    <h1 id="cu08-title">{{ title() }}</h1>
    @if (error()) { <div class="notice error" role="alert"><p>{{ error() }}</p><a routerLink="/login">Iniciar sesión</a> · <a routerLink="/acceso">Volver a mi acceso</a></div> }
    <ng-content />
  </section>`,
  styles: `:host { display: block; max-width: 1120px; margin: 32px auto; padding: 20px; }
    section { background: var(--paper); padding: clamp(16px, 4vw, 40px); border: 1px solid var(--line); border-radius: 12px; }
    nav { line-height: 1.8; } h1 { font-size: 1.7rem; }`,
})
export class Cu08Layout {
  readonly title = input.required<string>(); readonly error = input('');
}
