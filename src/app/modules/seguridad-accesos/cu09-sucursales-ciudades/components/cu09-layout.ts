import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-cu09-layout', imports: [RouterLink],
  template: `<section><nav aria-label="Organización"><a routerLink="/acceso">Mi acceso</a> ·
    <a routerLink="/admin/ciudades">Ciudades</a> · <a routerLink="/admin/sucursales">Sucursales</a></nav>
    <h1>{{ title() }}</h1><ng-content /></section>`,
  styles: [`section { max-width: 1000px; margin: auto; } nav { margin-bottom: 24px; }`],
})
export class Cu09Layout { readonly title = input.required<string>(); }
