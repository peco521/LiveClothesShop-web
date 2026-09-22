import { Component, computed, input } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Sale, SaleDiscount } from '../../shared/operaciones.models';

/** Descuento listo para imprimir: el tipo y el valor ya se leen en el ticket. */
interface ReceiptDiscount { nombre: string; tipo: string; valor: string; monto: number }

/** Línea del ticket: el costo sale del subtotal congelado de la venta. */
interface ReceiptLine { idDetalleVenta: number; producto: string; cantidad: number; precio: number; costo: number }

function tipoLegible(discount: SaleDiscount): string {
  return discount.tipoDescuento === 'porcentaje' ? 'Porcentaje' : 'Monto';
}

function valorLegible(discount: SaleDiscount): string {
  if (discount.valorDescuento === null || discount.valorDescuento === undefined) return '—';
  const valor = Number(discount.valorDescuento);
  return discount.tipoDescuento === 'porcentaje' ? `${valor}%` : valor.toFixed(2);
}

/**
 * CU24: recibo de pago con estilo de ticket térmico (80 mm, adaptable a 58 mm).
 *
 * Sólo dibuja el comprobante: los botones viven fuera del componente y el CSS
 * global de impresión (`src/styles.css`) imprime únicamente el bloque `.receipt`,
 * de modo que la navegación, el resto de la página y los botones no salen en papel.
 * Los importes se muestran tal como los entrega el backend (nunca se recalculan).
 */
@Component({ selector: 'app-recibo-ticket', imports: [CurrencyPipe, DatePipe, DecimalPipe],
  templateUrl: './recibo-ticket.html', styleUrl: './recibo-ticket.css' })
export class ReciboTicket {
  readonly sale = input.required<Sale>();
  readonly store = computed(() => this.sale().sucursal?.nombre?.trim() || 'Tienda');
  readonly city = computed(() => this.sale().sucursal?.ciudad?.trim() ?? '');
  /** El backend entrega el empleado como «nombre + primer apellido». */
  readonly employee = computed(() => this.sale().empleado?.trim() || 'No asignado');
  readonly customer = computed(() => this.sale().cliente?.trim() || 'Consumidor final');
  readonly lines = computed<ReceiptLine[]>(() => (this.sale().items ?? []).map(item => {
    const precio = Number(item.precioUnitario);
    return { idDetalleVenta: item.idDetalleVenta, producto: item.producto, cantidad: item.cantidad,
      precio, costo: item.subtotalBruto === undefined ? precio * item.cantidad : Number(item.subtotalBruto) };
  }));
  readonly subtotal = computed(() => this.sale().brutoTotal === undefined
    ? this.lines().reduce((suma, line) => suma + line.costo, 0) : Number(this.sale().brutoTotal));
  readonly discounts = computed<ReceiptDiscount[]>(() => (this.sale().descuentos ?? []).map(discount => ({
    nombre: discount.nombre, tipo: tipoLegible(discount), valor: valorLegible(discount),
    monto: Number(discount.monto) })));
  readonly total = computed(() => Number(this.sale().total));
  readonly paid = computed(() => this.sale().pagos?.some(pago => pago.estado === 'aprobado') === true);
}
