import { DatePipe } from '@angular/common';
import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { CatalogoOfflineRepository } from '../services/catalogo-offline.repository';
import { CatalogoService } from '../services/catalogo.service';

@Component({
  selector: 'app-catalogo-offline-panel',
  imports: [DatePipe],
  template: `
    <section aria-label="Catálogo sin conexión" class="offline-panel">
      <strong>{{ repository.usingOffline() ? 'Consultando descarga sin conexión' : 'Catálogo sin conexión' }}</strong>
      @if (repository.snapshot(); as saved) {
        <p>Subconjunto descargado: {{ saved.productos.length }} prendas. Descarga actualizada: {{ saved.actualizado | date:'medium' }}.</p>
        <p>{{ repository.stale() ? 'Datos históricos, pueden estar desactualizados.' : 'Copia local disponible para esta cuenta y empresa.' }}
          Precios y existencias conocidas no garantizan disponibilidad ni reservan stock. Las imágenes requieren conexión.</p>
        <button type="button" (click)="remove()" [disabled]="busy()">Eliminar descarga de esta cuenta</button>
      } @else {
        <p>Descarga explícitamente la página visible para consultar prendas, variantes y existencias conocidas sin red.</p>
      }
      @if (ids().length) {
        <button type="button" (click)="download()" [disabled]="busy() || repository.usingOffline()">
          {{ busy() ? 'Guardando…' : 'Descargar página visible (' + ids().length + ' prendas)' }}
        </button>
        <small>Reemplaza la descarga anterior de esta cuenta. No descarga todo el catálogo.</small>
      }
      @if (message()) { <p role="status">{{ message() }}</p> }
    </section>
  `,
  styles: [`.offline-panel{padding:1rem;margin-bottom:1rem;border:1px solid #cbd5e1;border-radius:.5rem;background:#f8fafc;color:#172033}.offline-panel p{margin:.4rem 0}.offline-panel button{margin:.3rem .6rem .3rem 0;padding:.5rem;cursor:pointer}.offline-panel small{display:block}`],
})
export class CatalogoOfflinePanel {
  readonly ids = input<string[]>([]);
  readonly repository = inject(CatalogoOfflineRepository);
  private readonly service = inject(CatalogoService);
  readonly busy = signal(false);
  readonly message = signal('');
  constructor() {
    effect(() => {
      this.repository.owner();
      untracked(() => { this.busy.set(false); this.message.set(''); });
    });
  }

  async download(): Promise<void> {
    if (this.busy()) return;
    const owner = this.repository.owner();
    this.busy.set(true); this.message.set('');
    try {
      await this.service.descargar(this.ids());
      if (this.repository.current(owner)) this.message.set('Descarga completa. Puedes consultar este subconjunto sin conexión incluso después de recargar con una sesión válida.');
    } catch {
      if (this.repository.current(owner)) this.message.set('No se completó la descarga. Comprueba conexión, sesión y espacio disponible. La copia anterior se conserva.');
    } finally {
      if (this.repository.current(owner)) this.busy.set(false);
    }
  }

  async remove(): Promise<void> {
    if (this.busy()) return;
    const owner = this.repository.owner();
    this.busy.set(true); this.message.set('');
    try {
      await this.repository.remove();
      if (this.repository.current(owner)) this.message.set('Descarga eliminada.');
    } catch {
      if (this.repository.current(owner)) this.message.set('No se pudo eliminar la descarga. Inténtalo de nuevo.');
    } finally {
      if (this.repository.current(owner)) this.busy.set(false);
    }
  }
}
