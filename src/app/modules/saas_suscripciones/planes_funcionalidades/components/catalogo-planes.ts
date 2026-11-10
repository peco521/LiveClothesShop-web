import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

interface Plan { idPlan: number; nombre: string; maxSucursales: number; estado: string; funcionalidades: string[] }

@Component({
  selector: 'app-catalogo-planes-saas',
  imports: [RouterLink],
  template: `      <section><div class="section-heading"><div><p class="saas-kicker">CATÁLOGO DE PLANES</p><h2>Planes y suscripciones</h2><p>Los cambios de un plan afectan a todas las empresas asociadas.</p></div>@if (canManage) { <a class="button primary" routerLink="/saas/planes">Administrar planes y funcionalidades</a> }</div>
        <div class="plan-grid">@for (plan of plans; track plan.idPlan) {
          <article class="plan-card"><div class="surface-heading"><span class="status-pill" [class.success]="plan.estado === 'activo'">{{ plan.estado }}</span><small>Plan #{{ plan.idPlan }}</small></div><h3>{{ plan.nombre }}</h3><p><strong>{{ plan.maxSucursales }}</strong> sucursales máximo</p>
            <h4>Funcionalidades</h4><ul>@for (feature of plan.funcionalidades; track feature) { <li>{{ featureLabel(feature) }}</li> } @empty { <li>Sin funcionalidades asignadas</li> }</ul>
          </article>
        }</div>
      </section>
`,
})
export class CatalogoPlanesSaasComponent {
  @Input() plans: Plan[] = [];
  @Input() canManage = false;
  featureLabel(code: string): string {
    const labels: Record<string, string> = {
      CU05: 'Usuarios y empleados', CU06: 'Roles y permisos', CU07: 'Clientes',
      CU08: 'Bitácora empresarial', CU09: 'Sucursales y ciudades', CU10: 'Catálogo',
      CU11: 'Reservas', CU12: 'Carrito', CU13: 'Compra digital', CU14: 'Pagos',
      CU15: 'Historial de compras', CU18: 'Gestión de catálogo',
      CU19: 'Proveedores', CU20: 'Inventario', CU21: 'Promociones',
      CU22: 'Reservas en sucursal', CU23: 'Devoluciones', CU24: 'Venta presencial',
      CU25: 'Reportes gerenciales',
    };
    return labels[code] || code;
  }

}
