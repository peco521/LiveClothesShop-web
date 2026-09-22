import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({ selector: 'app-cu12-layout', imports: [RouterLink], host: { '[class.plain]': 'plain()' },
  template: `<section aria-labelledby="cu12-title">
    <nav aria-label="Tienda"><a routerLink="/tienda">Catálogo</a> · <a routerLink="/tienda/carrito">Carrito</a> · <a routerLink="/tienda/reservas">Mis reservas</a></nav>
    <h1 id="cu12-title">{{ title() }}</h1>
    @if (error()) { <div class="notice error" role="alert"><p>{{ error() }}</p><a routerLink="/login">Iniciar sesión</a></div> }
    <ng-content />
  </section>`,
  styles: `:host { display: block; max-width: 1080px; margin: 24px auto; padding: 20px; }
    section { background: var(--paper); padding: clamp(16px, 4vw, 40px); border: 1px solid var(--line); border-radius: 12px; }
    nav { line-height: 1.8; } h1 { font-size: 1.7rem; }
    :host(.plain) { max-width: none; margin: 0; padding: 0; }
    :host(.plain) section { background: transparent; border: 0; border-radius: 0; padding: 0; }
    :host(.plain) nav { font-size: .85rem; color: var(--muted); }
    :host(.plain) h1 { font-size: clamp(1.6rem, 3vw, 2.1rem); margin: 22px 0 32px; }`,
})
export class Cu12Layout {
  readonly title = input.required<string>();
  readonly error = input('');
  readonly plain = input(false);
}
