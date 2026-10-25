import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({ selector: 'app-cu10-layout', imports: [RouterLink],
  template: `<section aria-labelledby="cu10-title">
    <nav aria-label="Tienda"><a routerLink="/tienda">Catálogo</a></nav>
    <h1 id="cu10-title">{{ title() }}</h1>
    @if (error()) { <div class="notice error" role="alert"><p>{{ error() }}</p><a routerLink="/login">Iniciar sesión</a></div> }
    <ng-content />
  </section>`,
  styles: `:host { display: block; max-width: 1320px; margin: 12px auto; padding: 0; }
    section { background: var(--paper); padding: clamp(20px, 4vw, 44px); border: 1px solid var(--line); border-radius: 24px; box-shadow: 0 18px 55px #4a2b1c08; }
    nav { line-height: 1.8; font-size: .82rem; color: var(--muted); } nav a { text-decoration: none; }
    h1 { margin: 8px 0 26px; font-family: Georgia, 'Times New Roman', serif; font-size: clamp(2rem, 4vw, 3rem); font-weight: 500; letter-spacing: -.04em; }`,
})
export class Cu10Layout {
  readonly title = input.required<string>();
  readonly error = input('');
}
