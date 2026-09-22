import { CurrencyPipe, DatePipe, isPlatformBrowser } from '@angular/common';
import { Component, computed, effect, ElementRef, inject, input, output, PLATFORM_ID, viewChild } from '@angular/core';
import { CompraDetalle } from '../models/historial.models';
import { CompraEstados } from './compra-estados';

/**
 * CU15: panel lateral con el detalle de una compra del historial interno.
 *
 * El detalle se abre en un cajón propio (`role="dialog"`) encima de la lista de
 * compras, de modo que la búsqueda y las compras encontradas siguen a la vista.
 * Se cierra con el botón «Cerrar», con la tecla Escape o pulsando fuera del
 * panel, y sólo dibuja los importes que entrega el backend (no los recalcula).
 */
@Component({
  selector: 'app-detalle-compra-panel',
  imports: [DatePipe, CurrencyPipe, CompraEstados],
  templateUrl: './detalle-compra-panel.html',
  styleUrl: './detalle-compra-panel.css',
  host: { '(document:keydown.escape)': 'close()' },
})
export class DetalleCompraPanel {
  private readonly platform = inject(PLATFORM_ID);
  private readonly closeButton = viewChild<ElementRef<HTMLButtonElement>>('closeButton');
  readonly open = input(false);
  readonly purchase = input<CompraDetalle | null>(null);
  readonly loading = input(false);
  readonly error = input('');
  readonly closed = output<void>();
  readonly titulo = computed(() => {
    const row = this.purchase();
    return row ? `Detalle de compra #${row.nroVenta}` : 'Detalle de compra';
  });

  constructor() {
    // Al abrirse, el foco entra al panel para que Escape y el botón de cierre
    // funcionen con teclado sin recorrer la lista que queda detrás.
    effect(() => {
      const button = this.closeButton();
      if (this.open() && button && isPlatformBrowser(this.platform)) button.nativeElement.focus();
    });
    // El fondo no se desplaza mientras el panel está abierto.
    effect(onCleanup => {
      if (!isPlatformBrowser(this.platform)) return;
      const { body } = document;
      const previous = body.style.overflow;
      if (this.open()) body.style.overflow = 'hidden';
      onCleanup(() => { body.style.overflow = previous; });
    });
  }

  /** El cierre sólo se notifica cuando el panel está abierto (Escape global). */
  close(): void { if (this.open()) this.closed.emit(); }
}
