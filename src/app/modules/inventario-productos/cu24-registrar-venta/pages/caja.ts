import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { InventarioPanel, requestError } from '../../shared/panel';
import { OperacionesService } from '../../shared/operaciones.service';
import { Customer, Refs, Sale } from '../../shared/operaciones.models';
import { ProductoDetalle, ProductosListado, VarianteDetalle } from '../../../cliente-experiencia-compra/cu10-consultar-prendas/models/catalogo.models';

type ElectronicMethod = 'tarjeta' | 'QR' | 'transferencia';
interface DraftLine { idVar: string; producto: string; talla: string; colores: string; imagen: string | null; cantidad: number }
// CU24: alta de cliente en el mostrador (no cambia la sesión del cajero).
interface NewCustomerDraft { ci: string; nombres: string; apellidoPat: string; apellidoMat: string; sexo: 'M' | 'F';
  correo: string; telefono: string; direccion: string; fechaNac: string; contrasena: string }

@Component({ selector: 'app-punto-de-venta', imports: [FormsModule, CurrencyPipe, DatePipe, InventarioPanel],
  templateUrl: './caja.html', styleUrls: ['../../shared/panel.css', '../../shared/operaciones.css'] })
export class PuntoDeVentaPage {
  private readonly service = inject(OperacionesService);
  private readonly destroy = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly refs = signal<Refs | null>(null);
  readonly customers = signal<Customer[]>([]);
  readonly selectedCustomer = signal<Customer | null>(null);
  readonly reservaCliente = signal<string | null>(null);
  readonly productRows = signal<ProductosListado | null>(null);
  readonly product = signal<ProductoDetalle | null>(null);
  readonly sale = signal<Sale | null>(null);
  readonly busy = signal(false);
  readonly saving = signal(false);
  readonly picker = signal(false);
  readonly registrando = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  nroSuc = 0;
  nroReserva: number | null = null;
  customerQ = '';
  productQ = '';
  received = 0;
  metodo: ElectronicMethod = 'tarjeta';
  confirmCancel = false;
  operationKey = this.newKey();
  draft: DraftLine[] = [];
  nuevo: NewCustomerDraft = { ci: '', nombres: '', apellidoPat: '', apellidoMat: '', sexo: 'F',
    correo: '', telefono: '', direccion: '', fechaNac: '', contrasena: '' };

  constructor() { this.readReservation(); this.loadReferences(); }

