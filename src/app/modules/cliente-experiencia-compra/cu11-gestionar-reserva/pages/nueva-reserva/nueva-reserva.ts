import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, Subscription } from 'rxjs';
import { Cu11Layout } from '../../components/cu11-layout';
import { HorariosSucursal, SucursalCliente } from '../../models/reserva.models';
import { ReservasService } from '../../services/reservas.service';
import { reservaError } from '../../services/reserva-error';

function hoy(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

@Component({ selector: 'app-nueva-reserva', imports: [Cu11Layout, ReactiveFormsModule, RouterLink], templateUrl: './nueva-reserva.html',
  styles: `.table-scroll { overflow-x: auto; } table { width: 100%; border-collapse: collapse; } th, td { text-align: left; padding: 10px; border-bottom: 1px solid var(--line); } .form-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; margin-bottom: 12px; }`,
})
export class NuevaReservaPage {
  private readonly service = inject(ReservasService);
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
    this.service.sucursales().pipe(takeUntilDestroyed()).subscribe({ next: rows => this.sucursales.set(rows) });
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(params => {
      const idVar = params.get('idVar'), cantidad = Number(params.get('cantidad') ?? 1);
      if (idVar && this.items.length === 0) this.agregar(idVar, Number.isInteger(cantidad) && cantidad >= 1 ? cantidad : 1);
    });
    this.form.controls.nroSuc.valueChanges.pipe(takeUntilDestroyed(this.destroy)).subscribe(nro => {
      this.horarios.set(null);
      if (nro >= 1) this.service.horarios(nro).pipe(takeUntilDestroyed(this.destroy)).subscribe({ next: value => this.horarios.set(value) });
    });
  }
  agregar(idVar = '', cantidad = 1): void {
    this.items.push(this.builder.group({
      idVar: this.builder.control(idVar, [Validators.required, Validators.maxLength(15)]),
      cantidad: this.builder.control(cantidad, [Validators.required, Validators.min(1)]),
    }));
  }
  quitar(index: number): void { this.items.removeAt(index); }
  guardar(): void {
    if (this.form.invalid || this.items.length === 0) { this.form.markAllAsTouched(); return; }
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
