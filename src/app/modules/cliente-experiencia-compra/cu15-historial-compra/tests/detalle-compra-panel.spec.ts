import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DetalleCompraPanel } from '../components/detalle-compra-panel';
import { compra } from './historial.fixtures';

describe('CU15 panel lateral del detalle de compra', () => {
  beforeEach(() => { TestBed.configureTestingModule({}); });

  function create(open = false, purchase: typeof compra | null = compra): ComponentFixture<DetalleCompraPanel> {
    const fixture = TestBed.createComponent(DetalleCompraPanel);
    fixture.componentRef.setInput('open', open);
    fixture.componentRef.setInput('purchase', purchase);
    fixture.detectChanges();
    return fixture;
  }

  it('permanece oculto mientras no se solicita el detalle', () => {
    const fixture = create();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('.detalle-backdrop')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Camisa Oxford');
  });

  it('muestra la compra en un panel propio con sus importes congelados', () => {
    const fixture = create(true);
    const dialog = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('detalle-compra-titulo');
    for (const value of ['Detalle de compra #11', 'Camisa Oxford', 'SKU-1', 'Central', 'Pago aprobado', 'Subtotal', 'Total']) {
      expect(dialog.textContent).toContain(value);
    }
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(1);
  });

  it('avisa de la carga y del error sin mostrar datos de la compra', () => {
    const fixture = TestBed.createComponent(DetalleCompraPanel);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('purchase', null);
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Cargando detalle');
    fixture.componentRef.setInput('loading', false);
    fixture.componentRef.setInput('error', 'No fue posible obtener la información. Inténtalo nuevamente.');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('No fue posible');
    expect(fixture.nativeElement.textContent).not.toContain('Camisa Oxford');
  });

  it('se cierra con el botón, con Escape y pulsando fuera del panel', () => {
    const fixture = create(true);
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);
    (fixture.nativeElement.querySelector('.detalle-cerrar') as HTMLButtonElement).click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    (fixture.nativeElement.querySelector('.detalle-backdrop') as HTMLElement).click();
    expect(closed).toHaveBeenCalledTimes(3);
  });

  it('ignora Escape cuando el panel ya está cerrado', () => {
    const fixture = create();
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(closed).not.toHaveBeenCalled();
  });

  it('bloquea el desplazamiento del fondo sólo mientras está abierto', () => {
    const fixture = create(true);
    expect(document.body.style.overflow).toBe('hidden');
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    expect(document.body.style.overflow).toBe('');
  });
});