  private newKey(): string {
    return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  loadReferences(): void {
    this.service.get<Refs>('caja/referencias').pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: refs => { this.refs.set(refs); if (refs.sucursalAsignada !== null) this.nroSuc = refs.sucursalAsignada; },
      error: e => this.error.set(requestError(e, this.router)),
    });
  }

  /** Reserva confirmada en CU22 que se cobra aquí: el pago la marca como atendida. */
  private readReservation(): void {
    const params = this.route.snapshot.queryParamMap;
    const nro = Number(params.get('reserva') ?? '');
    if (!nro) return;
    this.nroReserva = nro;
    const sucursal = Number(params.get('sucursal') ?? '');
    if (sucursal) this.nroSuc = sucursal;
    const cliente = params.get('cliente');
    if (cliente) { this.reservaCliente.set(cliente); this.loadReservationCustomer(cliente); }
    this.success.set(`Reserva #${nro} confirmada: revisa las prendas reservadas y confirma el cobro; el pago marcará la reserva como atendida.`);
  }

  private loadReservationCustomer(idCliente: string): void {
    this.service.get<Customer[]>('caja/clientes', { idUsuario: idCliente })
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: rows => { this.customers.set(rows); this.selectedCustomer.set(rows.length ? rows[0] : null); },
        error: e => this.error.set(requestError(e, this.router)),
      });
  }

  clearReservation(): void {
    this.nroReserva = null; this.reservaCliente.set(null); this.success.set('');
  }

  /** CU24: registra al cliente en el mostrador y lo selecciona, sin cambiar la sesión. */
  registrarCliente(): void {
    if (this.saving()) return;
    const data = this.nuevo;
    if (!data.ci.trim() || !data.nombres.trim() || !data.apellidoPat.trim() || !data.apellidoMat.trim()
        || !data.correo.trim() || !data.telefono.trim() || !data.direccion.trim() || !data.fechaNac
        || data.contrasena.length < 12) {
      this.error.set('Completa los datos del cliente (la contraseña debe tener al menos 12 caracteres).'); return;
    }
    this.saving.set(true); this.error.set(''); this.success.set('');
    this.service.send<Customer>('caja/clientes', {
      ci: data.ci.trim(), nombres: data.nombres.trim(), apellidoPat: data.apellidoPat.trim(),
      apellidoMat: data.apellidoMat.trim(), sexo: data.sexo, correo: data.correo.trim().toLowerCase(),
      telefono: data.telefono.trim(), direccion: data.direccion.trim(),
      fechaNac: data.fechaNac, contrasena: data.contrasena })
      .pipe(takeUntilDestroyed(this.destroy), finalize(() => this.saving.set(false))).subscribe({
        next: value => {
          this.customers.set([value]);
          this.selectedCustomer.set(value);
          this.nuevo = { ci: '', nombres: '', apellidoPat: '', apellidoMat: '', sexo: 'F',
            correo: '', telefono: '', direccion: '', fechaNac: '', contrasena: '' };
          this.registrando.set(false);
          this.success.set('Cliente registrado y seleccionado para esta venta.');
        },
        error: e => this.error.set(requestError(e, this.router)),
      });
  }

  /** CU24: venta anónima; no se inventa un cliente genérico. */
  usarSinRegistro(): void {
    this.selectedCustomer.set(null); this.customers.set([]); this.customerQ = '';
    this.error.set(''); this.success.set('Venta sin registro: se guardará como venta anónima (sin cliente).');
  }

  searchCustomers(): void {
    this.service.get<Customer[]>('caja/clientes', { q: this.customerQ.trim() })
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: rows => this.customers.set(rows),
        error: e => { this.customers.set([]); this.error.set(requestError(e, this.router)); },
      });
  }

  searchProducts(offset = 0): void {
    this.service.get<ProductosListado>('caja/productos', { q: this.productQ.trim(), offset, limit: 12 })
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: rows => this.productRows.set(rows),
        error: e => { this.productRows.set(null); this.error.set(requestError(e, this.router)); },
      });
  }

  selectProduct(idProd: string): void {
    this.service.get<ProductoDetalle>(`caja/productos/${encodeURIComponent(idProd)}`)
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: value => this.product.set(value),
        error: e => this.error.set(requestError(e, this.router)),
      });
  }

  addVariant(variant: VarianteDetalle): void {
    const product = this.product();
    if (!product) return;
    const existing = this.draft.find(line => line.idVar === variant.idVariante);
    if (existing) existing.cantidad++;
    else this.draft.push({ idVar: variant.idVariante, producto: product.descripcion,
      talla: variant.talla.descripcion, colores: variant.colores.map(c => c.descripcion).join(', ') || 'Sin color',
      imagen: variant.imagen, cantidad: 1 });
    this.success.set('Prenda añadida a la venta.');
  }

  removeDraft(index: number): void { this.draft.splice(index, 1); }

  prepareSale(): void {
    if (this.saving()) return;
    if (!this.nroSuc || !this.draft.length || this.draft.some(line => !Number.isInteger(line.cantidad) || line.cantidad < 1)) {
      this.error.set('Selecciona sucursal y prendas con cantidades válidas.'); return;
    }
    if (this.nroReserva && !this.selectedCustomer()) {
      // CU24: una venta de reserva siempre exige el cliente titular.
      this.error.set('La reserva requiere su cliente registrado.'); return;
    }
    this.saving.set(true); this.error.set(''); this.success.set('');
    this.service.send<Sale>('caja', { claveOperacion: this.operationKey, nroSuc: this.nroSuc,
      idCliente: this.selectedCustomer()?.idUsuario ?? null, nroReserva: this.nroReserva || null,
      items: this.draft.map(line => ({ idVar: line.idVar, cantidad: line.cantidad })) })
      .pipe(takeUntilDestroyed(this.destroy), finalize(() => this.saving.set(false))).subscribe({
        next: value => { this.sale.set(value); this.picker.set(false); this.success.set('Venta preparada. El inventario se descuenta al confirmar el pago.'); },
        error: e => this.error.set(requestError(e, this.router)),
      });
  }

  cash(): void {
    const row = this.sale();
    if (this.saving() || !row) return;
    if (!(Number(this.received) >= 0)) { this.error.set('Indica el efectivo recibido.'); return; }
    this.saving.set(true); this.error.set(''); this.success.set('');
    this.service.send<Sale>(`caja/${row.nroVenta}/efectivo`, { recibido: Number(this.received) })
      .pipe(takeUntilDestroyed(this.destroy), finalize(() => this.saving.set(false))).subscribe({
        next: value => { this.sale.set(value); this.success.set('Pago en efectivo confirmado.'); },
        error: e => this.error.set(requestError(e, this.router)),
      });
  }

  electronic(): void {
    const row = this.sale();
    if (this.saving() || !row) return;
    this.saving.set(true); this.error.set(''); this.success.set('');
    this.service.send<{ checkoutUrl?: string; estado?: string }>(`caja/${row.nroVenta}/electronico`, { metodo: this.metodo })
      .pipe(takeUntilDestroyed(this.destroy), finalize(() => this.saving.set(false))).subscribe({
        next: value => {
          if (value.checkoutUrl) {
            const url = new URL(value.checkoutUrl);
            if (url.protocol === 'https:' && url.hostname === 'checkout.stripe.com') window.open(url.href, '_blank', 'noopener,noreferrer');
          }
          this.success.set('Pago iniciado. Consulta el estado para confirmar el resultado.');
          this.refreshSale();
        },
        error: e => this.error.set(requestError(e, this.router)),
      });
  }

  refreshSale(): void {
    const row = this.sale();
    if (this.saving() || !row) return;
    this.saving.set(true); this.error.set('');
    this.service.send<Sale>(`caja/${row.nroVenta}/consultar-pago`)
      .pipe(takeUntilDestroyed(this.destroy), finalize(() => this.saving.set(false))).subscribe({
        next: value => { this.sale.set(value); this.success.set('Estado de pago actualizado.'); },
        error: e => this.error.set(requestError(e, this.router)),
      });
  }

  cancelSale(): void {
    const row = this.sale();
    if (this.saving() || !row) return;
    this.saving.set(true); this.error.set(''); this.success.set('');
    this.service.send<Sale>(`caja/${row.nroVenta}/cancelar`)
      .pipe(takeUntilDestroyed(this.destroy), finalize(() => this.saving.set(false))).subscribe({
        next: () => { this.sale.set(null); this.draft = []; this.selectedCustomer.set(null); this.confirmCancel = false;
          this.operationKey = this.newKey(); this.success.set('Venta cancelada sin descontar existencias.'); },
        error: e => this.error.set(requestError(e, this.router)),
      });
  }

  newSale(): void {
    this.sale.set(null); this.draft = []; this.selectedCustomer.set(null); this.customers.set([]);
    this.product.set(null); this.received = 0; this.nroReserva = null; this.confirmCancel = false;
    this.reservaCliente.set(null);
    this.operationKey = this.newKey(); this.success.set(''); this.error.set('');
  }

  paid(): boolean { return this.sale()?.pagos?.some(payment => payment.estado === 'aprobado') === true; }
  print(): void { window.print(); }
}
