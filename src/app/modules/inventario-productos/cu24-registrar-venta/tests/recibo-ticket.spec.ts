import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReciboTicket } from '../components/recibo-ticket';
import { Sale } from '../../shared/operaciones.models';

/** Venta de caja pagada, con dos prendas y una promoción del 10 %. */
const venta: Sale = {
  nroVenta: 12, fechaHora: '2026-09-19T15:30:00', estado: 'registrada', idCliente: 'cliente-1',
  cliente: 'Ana María Pérez Gómez', empleado: 'Juan Pérez', brutoTotal: '230.92', descAplicado: '20.00',
  total: '210.92', sucursal: { nombre: 'Villa 1ro de Mayo', ciudad: 'La Paz' },
  items: [
    { idDetalleVenta: 1, idVar: 'Var-A', sku: 'SKU-A', producto: 'Polera Nike', cantidad: 2,
      precioUnitario: '45.46', subtotalBruto: '90.92' },
    { idDetalleVenta: 2, idVar: 'Var-B', sku: 'SKU-B', producto: 'Pantalón', cantidad: 1,
      precioUnitario: '140.00', subtotalBruto: '140.00' }],
  descuentos: [{ nombre: 'Descuento verano', tipoDescuento: 'porcentaje', valorDescuento: '10.00', monto: '20.00' }],
  pagos: [{ estado: 'aprobado', metodo: 'efectivo' }],
};

function montar(value: Sale): ComponentFixture<ReciboTicket> {
  const fixture = TestBed.createComponent(ReciboTicket);
  fixture.componentRef.setInput('sale', value);
  fixture.detectChanges();
  return fixture;
}

describe('CU24 recibo imprimible', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [ReciboTicket] }));

  it('arma el ticket con tienda, fecha, empleado, cliente, prendas, descuento y total', () => {
    const texto = montar(venta).nativeElement.textContent as string;
    expect(texto).toContain('Villa 1ro de Mayo');
    expect(texto).toContain('19/09/2026 15:30');
    // El empleado llega del backend como «nombre + primer apellido» y no se amplía.
    expect(texto).toContain('Juan Pérez');
    expect(texto).toContain('Ana María Pérez Gómez');
    expect(texto).not.toContain('@');
    expect(texto).toContain('Subtotal');
    expect(texto).toContain('230.92');
    expect(texto).toContain('Descuento verano');
    expect(texto).toContain('Tipo: Porcentaje');
    expect(texto).toContain('Descuento: 10%');
    expect(texto).toContain('Descuento total');
    expect(texto).toContain('20.00');
    expect(texto).toContain('USD210.92');
    expect(texto).toContain('Gracias por comprar en Villa 1ro de Mayo');
  });

  it('cada fila imprime cantidad, precio unitario y costo de la línea', () => {
    const nodos = montar(venta).nativeElement.querySelectorAll('tbody th, tbody td') as NodeListOf<HTMLElement>;
    expect(Array.from(nodos).map(celda => celda.textContent?.trim()))
      .toEqual(['Polera Nike', '2', '45.46', '90.92', 'Pantalón', '1', '140.00', '140.00']);
  });

  it('la venta anónima se imprime como Consumidor final y sin empleado registrado', () => {
    const fixture = montar({ ...venta, cliente: null, empleado: null });
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Consumidor final');
    expect(texto).toContain('No asignado');
  });

  it('no imprime la sección de descuentos cuando la venta no tiene descuentos', () => {
    const texto = montar({ ...venta, descuentos: [], descAplicado: '0.00' }).nativeElement.textContent as string;
    expect(texto).not.toContain('Descuentos');
    expect(texto).not.toContain('Tipo:');
  });

  it('avisa en el papel cuando el pago todavía no está confirmado', () => {
    expect(montar({ ...venta, pagos: [] }).nativeElement.textContent).toContain('Documento sin pago confirmado');
    expect(montar(venta).nativeElement.textContent).not.toContain('Documento sin pago confirmado');
  });

  it('deja una sola raíz .receipt sin imágenes ni códigos QR para el aislamiento de impresión', () => {
    const host: HTMLElement = montar(venta).nativeElement;
    expect(host.querySelectorAll('.receipt').length).toBe(1);
    expect(host.querySelector('img, svg, canvas')).toBeNull();
    expect((host.textContent as string).toLowerCase()).not.toContain('qr');
  });
});
