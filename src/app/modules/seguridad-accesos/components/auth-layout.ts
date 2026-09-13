import { Component, input } from '@angular/core';

@Component({
  selector: 'app-auth-layout',
  templateUrl: './auth-layout.html',
  styleUrl: './auth-layout.css',
})
export class AuthLayout {
  readonly eyebrow = input('TU ESTILO, TU ESPACIO');
  readonly title = input.required<string>();
  readonly description = input.required<string>();
}
