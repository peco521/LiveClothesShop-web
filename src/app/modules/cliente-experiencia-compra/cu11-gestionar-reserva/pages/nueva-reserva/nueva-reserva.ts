import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, finalize, of, Subscription, switchMap } from 'rxjs';
import { Cu11Layout } from '../../components/cu11-layout';
import { HorariosSucursal, SucursalCliente } from '../../models/reserva.models';
import { ReservasService } from '../../services/reservas.service';
import { reservaError } from '../../services/reserva-error';
import { CatalogoService } from '../../../cu10-consultar-prendas/services/catalogo.service';
import { ProductoDetalle, ProductosListado } from '../../../cu10-consultar-prendas/models/catalogo.models';

function hoy(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

@Component({ selector: 'app-nueva-reserva', imports: [Cu11Layout, ReactiveFormsModule, RouterLink],
  templateUrl: './reserva-form.html', styleUrl: './nueva-reserva.css',
})
export class NuevaReservaPage {
  private readonly service = inject(ReservasService);
  private readonly catalogo = inject(CatalogoService);
  readonly prendas = signal<Record<string, ProductoDetalle>>({});
  readonly selector = signal(false);
  readonly resultados = signal<ProductosListado | null>(null);
  readonly seleccion = signal<ProductoDetalle | null>(null);
  readonly buscando = signal(false);
  readonly cargando = signal(0);
  readonly busqueda = new FormControl('', { nonNullable: true });
  private searchRequest?: Subscription;
  private detailRequest?: Subscription;
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy = inject(DestroyRef);
  private request?: Subscription;
  readonly busy = signal(false); readonly error = signal('');
  readonly sucursales = signal<SucursalCliente[]>([]);
  readonly horarios = signal<HorariosSucursal | null>(null);
  readonly minima = hoy();
  dayNames(days?: number[]): string { const names = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']; return (days ?? [1, 2, 3, 4, 5, 6, 7]).map(day => names[day - 1]).join(', '); }
  private readonly builder = inject(NonNullableFormBuilder);
  readonly form = this.builder.group({
    nroSuc: [0, [Validators.required, Validators.min(1)]],
    fechaReserva: [hoy(), Validators.required],
    horaAtencion: ['10:00', Validators.required],
    items: this.builder.array<FormGroup<{ idVar: FormControl<string>; cantidad: FormControl<number> }>>([]),
  });
  get items(): FormArray<FormGroup<{ idVar: FormControl<string>; cantidad: FormControl<number> }>> {
    return this.form.controls.items;
  }
  constructor() {
    this.service.sucursales().pipe(takeUntilDestroyed()).subscribe({ next: rows => this.sucursales.set(rows), error: e => this.error.set(reservaError(e)) });
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(params => {
      const idVar = params.get('idVar'), cantidad = Number(params.get('cantidad') ?? 1);
      if (idVar && this.items.length === 0) this.agregar(idVar, Number.isInteger(cantidad) && cantidad >= 1 ? cantidad : 1);
    });
    this.form.controls.nroSuc.valueChanges.pipe(switchMap(nro => {
      this.horarios.set(null);
      return nro >= 1 ? this.service.horarios(Number(nro)).pipe(catchError(e => { this.error.set(reservaError(e)); return of(null); })) : of(null);
    }), takeUntilDestroyed(this.destroy)).subscribe(value => this.horarios.set(value));
  }
  agregar(idVar = '', cantidad = 1): void {
    if (this.busy()) return;
    if (!idVar) { this.selector.set(true); this.buscar(); return; }
    const existente = this.items.controls.find(row => row.controls.idVar.value === idVar);
    if (existente) { existente.controls.cantidad.setValue(existente.controls.cantidad.value + cantidad); return; }
    this.items.push(this.builder.group({
      idVar: this.builder.control(idVar, [Validators.required, Validators.maxLength(15)]),
      cantidad: this.builder.control(cantidad, [Validators.required, Validators.min(1), Validators.pattern(/^[1-9]\d*$/)]),
    }));
    if (!this.prendas()[idVar]) this.cargarPrenda(idVar);
  }
  cargarPrenda(id: string): void {
    this.cargando.update(n => n + 1);
    this.catalogo.detalleVariante(id).pipe(takeUntilDestroyed(this.destroy), finalize(() => this.cargando.update(n => n - 1))).subscribe({
      next: product => this.recordar(product), error: e => this.error.set(reservaError(e)),
    });
  }
  private recordar(product: ProductoDetalle): void {
    this.prendas.update(rows => ({ ...rows, ...Object.fromEntries(product.variantes.map(v => [v.idVariante, product])) }));
  }
  variante(id: string) { return this.prendas()[id]?.variantes.find(v => v.idVariante === id); }
  colores(id: string): string { return this.variante(id)?.colores.map(c => c.descripcion).join(', ') || 'Sin color registrado'; }
  disponibles(id: string): number {
    return (this.prendas()[id]?.disponibilidad ?? []).filter(row => row.idVariante === id && row.nroSuc === Number(this.form.controls.nroSuc.value)).reduce((sum, row) => sum + row.cantDisp, 0);
  }
  total(): number { return this.items.controls.reduce((sum, row) => sum + (Number(row.controls.cantidad.value) || 0), 0); }
  cambiarCantidad(index: number, cambio: number): void {
    if (this.busy()) return;
    const control = this.items.at(index).controls.cantidad;
    const next = Number(control.value) + cambio;
    if (next >= 1) control.setValue(next);
  }
  quitar(index: number): void { if (!this.busy()) this.items.removeAt(index); }
  buscar(offset = 0): void {
    this.searchRequest?.unsubscribe(); this.buscando.set(true); this.error.set('');
    this.searchRequest = this.catalogo.listar({ q: this.busqueda.value, offset, limit: 12 }).pipe(takeUntilDestroyed(this.destroy), finalize(() => this.buscando.set(false))).subscribe({ next: rows => this.resultados.set(rows), error: e => this.error.set(reservaError(e)) });
  }
  elegir(id: string): void {
    this.detailRequest?.unsubscribe(); this.seleccion.set(null);
    this.detailRequest = this.catalogo.detalle(id).pipe(takeUntilDestroyed(this.destroy)).subscribe({ next: product => { this.recordar(product); this.seleccion.set(product); }, error: e => this.error.set(reservaError(e)) });
  }
  guardar(): void {
    if (this.busy() || this.cargando()) return;
    if (this.form.invalid || this.items.length === 0) { this.form.markAllAsTouched(); return; }
    if (this.items.controls.some(row => !this.variante(row.controls.idVar.value))) { this.error.set('No se pudieron cargar los datos de una prenda. Vuelve a consultarla antes de reservar.'); return; }
    if (this.items.controls.some(row => row.controls.cantidad.value > this.disponibles(row.controls.idVar.value))) { this.error.set('La cantidad solicitada supera las unidades disponibles en esta sucursal. Selecciona otra sucursal o reduce la cantidad.'); return; }
    if (this.form.controls.fechaReserva.value < this.minima) { this.error.set('Selecciona una fecha de hoy en adelante.'); return; }
    const value = this.form.getRawValue();
    this.busy.set(true); this.error.set('');
    this.request?.unsubscribe();
    this.request = this.service.crear({ nroSuc: value.nroSuc, fechaReserva: value.fechaReserva,
      horaAtencion: value.horaAtencion, items: value.items.map(item => ({ idVar: item.idVar.trim(), cantidad: item.cantidad })) })
      .pipe(takeUntilDestroyed(this.destroy), finalize(() => this.busy.set(false))).subscribe({
        next: reserva => void this.router.navigate(['/tienda/reservas', reserva.nroReserva]),
        error: (error: unknown) => this.error.set(reservaError(error)),
      });
  }
}
