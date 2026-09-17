import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-cu09-layout', imports: [RouterLink],
  template: `<section class="record-panel" aria-labelledby="cu09-title"><nav aria-label="Organización"><a routerLink="/acceso">Mi acceso</a> ·
    <a routerLink="/admin/ciudades">Ciudades</a> · <a routerLink="/admin/sucursales">Sucursales</a></nav>
    <h1 id="cu09-title">{{ title() }}</h1><ng-content /></section>`,
  styles: `:host { display: block; max-width: 1080px; margin: 32px auto; padding: 20px; }
    section { background: var(--paper); padding: clamp(16px, 4vw, 40px); border: 1px solid var(--line); border-radius: 12px; }
    nav { line-height: 1.8; } h1 { font-size: 1.7rem; }
    @media (max-width: 600px) { :host { margin: 12px auto; padding: 0; } }`,
})
export class Cu09Layout { readonly title = input.required<string>(); }
