import { HttpClient } from '@angular/common/http';
import { JsonPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../core/config/api.config';
import { AuthService } from '../seguridad-accesos/services/auth.service';

interface Company {
  idEmp: number; codigo: string; nombre: string; estado: string;
  logoUrl?: string | null; colorPrimario?: string | null; colorSecundario?: string | null;
  plan?: string | null; idPlan?: number | null; maxSucursales?: number | null;
  suscripcionEstado?: string | null; fechaInicio?: string | null; fechaVencimiento?: string | null;
  sucursalesActivas: number; esDemostracion: boolean;
}
interface Plan { idPlan: number; nombre: string; maxSucursales: number; estado: string; funcionalidades: string[] }
interface AuditEvent { id: number; fecha: string; accion: string; usuarioId: string | null; detalles?: Record<string, unknown> }
interface ProvisionedCompany { idEmp: number; codigo: string; nombre: string }
interface SupportView { empresa: Company; sucursales: Array<{ nro: number; nombre: string; estado: string }>; usuarios: Array<{ idUsuario: string; correo: string; tipo: string; nroRol: string }>; aviso: string }

@Component({
  selector: 'app-saas-dashboard',
  imports: [FormsModule, JsonPipe, RouterLink],
  template: `<main class="saas">
    <header><div><p>FASHIONSTORE · PLATAFORMA</p><h1>Administración SaaS</h1>
      <p>Sesión de plataforma: {{ auth.session()?.usuario?.correo }}</p></div>
      <button type="button" (click)="logout()">Cerrar sesión</button></header>
    @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
    @if (success()) { <p class="success" role="status">{{ success() }}</p> }
    <nav aria-label="Secciones SaaS">
      @if (can('SAAS-EMPRESAS')) { <button type="button" (click)="section.set('empresas')">Empresas</button> }
      @if (can('SAAS-PLANES')) { <button type="button" (click)="section.set('planes')">Planes y suscripciones</button> }
      @if (can('SAAS-EMPRESAS')) { <button type="button" (click)="section.set('aprovisionar')">Aprovisionar</button> }
      @if (can('SAAS-AUDITORIA')) { <button type="button" (click)="section.set('auditoria')">Auditoría</button> }
    </nav>

    @if (section() === 'empresas') {
      <section><h2>Empresas</h2>
        @if (loading()) { <p role="status">Cargando empresas…</p> }
        <div class="company-grid">@for (company of companies(); track company.idEmp) {
          <button class="company" type="button" [class.selected]="selected()?.idEmp === company.idEmp" (click)="select(company)">
            <strong>{{ company.nombre }}</strong><span>{{ company.codigo }}@if(company.esDemostracion){ · Demo}</span>
            <span>{{ company.estado }} · {{ company.plan || 'Sin plan' }}</span>
            <span>{{ company.sucursalesActivas }} / {{ company.maxSucursales ?? '—' }} sucursales activas</span>
          </button>
        }</div>
      </section>
      @if (selected(); as company) {
        <section class="card"><h2>{{ company.nombre }} · estado</h2>
          <p>Suscripción: {{ company.suscripcionEstado || 'sin suscripción activa' }} · {{ company.fechaInicio || '—' }} a {{ company.fechaVencimiento || '—' }}</p>
          @if (can('SAAS-EMPRESAS')) {
            <button type="button" (click)="toggle(company)">{{ company.estado === 'activa' ? 'Suspender empresa' : 'Activar empresa' }}</button>
          }
          @if (can('SAAS-EMPRESAS')) {
            <h3>Identidad visual</h3>
            <form #brandForm="ngForm" (ngSubmit)="saveBrand()" class="fields">
              <label>Nombre visible<input name="brandName" [(ngModel)]="brand.nombre" maxlength="100" required /></label>
              <label>Logo (ruta local /brands/… o URL HTTPS)<input name="logoUrl" [(ngModel)]="brand.logoUrl" maxlength="255" /></label>
              <label>Color primario<input name="primary" [(ngModel)]="brand.colorPrimario" pattern="^#[0-9A-Fa-f]{6}$" placeholder="#112233" /></label>
              <label>Color secundario<input name="secondary" [(ngModel)]="brand.colorSecundario" pattern="^#[0-9A-Fa-f]{6}$" placeholder="#445566" /></label>
              <button type="submit" [disabled]="brandForm.invalid || saving()">Guardar identidad</button>
            </form>
          }
          @if (can('SAAS-PLANES')) {
            <h3>Plan y vigencia</h3>
            <form #subForm="ngForm" (ngSubmit)="saveSubscription()" class="fields">
              <label>Plan<select name="plan" [ngModel]="subscription.idPlan" (ngModelChange)="subscription.idPlan=+$event" required>
                @for (plan of plans(); track plan.idPlan) { <option [ngValue]="plan.idPlan" [disabled]="plan.estado !== 'activo'">{{ plan.nombre }} · máximo {{ plan.maxSucursales }} sucursales · {{ plan.estado }}</option> }
              </select></label>
              <label>Inicio<input type="date" name="start" [(ngModel)]="subscription.fechaInicio" required /></label>
              <label>Vencimiento<input type="date" name="end" [(ngModel)]="subscription.fechaVencimiento" required /></label>
              <button type="submit" [disabled]="subForm.invalid || saving() || subscription.fechaVencimiento <= subscription.fechaInicio">Aplicar plan y vigencia</button>
            </form>
          }
          @if (can('SAAS-SOPORTE')) {
            <h3>Consulta de soporte (solo lectura y auditada)</h3>
            <form (ngSubmit)="support(company)" class="fields">
              <label>Motivo (10–300 caracteres)<input name="supportReason" [(ngModel)]="supportReason" minlength="10" maxlength="300" required /></label>
              <button type="submit" [disabled]="supportReason.trim().length < 10 || saving()">Consultar resumen</button>
            </form>
            @if (supportView(); as view) {
              <p>{{ view.aviso }}</p>
              <p>{{ view.sucursales.length }} sucursales · {{ view.usuarios.length }} usuarios</p>
            }
          }
        </section>
      }
    }

    @if (section() === 'planes') {
      <section><h2>Planes disponibles</h2>
        <div class="plan-grid">@for (plan of plans(); track plan.idPlan) {
          <article class="card"><h3>{{ plan.nombre }}</h3><p>Estado: {{ plan.estado }}</p><p>Máximo de sucursales: {{ plan.maxSucursales }}</p>
            <h4>Funcionalidades</h4><ul>@for (feature of plan.funcionalidades; track feature) { <li>{{ feature }}</li> }</ul>
          </article>
        }</div>
        <p>Desde esta consola se asignan planes y vigencias por empresa. La gestión de límites y funcionalidades está disponible en el editor de planes.</p>
        @if (can('SAAS-PLANES')) { <a routerLink="/saas/planes">Administrar planes y funcionalidades</a> }
      </section>
    }

    @if (section() === 'aprovisionar' && can('SAAS-EMPRESAS')) {
      <section class="card"><h2>Aprovisionar empresa y administrador inicial</h2>
        <form #provisionForm="ngForm" (ngSubmit)="provision()" class="fields">
          <label>Código (minúsculas, números y guiones)<input name="code" [(ngModel)]="provisionData.codigo" pattern="^[a-z0-9-]{1,30}$" maxlength="30" required /></label>
          <label>Nombre<input name="companyName" [(ngModel)]="provisionData.nombre" maxlength="100" required /></label>
          <label>NIT (opcional)<input name="nit" [(ngModel)]="provisionData.nit" maxlength="30" /></label>
          <label>Plan<select name="provisionPlan" [ngModel]="provisionData.idPlan" (ngModelChange)="provisionData.idPlan=+$event" required>
            @for (plan of plans(); track plan.idPlan) { <option [ngValue]="plan.idPlan" [disabled]="plan.estado !== 'activo'">{{ plan.nombre }}</option> }
          </select></label>
          <label>Inicio<input type="date" name="provisionStart" [(ngModel)]="provisionData.fechaInicio" required /></label>
          <label>Vencimiento<input type="date" name="provisionEnd" [(ngModel)]="provisionData.fechaVencimiento" required /></label>
          <fieldset><legend>Administrador inicial de empresa</legend>
            <label>ID de usuario<input name="adminId" [(ngModel)]="provisionData.administrador.idUsuario" maxlength="100" required /></label>
            <label>CI<input name="adminCi" [(ngModel)]="provisionData.administrador.ci" maxlength="100" required /></label>
            <label>Nombres<input name="adminName" [(ngModel)]="provisionData.administrador.nombre" maxlength="100" required /></label>
            <label>Apellido paterno<input name="adminPat" [(ngModel)]="provisionData.administrador.apellidoPat" maxlength="50" required /></label>
            <label>Apellido materno<input name="adminMat" [(ngModel)]="provisionData.administrador.apellidoMat" maxlength="50" required /></label>
            <label>Sexo<select name="adminSex" [(ngModel)]="provisionData.administrador.sexo"><option value="M">M</option><option value="F">F</option></select></label>
            <label>Correo<input type="email" name="adminEmail" [(ngModel)]="provisionData.administrador.correo" maxlength="100" required /></label>
            <label>Teléfono<input name="adminPhone" [(ngModel)]="provisionData.administrador.telefono" maxlength="20" required /></label>
            <label>Dirección<input name="adminAddress" [(ngModel)]="provisionData.administrador.direccion" maxlength="150" required /></label>
            <label>Fecha de nacimiento<input type="date" name="adminBirth" [(ngModel)]="provisionData.administrador.fechaNac" required /></label>
            <label>Contraseña inicial (mín. 12 caracteres)<input type="password" name="adminPassword" [(ngModel)]="provisionData.administrador.contrasena" minlength="12" maxlength="128" autocomplete="new-password" required /></label>
          </fieldset>
          <button type="submit" [disabled]="provisionForm.invalid || saving() || provisionData.fechaVencimiento <= provisionData.fechaInicio">Crear empresa</button>
        </form>
        @if (created(); as result) { <p role="status">Empresa {{ result.nombre }} ({{ result.codigo }}) creada. La clave no se devuelve ni se registra aquí.</p> }
      </section>
    }

    @if (section() === 'auditoria') {
      <section><h2>Auditoría de plataforma</h2>
        <ul class="audit">@for (event of audit(); track event.id) {
          <li><time>{{ event.fecha }}</time> · {{ event.accion }} · {{ event.usuarioId || 'sistema' }}
            @if (event.detalles) { <pre>{{ event.detalles | json }}</pre> }</li>
        }</ul>
      </section>
    }
  </main>`,
  styles: [`.saas{max-width:78rem;margin:2rem auto;padding:1.5rem;font:1rem system-ui;color:#26232a}header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #ddd;padding-bottom:1rem}nav,.actions{display:flex;gap:.6rem;flex-wrap:wrap;margin:1rem 0}section{margin:1.5rem 0}.company-grid,.plan-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(14rem,1fr));gap:.8rem}.company,.card{padding:1rem;border:1px solid #ddd;border-radius:.7rem;background:white}.company{display:grid;text-align:left;gap:.35rem}.company.selected{border-color:#6b3b62;box-shadow:0 0 0 2px #6b3b6222}.fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(15rem,1fr));gap:.8rem;margin:1rem 0}.fields label,fieldset{display:grid;gap:.35rem}fieldset{grid-column:1/-1;border:1px solid #ddd;padding:1rem}input,select,button{padding:.6rem;font:inherit}button{cursor:pointer}.error{color:#9b1c1c}.success{color:#17633a}.audit{padding-left:1.2rem}.audit li{margin:.8rem 0}pre{white-space:pre-wrap;overflow-wrap:anywhere}`],
})
export class SaasDashboardPage implements OnInit {
  readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL).replace(/\/$/, '');
  readonly companies = signal<Company[]>([]);
  readonly plans = signal<Plan[]>([]);
  readonly audit = signal<AuditEvent[]>([]);
  readonly selected = signal<Company | null>(null);
  readonly supportView = signal<SupportView | null>(null);
  readonly created = signal<ProvisionedCompany | null>(null);
  readonly section = signal<'empresas' | 'planes' | 'aprovisionar' | 'auditoria'>('empresas');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly brand = { nombre: '', logoUrl: '', colorPrimario: '', colorSecundario: '' };
  readonly subscription = { idPlan: 1, fechaInicio: this.today(), fechaVencimiento: this.nextYear() };
  readonly provisionData = this.emptyProvision();
  supportReason = '';

  ngOnInit(): void {
    if (!this.can('SAAS-EMPRESAS') && this.can('SAAS-PLANES')) this.section.set('planes');
    this.reload();
  }

  can(permission: string): boolean { return !!this.auth.session()?.permisos.includes(permission); }

  private today(): string { return new Date().toISOString().slice(0, 10); }
  private nextYear(): string { const date = new Date(); date.setFullYear(date.getFullYear() + 1); return date.toISOString().slice(0, 10); }
  private emptyProvision() {
    return { codigo: '', nombre: '', nit: '', idPlan: 1, fechaInicio: this.today(), fechaVencimiento: this.nextYear(),
      administrador: { idUsuario: '', ci: '', nombre: '', apellidoPat: '', apellidoMat: '', sexo: 'M', correo: '',
        telefono: '', direccion: '', fechaNac: '', contrasena: '' } };
  }

  reload(): void {
    this.loading.set(true); this.error.set('');
    if (this.can('SAAS-EMPRESAS')) {
      this.http.get<Company[]>(`${this.api}/saas/empresas`).subscribe({
        next: rows => { this.companies.set(rows); this.loading.set(false); if (this.selected()) this.select(rows.find(row => row.idEmp === this.selected()!.idEmp) || null); },
        error: () => { this.error.set('No se pudieron cargar las empresas.'); this.loading.set(false); },
      });
    } else { this.loading.set(false); }
    if (this.can('SAAS-PLANES')) this.http.get<Plan[]>(`${this.api}/saas/planes`).subscribe({
      next: rows => { this.plans.set(rows); if (rows[0] && !this.plans().some(plan => plan.idPlan === this.subscription.idPlan)) this.subscription.idPlan = rows[0].idPlan; if (rows[0]) this.provisionData.idPlan = rows[0].idPlan; },
      error: () => this.error.set('No se pudieron cargar los planes.'),
    });
    this.loadAudit();
  }

  private loadAudit(): void {
    if (!this.can('SAAS-AUDITORIA')) return;
    this.http.get<AuditEvent[]>(`${this.api}/saas/auditoria`).subscribe({
      next: rows => this.audit.set(rows), error: () => this.error.set('No se pudo cargar la auditoría.'),
    });
  }

  select(company: Company | null): void {
    this.selected.set(company); this.supportView.set(null);
    if (!company) return;
    this.brand.nombre = company.nombre; this.brand.logoUrl = company.logoUrl || '';
    this.brand.colorPrimario = company.colorPrimario || ''; this.brand.colorSecundario = company.colorSecundario || '';
    this.subscription.idPlan = company.idPlan || this.plans()[0]?.idPlan || 1;
    this.subscription.fechaInicio = company.fechaInicio || this.today();
    this.subscription.fechaVencimiento = company.fechaVencimiento || this.nextYear();
  }

  private finish<T>(request: Observable<T>, success: string, apply: (value: T) => void): void {
    this.saving.set(true); this.error.set(''); this.success.set('');
    request.subscribe({ next: value => { apply(value); this.success.set(success); this.saving.set(false); this.loadAudit(); },
      error: () => { this.error.set('La operación fue rechazada. Verifica autorización, datos y auditoría.'); this.saving.set(false); } });
  }

  private updateCompany(updated: Company): void {
    this.companies.update(rows => rows.map(row => row.idEmp === updated.idEmp ? updated : row));
    this.select(updated);
  }

  toggle(company: Company): void {
    const estado = company.estado === 'activa' ? 'suspendida' : 'activa';
    this.finish(this.http.post<Company>(`${this.api}/saas/empresas/${company.idEmp}/estado`, { estado }),
      `Empresa ${estado}.`, updated => this.updateCompany(updated));
  }

  saveBrand(): void {
    const company = this.selected(); if (!company) return;
    const body = { nombre: this.brand.nombre.trim(), logoUrl: this.brand.logoUrl.trim() || null,
      colorPrimario: this.brand.colorPrimario.trim() || null, colorSecundario: this.brand.colorSecundario.trim() || null };
    this.finish(this.http.patch<Company>(`${this.api}/saas/empresas/${company.idEmp}/identidad`, body),
      'Identidad visual actualizada y auditada.', updated => this.updateCompany(updated));
  }

  saveSubscription(): void {
    const company = this.selected(); if (!company || this.subscription.fechaVencimiento <= this.subscription.fechaInicio) return;
    this.finish(this.http.post<Company>(`${this.api}/saas/empresas/${company.idEmp}/suscripcion`, this.subscription),
      'Plan y vigencia actualizados y auditados.', updated => this.updateCompany(updated));
  }

  provision(): void {
    if (this.provisionData.fechaVencimiento <= this.provisionData.fechaInicio) return;
    const payload = { ...this.provisionData, codigo: this.provisionData.codigo.trim().toLowerCase(),
      nombre: this.provisionData.nombre.trim(), nit: this.provisionData.nit.trim() || null,
      administrador: { ...this.provisionData.administrador, contrasena: this.provisionData.administrador.contrasena } };
    this.created.set(null);
    this.finish(this.http.post<Company>(`${this.api}/saas/empresas`, payload), 'Empresa aprovisionada y operación auditada.', value => {
      this.created.set({ idEmp: value.idEmp, codigo: value.codigo, nombre: value.nombre }); this.provisionData.administrador.contrasena = '';
      this.reload();
    });
  }

  support(company: Company): void {
    const body = { idEmp: company.idEmp, motivo: this.supportReason.trim() };
    this.finish(this.http.post<SupportView>(`${this.api}/saas/soporte/acceso`, body), 'Resumen de solo lectura generado y auditado.', value => this.supportView.set(value));
  }

  logout(): void { this.auth.logout().subscribe({ error: () => this.error.set('No se pudo cerrar la sesión en el servidor.') }); }
}
