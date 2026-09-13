import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-cu05-layout', imports: [RouterLink],
  template: `
    <section aria-labelledby="cu05-title">
      <nav aria-label="Administración"><a routerLink="/acceso">Mi acceso</a> · <a routerLink="/admin/usuarios">Usuarios internos</a></nav>
      <h1 id="cu05-title">{{ title() }}</h1>
      @if (error()) {
        <div class="notice error" role="alert"><p>{{ error() }}</p>
          <a routerLink="/login">Iniciar sesión</a> · <a routerLink="/acceso">Volver a mi acceso</a>
        </div>
      }
      <ng-content />
    </section>`,
  styles: `:host { display: block; max-width: 1080px; margin: 32px auto; padding: 20px; }
    section { background: var(--paper); padding: clamp(16px, 4vw, 40px); border: 1px solid var(--line); border-radius: 12px; }
    nav { line-height: 1.8; } h1 { font-size: 1.7rem; }`,
})
export class Cu05Layout {
  readonly title = input.required<string>();
  readonly error = input('');
}
