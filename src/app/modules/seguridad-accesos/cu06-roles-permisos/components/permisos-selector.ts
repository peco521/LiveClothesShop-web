import { Component, computed, effect, input, output, signal } from '@angular/core';
import { FuncionDetalle, mismosPermisos, PermisosDetalle } from '../models/rol.models';

@Component({ selector: 'app-permisos-selector',
  template: `<section aria-labelledby="permisos-title">
    <h2 id="permisos-title">Funciones del rol</h2>
    <p>Guardar reemplaza el conjunto completo de permisos. No se crean funciones desde esta pantalla.</p>
    <p>Debe conservarse al menos un usuario interno con CU06. El servidor verifica esta regla al guardar.</p>
    @if (actual().esRolCliente) {
      <p class="notice" role="status">Este es el rol cliente: no puede recibir funciones. La selección está deshabilitada; el servidor aplica esta protección.</p>
    }
    <fieldset [disabled]="busy() || actual().esRolCliente">
      <legend>Selecciona funciones existentes</legend>
      @for (funcion of funciones(); track funcion.id) {
        <label><input type="checkbox" [checked]="seleccion().includes(funcion.id)" (change)="toggle(funcion.id, $any($event.target).checked)" />
          {{ funcion.id }} — {{ funcion.descripcion || 'Sin descripción' }}</label>
      } @empty { <p>No hay funciones en el catálogo.</p> }
    </fieldset>
    @if (actual().esRolCliente && actual().permisos.length) {
      <p>Permisos heredados: {{ actual().permisos.join(', ') }}. Puedes retirarlos todos.</p>
      <button type="button" [disabled]="busy()" (click)="limpiarCliente()">Retirar todos los permisos heredados</button>
    } @else if (!actual().esRolCliente) {
      <p role="status">{{ cambio() ? 'Hay cambios pendientes de guardar.' : 'No hay cambios en los permisos.' }}</p>
      <button type="button" class="button primary" [disabled]="busy() || !cambio()" (click)="submit()">{{ busy() ? 'Guardando…' : 'Guardar permisos' }}</button>
    }
  </section>`,
  styles: `fieldset { display: grid; gap: 12px; margin: 16px 0; } label { display: flex; gap: 10px; align-items: center; }`,
})
export class PermisosSelectorComponent {
  readonly funciones = input.required<FuncionDetalle[]>();
  readonly actual = input.required<PermisosDetalle>();
  readonly busy = input(false);
  readonly guardar = output<string[]>();
  readonly seleccion = signal<string[]>([]);
  readonly cambio = computed(() => !mismosPermisos(this.actual().permisos, this.seleccion()));
  constructor() { effect(() => this.seleccion.set([...this.actual().permisos])); }
  toggle(id: string, checked: boolean): void {
    if (this.busy() || this.actual().esRolCliente || !this.funciones().some(f => f.id === id)) return;
    this.seleccion.update(ids => checked ? [...new Set([...ids, id])].sort() : ids.filter(value => value !== id));
  }
  submit(): void {
    if (!this.busy() && !this.actual().esRolCliente && this.cambio()) this.guardar.emit([...this.seleccion()]);
  }
  limpiarCliente(): void {
    if (!this.busy() && this.actual().esRolCliente && this.actual().permisos.length) this.guardar.emit([]);
  }
}
