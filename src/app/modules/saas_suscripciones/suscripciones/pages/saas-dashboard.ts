import { SaasSessionRecovery } from '../../shared/components/session-recovery';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { JsonPipe } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { CatalogoPlanesSaasComponent } from '../../planes_funcionalidades/components/catalogo-planes';
import { API_BASE_URL } from '../../../../core/config/api.config';
import { AuthService } from '../../../seguridad-accesos/services/auth.service';

interface Company {
  idEmp: number; codigo: string; nombre: string; estado: string;
  logoUrl?: string | null; colorPrimario?: string | null; colorSecundario?: string | null;
  plan?: string | null; idPlan?: number | null; maxSucursales?: number | null;
  suscripcionEstado?: string | null; fechaInicio?: string | null; fechaVencimiento?: string | null;
  sucursalesActivas: number; esDemostracion: boolean;
}
interface Plan { idPlan: number; nombre: string; maxSucursales: number; estado: string; funcionalidades: string[] }
interface AuditEvent { id: number; fecha: string; accion: string; usuarioId: string | null; detalles?: Record<string, unknown> }
interface PlatformSummary {
  empresas: { total: number; activas: number; suspendidas: number; inactivas: number };
  suscripciones: { vigentes: number; vencidas: number; proximasAVencer: number };
  distribucionPlanes: Array<{ nombre: string; suscripciones: number }>;
  sucursalesActivas: number;
  actividadReciente: AuditEvent[];
  diasProximosAVencer: number;
}
interface BackupJob {
  id: string; estado: 'solicitado' | 'en_proceso' | 'completado' | 'fallido';
  solicitado: string; completado: string | null; tamanoBytes: number | null; error: string | null;
}
interface BackupList {
  configuracion: { configurado: boolean; estado: string; mensaje: string | null; destino: string; retencionDias: number };
  respaldos: BackupJob[];
}
type SaasSection = 'resumen' | 'empresas' | 'planes' | 'aprovisionar' | 'auditoria' | 'respaldos';
interface ProvisionedCompany { idEmp: number; codigo: string; nombre: string }
interface SupportView { empresa: Company; sucursales: Array<{ nro: number; nombre: string; estado: string }>; usuarios: Array<{ idUsuario: string; correo: string; tipo: string; nroRol: string }>; aviso: string }

@Component({
  selector: 'app-saas-dashboard',
  imports: [SaasSessionRecovery, FormsModule, JsonPipe, RouterLink, CatalogoPlanesSaasComponent],
  template: `
    @if (sessionExpired()) { <app-saas-session-recovery (recovered)="sessionExpired.set(false); error.set('')" /> }<div class="saas-layout">
    @if (menuOpen()) { <button class="saas-scrim" type="button" aria-label="Cerrar navegación" (click)="menuOpen.set(false)"></button> }
    <aside class="saas-sidebar" [class.open]="menuOpen()" aria-label="Navegación de plataforma">
      <a class="saas-brand" routerLink="/saas" (click)="setSection('resumen')">
        <span class="saas-mark" aria-hidden="true">F</span><span>FashionStore<small>PLATAFORMA</small></span>
      </a>
      <nav class="saas-nav" aria-label="Secciones SaaS">
        <button type="button" [class.active]="section() === 'resumen'" [attr.aria-current]="section() === 'resumen' ? 'page' : null" (click)="setSection('resumen')">Resumen</button>
        @if (can('SAAS-EMPRESAS')) { <button type="button" [class.active]="section() === 'empresas'" [attr.aria-current]="section() === 'empresas' ? 'page' : null" (click)="setSection('empresas')">Empresas</button> }
        @if (can('SAAS-PLANES')) {
          <button type="button" [class.active]="section() === 'planes'" [attr.aria-current]="section() === 'planes' ? 'page' : null" (click)="setSection('planes')">Planes y suscripciones</button>
        }
        @if (can('SAAS-EMPRESAS')) { <button type="button" [class.active]="section() === 'aprovisionar'" [attr.aria-current]="section() === 'aprovisionar' ? 'page' : null" (click)="setSection('aprovisionar')">Registrar empresa</button> }
        @if (can('SAAS-AUDITORIA')) { <button type="button" [class.active]="section() === 'auditoria'" [attr.aria-current]="section() === 'auditoria' ? 'page' : null" (click)="setSection('auditoria')">Auditoría</button> }
        @if (can('SAAS-RESPALDOS')) { <button type="button" [class.active]="section() === 'respaldos'" [attr.aria-current]="section() === 'respaldos' ? 'page' : null" (click)="setSection('respaldos')">Respaldos</button> }
      </nav>
      <div class="saas-sidebar-foot">
        <span>Administración de plataforma</span>
        @if (can('SAAS-PLANES')) { <a routerLink="/saas/planes">Administrar planes y funcionalidades</a> }
      </div>
    </aside>
    <div class="saas-content">
      <header class="saas-topbar">
        <button class="saas-menu-button" type="button" (click)="menuOpen.update(value => !value)" [attr.aria-expanded]="menuOpen()" aria-label="Abrir navegación">Menú</button>
        <div><p class="saas-kicker">PLATAFORMA FASHIONSTORE</p><h1>{{ sectionTitle() }}</h1><p class="saas-subtitle">{{ sectionDescription() }}</p></div>
        <div class="saas-account"><span>{{ auth.session()?.usuario?.correo }}</span><button class="secondary" type="button" (click)="logout()">Cerrar sesión</button></div>
      </header>
      <main class="saas-page">
        @if (error()) { <p class="notice error" role="alert">{{ error() }}</p> }
        @if (success()) { <p class="notice success" role="status">{{ success() }}</p> }

    @if (section() === 'resumen') {
      <section class="summary-page" aria-labelledby="summary-heading">
        <div class="section-heading"><div><p class="saas-kicker">VISTA GENERAL</p><h2 id="summary-heading">Estado de la plataforma</h2><p>Indicadores calculados a partir de empresas, suscripciones y sucursales actuales.</p></div><button class="secondary" type="button" (click)="loadSummary()" [disabled]="loadingSummary()">Actualizar</button></div>
        @if (!can('SAAS-EMPRESAS')) { <p class="empty-state" role="status">Tu cuenta no tiene permiso para consultar los indicadores de empresas.</p> }
        @else if (loadingSummary()) { <p role="status">Cargando indicadores…</p> }
        @else if (summary(); as stats) {
          <div class="metric-grid">
            <article class="metric-card"><span>Empresas activas</span><strong>{{ stats.empresas.activas }}</strong><small>{{ stats.empresas.total }} empresas registradas</small></article>
            <article class="metric-card"><span>Suscripciones vigentes</span><strong>{{ stats.suscripciones.vigentes }}</strong><small>{{ stats.suscripciones.vencidas }} vencidas</small></article>
            <article class="metric-card warning"><span>Próximas a vencer</span><strong>{{ stats.suscripciones.proximasAVencer }}</strong><small>En los siguientes {{ stats.diasProximosAVencer }} días</small></article>
            <article class="metric-card"><span>Sucursales activas</span><strong>{{ stats.sucursalesActivas }}</strong><small>En todas las empresas</small></article>
          </div>
          <div class="summary-columns">
            <section class="surface"><div class="surface-heading"><h3>Empresas por estado</h3><span>{{ stats.empresas.total }} total</span></div>
              <dl class="state-list"><div><dt>Activas</dt><dd>{{ stats.empresas.activas }}</dd></div><div><dt>Suspendidas</dt><dd>{{ stats.empresas.suspendidas }}</dd></div><div><dt>Inactivas</dt><dd>{{ stats.empresas.inactivas }}</dd></div></dl>
            </section>
            <section class="surface"><div class="surface-heading"><h3>Distribución por plan</h3><span>Suscripciones vigentes</span></div>
              <ul class="distribution-list">@for (plan of stats.distribucionPlanes; track plan.nombre) { <li><span>{{ plan.nombre }}</span><strong>{{ plan.suscripciones }}</strong></li> } @empty { <li class="empty-state">No hay suscripciones vigentes.</li> }</ul>
            </section>
          </div>
          <div class="summary-columns">
            @if (can('SAAS-AUDITORIA')) {
              <section class="surface"><div class="surface-heading"><h3>Actividad reciente</h3><button class="text-action" type="button" (click)="setSection('auditoria')">Ver auditoría</button></div>
                <ul class="activity-list">@for (event of stats.actividadReciente; track event.id) { <li><span>{{ actionLabel(event.accion) }}</span><time>{{ formatDate(event.fecha) }}</time></li> } @empty { <li class="empty-state">Aún no hay actividad de plataforma.</li> }</ul>
              </section>
            }
            <section class="surface quick-actions"><div class="surface-heading"><h3>Accesos rápidos</h3></div>
              @if (can('SAAS-EMPRESAS')) { <button type="button" class="secondary" (click)="setSection('aprovisionar')">Registrar empresa</button> }
              @if (can('SAAS-PLANES')) { <button type="button" class="secondary" (click)="setSection('empresas')">Revisar empresas y vencimientos</button> }
              @if (can('SAAS-RESPALDOS')) { <button type="button" class="secondary" (click)="setSection('respaldos')">Consultar respaldos</button> }
            </section>
          </div>
        } @else { <p class="empty-state">No se pudieron cargar los indicadores. <button type="button" (click)="loadSummary()">Reintentar</button></p> }
      </section>
    }

    @if (section() === 'empresas') {
      <section aria-labelledby="companies-heading"><div class="section-heading"><div><p class="saas-kicker">GESTIÓN DE TENANTS</p><h2 id="companies-heading">Empresas</h2><p>Consulta estado, plan, capacidad de sucursales y vigencia.</p></div><button class="secondary" type="button" (click)="reload()" [disabled]="loading()">Actualizar</button></div>
        @if (loading()) { <p role="status">Cargando empresas…</p> }
        <div class="filter-bar">
          <label>Buscar empresa<input name="companySearch" [(ngModel)]="companySearch" placeholder="Nombre o código" /></label>
          <label>Estado<select name="companyState" [(ngModel)]="companyStateFilter"><option value="">Todos</option><option value="activa">Activa</option><option value="suspendida">Suspendida</option><option value="inactiva">Inactiva</option></select></label>
          <label>Plan<select name="companyPlan" [(ngModel)]="companyPlanFilter"><option value="">Todos los planes</option>@for(plan of plans(); track plan.idPlan){<option [value]="plan.nombre">{{ plan.nombre }}</option>}</select></label>
        </div>
        @if (!loading()) {
          <div class="company-grid">@for (company of visibleCompanies(); track company.idEmp) {
            <article class="company-card" [class.selected]="selected()?.idEmp === company.idEmp">
              <button class="company-select" type="button" (click)="select(company)" [attr.aria-label]="'Ver empresa ' + company.nombre">
                <span class="company-avatar" [style.background-color]="company.colorPrimario || '#0e5967'">{{ company.nombre.charAt(0) }}</span>
                <span class="company-title"><strong>{{ company.nombre }}</strong><small>{{ company.codigo }}@if(company.esDemostracion){ · Demostración}</small></span>
                <span class="status-pill" [class.success]="company.estado === 'activa'" [class.warning]="company.estado === 'suspendida'" [class.danger]="company.estado === 'inactiva'">{{ company.estado }}</span>
              </button>
              <div class="company-meta"><span>Plan</span><strong>{{ company.plan || 'Sin plan' }}</strong><span>Sucursales activas</span><strong>{{ company.sucursalesActivas }} / {{ company.maxSucursales ?? '—' }}</strong></div>
              @if (company.maxSucursales) { <div class="usage-track" role="progressbar" [attr.aria-valuenow]="usagePercent(company)" aria-valuemin="0" aria-valuemax="100" [attr.aria-label]="'Uso de sucursales: ' + company.sucursalesActivas + ' de ' + company.maxSucursales"><span [style.width.%]="usagePercent(company)"></span></div> }
              @if (company.maxSucursales && company.sucursalesActivas >= company.maxSucursales) { <p class="limit-warning">Límite de sucursales alcanzado</p> }
              <p class="company-expiry">Vence: {{ company.fechaVencimiento ? formatDateOnly(company.fechaVencimiento) : 'Sin suscripción vigente' }}</p>
            </article>
          } @empty { <p class="empty-state">{{ companies().length ? 'No hay empresas que coincidan con los filtros.' : 'Aún no hay empresas registradas.' }}</p> }</div>
        }
      </section>
      @if (selected(); as company) {
        <section class="surface detail-panel"><div class="section-heading"><div><p class="saas-kicker">DETALLE DE EMPRESA</p><h2>{{ company.nombre }}</h2><p>{{ company.codigo }} · {{ company.estado }}</p></div>
          @if (can('SAAS-EMPRESAS')) {
            <button class="danger" type="button" (click)="toggle(company)" [disabled]="saving()">{{ company.estado === 'activa' ? 'Suspender empresa' : 'Activar empresa' }}</button>
          }
        </div>
          <p>Suscripción: <strong>{{ company.suscripcionEstado || 'sin suscripción activa' }}</strong> · {{ company.fechaInicio ? formatDateOnly(company.fechaInicio) : '—' }} a {{ company.fechaVencimiento ? formatDateOnly(company.fechaVencimiento) : '—' }}</p>
          @if (can('SAAS-EMPRESAS')) {
            <h3>Identidad visual</h3>
            <form #brandForm="ngForm" (ngSubmit)="saveBrand()" class="fields">
              <label>Nombre visible<input name="brandName" [(ngModel)]="brand.nombre" maxlength="100" required /></label>
              <label>Logo (ruta local /brands/… o URL HTTPS)<input name="logoUrl" [(ngModel)]="brand.logoUrl" maxlength="255" /></label>
              <label>Color primario<input name="primary" [(ngModel)]="brand.colorPrimario" pattern="^#[0-9A-Fa-f]{6}$" placeholder="#112233" /></label>
              <label>Color secundario<input name="secondary" [(ngModel)]="brand.colorSecundario" pattern="^#[0-9A-Fa-f]{6}$" placeholder="#445566" /></label>
              <button class="primary" type="submit" [disabled]="brandForm.invalid || saving()">Guardar identidad</button>
            </form>
          }
          @if (can('SAAS-PLANES')) {
            <h3>Plan y vigencia</h3>
            <form #subForm="ngForm" (ngSubmit)="reviewSubscription()" class="fields">
              <fieldset class="subscription-fields" [disabled]="saving() || subscriptionReview()">
              <label>Plan<select name="plan" [ngModel]="subscription.idPlan" (ngModelChange)="subscription.idPlan=+$event" required>
                @for (plan of plans(); track plan.idPlan) { <option [ngValue]="plan.idPlan" [disabled]="plan.estado !== 'activo'">{{ plan.nombre }} · máximo {{ plan.maxSucursales }} sucursales · {{ plan.estado }}</option> }
              </select></label>
              <label>Inicio<input type="date" name="start" [(ngModel)]="subscription.fechaInicio" required /></label>
              <label>Vencimiento<input type="date" name="end" [(ngModel)]="subscription.fechaVencimiento" required /></label>
              <button class="secondary" type="submit" [disabled]="subForm.invalid || saving() || subscription.fechaVencimiento <= subscription.fechaInicio">Revisar cambio</button>
              </fieldset>
            </form>
            @if (subscriptionReview()) { <div class="review-card" role="status"><strong>Revisa el cambio de suscripción</strong><p>{{ company.plan || 'Sin plan' }} → {{ selectedPlanName() }} · {{ company.sucursalesActivas }} sucursales activas, nuevo límite {{ selectedPlanLimit() }}.</p><p>Vigencia: {{ formatDateOnly(subscription.fechaInicio) }} a {{ formatDateOnly(subscription.fechaVencimiento) }}. La suscripción utilizará la configuración actual del plan seleccionado.</p><button class="primary" type="button" (click)="saveSubscription()" [disabled]="saving()">Confirmar cambio</button> <button class="secondary" type="button" (click)="subscriptionReview.set(false)" [disabled]="saving()">Volver a editar</button></div> }
          }
          @if (can('SAAS-SOPORTE')) {
            <h3>Consulta de soporte (solo lectura y auditada)</h3>
            <form (ngSubmit)="support(company)" class="fields">
              <label>Motivo (10–300 caracteres)<input name="supportReason" [(ngModel)]="supportReason" minlength="10" maxlength="300" required /></label>
              <button class="secondary" type="submit" [disabled]="supportReason.trim().length < 10 || saving()">Consultar resumen</button>
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
      <app-catalogo-planes-saas [plans]="plans()" [canManage]="can('SAAS-PLANES')" />
    }

    @if (section() === 'aprovisionar' && can('SAAS-EMPRESAS')) {
      <section class="surface provision-panel"><div class="section-heading"><div><p class="saas-kicker">ALTA DE TENANT</p><h2>Registrar empresa</h2><p>Empresa, administrador inicial y vigencia se crean en una única operación del backend.</p></div></div>
        <form #provisionForm="ngForm" (ngSubmit)="reviewProvision()" class="fields">
          <fieldset class="provision-fields" [disabled]="saving() || provisionReview()">
          <label>Nombre<input name="companyName" [(ngModel)]="provisionData.nombre" (ngModelChange)="onCompanyNameChange($event)" maxlength="100" required /></label>
          <label>Código de empresa<input name="code" [ngModel]="provisionData.codigo" readonly placeholder="Se genera al escribir el nombre (ej. Bat-2222)" /><small class="field-hint">Código asignado automáticamente según el nombre de la empresa.</small></label>
          <label>NIT (opcional)<input name="nit" [(ngModel)]="provisionData.nit" maxlength="30" /></label>
          <label>Plan<select name="provisionPlan" [ngModel]="provisionData.idPlan" (ngModelChange)="provisionData.idPlan=+$event" required>
            @for (plan of plans(); track plan.idPlan) { <option [ngValue]="plan.idPlan" [disabled]="plan.estado !== 'activo'">{{ plan.nombre }}</option> }
          </select></label>
          <label>Inicio<input type="date" name="provisionStart" [(ngModel)]="provisionData.fechaInicio" required /></label>
          <label>Vencimiento<input type="date" name="provisionEnd" [(ngModel)]="provisionData.fechaVencimiento" required /></label>
          <fieldset><legend>Administrador inicial de empresa</legend>
            <label>Código de administrador<input name="adminCode" type="text" [value]="predictedAdminCode()" readonly /><small class="field-hint">Código previsto. Se asigna automáticamente al guardar.</small></label>
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
          <button class="secondary provision-submit" type="submit" [disabled]="provisionForm.invalid || saving() || provisionData.fechaVencimiento <= provisionData.fechaInicio">Revisar datos</button>
          </fieldset>
        </form>
        @if (provisionReview()) { <div class="review-card" role="status"><strong>Confirma el aprovisionamiento</strong><p>{{ provisionData.nombre }} ({{ provisionData.codigo }}) · {{ selectedPlanName(provisionData.idPlan) }} · {{ formatDateOnly(provisionData.fechaInicio) }} a {{ formatDateOnly(provisionData.fechaVencimiento) }}.</p><p>Administrador inicial ({{ predictedAdminCode() }}): {{ provisionData.administrador.correo }}. La contraseña no se mostrará ni se devolverá.</p><button class="primary" type="button" (click)="provision()" [disabled]="saving()">{{ saving() ? 'Registrando…' : 'Confirmar y registrar' }}</button> <button class="secondary" type="button" (click)="provisionReview.set(false)" [disabled]="saving()">Volver a editar</button></div> }
        @if (created(); as result) { <p role="status">Empresa {{ result.nombre }} ({{ result.codigo }}) creada. La clave no se devuelve ni se registra aquí.</p> }
      </section>
    }

    @if (section() === 'auditoria') {
      <section><div class="section-heading"><div><p class="saas-kicker">TRAZABILIDAD</p><h2>Auditoría de plataforma</h2><p>Eventos globales de plataforma; no incluye la bitácora empresarial.</p></div><button class="secondary" type="button" (click)="loadAudit(auditPage())" [disabled]="auditLoading()">Actualizar</button></div>
        <form class="audit-filter" (ngSubmit)="loadAudit(0)"><label>Filtrar por acción<input name="auditFilter" [(ngModel)]="auditFilter" maxlength="150" placeholder="Nombre de acción" /></label><button class="secondary" type="submit" [disabled]="auditLoading()">Aplicar filtro</button></form>
        @if (auditLoading()) { <p role="status">Cargando auditoría…</p> }
        @else { <div class="table-wrap"><table><thead><tr><th>Fecha y hora</th><th>Acción</th><th>Actor autorizado</th><th>Empresa</th><th>Resultado / detalle</th></tr></thead><tbody>
          @for (event of audit(); track event.id) { <tr><td><time>{{ formatDate(event.fecha) }}</time></td><td>{{ actionLabel(event.accion) }}</td><td>{{ event.usuarioId || 'Sistema' }}</td><td>{{ auditCompany(event) }}</td><td><details><summary>Ver detalle</summary><pre>{{ event.detalles | json }}</pre></details></td></tr> }
          @empty { <tr><td colspan="5" class="empty-state">{{ auditFilter ? 'No se encontraron eventos para ese filtro.' : 'No hay eventos de auditoría.' }}</td></tr> }
        </tbody></table></div>
          <div class="pagination"><button type="button" class="secondary" [disabled]="auditPage() === 0 || auditLoading()" (click)="loadAudit(auditPage() - 1)">Anterior</button><span>Página {{ auditPage() + 1 }}</span><button type="button" class="secondary" [disabled]="!auditHasNext() || auditLoading()" (click)="loadAudit(auditPage() + 1)">Siguiente</button></div>
        }
      </section>
    }
    @if (section() === 'respaldos') {
      <section><div class="section-heading"><div><p class="saas-kicker">OPERACIÓN SEGURA</p><h2>Respaldos</h2><p>Respaldo de las tablas, datos y funciones de la aplicación (esquema public). Los archivos se guardan en el servidor.</p></div><button class="secondary" type="button" (click)="loadBackups()" [disabled]="backupsLoading()">Actualizar</button></div>
        @if (backupsLoading()) { <p role="status">Consultando estado de respaldos…</p> }
        @if (backupList(); as data) {
          <section class="backup-notice" [class.pending]="!data.configuracion.configurado">
            <h3>Respaldo PostgreSQL de plataforma</h3><p>Destino autorizado: <strong>{{ data.configuracion.destino }}</strong></p>
            <p>Conservación: sin eliminación automática. El archivo se valida antes de habilitar la descarga.</p>
            @if (!data.configuracion.configurado) { <p role="status">{{ data.configuracion.mensaje }}</p> }
            @else { <p>La copia se genera con una conexión de solo lectura. No incluye los archivos de Supabase Storage ni los esquemas internos de Supabase.</p> }
            @if (can('SAAS-RESPALDOS')) { <button class="primary" type="button" (click)="requestBackup()" [disabled]="!data.configuracion.configurado || saving() || backupsLoading() || backupRunning()">{{ saving() ? 'Solicitando…' : 'Crear respaldo ahora' }}</button> }
          </section>
          <div class="table-wrap"><table><thead><tr><th>Solicitado</th><th>Estado</th><th>Tamaño</th><th>Resultado</th></tr></thead><tbody>
            @for (job of data.respaldos; track job.id) { <tr><td><time>{{ formatDate(job.solicitado) }}</time></td><td><span class="status-pill" [class.success]="job.estado === 'completado'" [class.warning]="job.estado === 'solicitado' || job.estado === 'en_proceso'" [class.danger]="job.estado === 'fallido'">{{ backupStatus(job.estado) }}</span></td><td>{{ job.tamanoBytes === null ? '—' : formatBytes(job.tamanoBytes) }}</td><td>@if (job.estado === 'completado') { <a [href]="backupDownloadUrl(job.id)" [attr.download]="'fashionstore-backup-' + job.id + '.dump'">Descargar respaldo</a> } @else { {{ job.error || '—' }} }</td></tr> }
            @empty { <tr><td colspan="4" class="empty-state">Todavía no hay respaldos registrados.</td></tr> }
          </tbody></table></div>
          <p class="backup-footnote">El respaldo puede contener datos sensibles. Mantén el archivo fuera de Git y de carpetas públicas. Restauración: no verificada.</p>
        } @else if (!backupsLoading()) { <p class="empty-state">No se pudo consultar la configuración. <button type="button" (click)="loadBackups()">Reintentar</button></p> }
      </section>
    }
      </main>
    </div>
  </div>  `,
})
export class SaasDashboardPage implements OnInit {
  readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(API_BASE_URL).replace(/\/$/, '');
  readonly companies = signal<Company[]>([]);
  readonly plans = signal<Plan[]>([]);
  readonly audit = signal<AuditEvent[]>([]);
  readonly selected = signal<Company | null>(null);
  readonly supportView = signal<SupportView | null>(null);
  readonly created = signal<ProvisionedCompany | null>(null);
  readonly section = signal<SaasSection>('resumen');
  readonly loading = signal(true);
  readonly loadingSummary = signal(false);
  readonly auditLoading = signal(false);
  readonly backupsLoading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly sessionExpired = signal(false);
  readonly success = signal('');
  readonly summary = signal<PlatformSummary | null>(null);
  readonly backupList = signal<BackupList | null>(null);
  readonly menuOpen = signal(false);
  readonly auditPage = signal(0);
  readonly auditHasNext = signal(false);
  readonly subscriptionReview = signal(false);
  readonly provisionReview = signal(false);
  readonly brand = { nombre: '', logoUrl: '', colorPrimario: '', colorSecundario: '' };
  readonly subscription = { idPlan: 1, fechaInicio: this.today(), fechaVencimiento: this.nextYear() };
  readonly provisionData = this.emptyProvision();
  companySearch = '';
  companyStateFilter = '';
  companyPlanFilter = '';
  auditFilter = '';
  supportReason = '';

  private backupPoll?: ReturnType<typeof setTimeout>;
  private auditRequest = 0;
  private provisionCodeSuffix = this.newCodeSuffix();

  private newCodeSuffix(): string {
    return String(Math.floor(1000 + Math.random() * 9000));
  }

  predictedAdminCode(): string {
    return 'Adm-000001';
  }

  onCompanyNameChange(nombre: string): void {
    this.provisionData.nombre = nombre;
    this.provisionData.codigo = this.generateCompanyCode(nombre);
  }

  generateCompanyCode(nombre: string): string {
    const clean = (nombre || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9]/g, '');
    if (!clean) return '';
    const padded = clean.length >= 3 ? clean.slice(0, 3) : clean.padEnd(3, 'x');
    const prefix = padded.charAt(0).toUpperCase() + padded.slice(1, 3).toLowerCase();
    const existing = new Set(this.companies().map(company => company.codigo.toLowerCase()));
    let suffix = this.provisionCodeSuffix;
    let candidate = `${prefix}-${suffix}`;
    let attempts = 0;
    while (existing.has(candidate.toLowerCase()) && attempts < 25) {
      suffix = this.newCodeSuffix();
      this.provisionCodeSuffix = suffix;
      candidate = `${prefix}-${suffix}`;
      attempts++;
    }
    return candidate;
  }

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => clearTimeout(this.backupPoll));
    this.route.data.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(data => {
      const section = data['section'];
      if (section === 'resumen' || section === 'empresas' || section === 'planes'
          || section === 'aprovisionar' || section === 'auditoria' || section === 'respaldos') {
        this.section.set(section);
        if (section === 'respaldos') this.loadBackups();
        if (section === 'auditoria') this.loadAudit(0);
      }
    });
    this.reload();
  }

  can(permission: string): boolean { return !!this.auth.session()?.permisos.includes(permission); }

  sectionTitle(): string {
    return ({
      resumen: 'Resumen de plataforma',
      empresas: 'Empresas',
      planes: 'Planes y suscripciones',
      aprovisionar: 'Registrar empresa',
      auditoria: 'Auditoría',
      respaldos: 'Respaldos',
    } as const)[this.section()];
  }

  sectionDescription(): string {
    return ({
      resumen: 'Una lectura operativa del estado actual de FashionStore SaaS.',
      empresas: 'Consulta empresas, vigencia de suscripciones y uso de sucursales.',
      planes: 'Revisa los planes actuales y sus funcionalidades.',
      aprovisionar: 'Registra una empresa y su administrador inicial.',
      auditoria: 'Consulta acciones de plataforma registradas en auditoría.',
      respaldos: 'Administra respaldos completos del entorno de pruebas.',
    } as const)[this.section()];
  }

  setSection(section: SaasSection): void {
    this.menuOpen.set(false);
    const paths: Record<SaasSection, string> = {
      resumen: '/saas',
      empresas: '/saas/empresas',
      planes: '/saas/planes-suscripciones',
      aprovisionar: '/saas/registro',
      auditoria: '/saas/auditoria',
      respaldos: '/saas/respaldos',
    };
    const path = paths[section];
    if (this.router.url === path) {
      this.section.set(section);
      this.error.set('');
      this.success.set('');
      if (section === 'resumen') this.loadSummary();
      if (section === 'empresas') this.reload();
      if (section === 'auditoria') this.loadAudit(0);
      if (section === 'respaldos') this.loadBackups();
      return;
    }
    void this.router.navigateByUrl(path);
  }

  visibleCompanies(): Company[] {
    const query = this.companySearch.trim().toLocaleLowerCase();
    return this.companies().filter(company =>
      (!query || `${company.nombre} ${company.codigo}`.toLocaleLowerCase().includes(query))
      && (!this.companyStateFilter || company.estado === this.companyStateFilter)
      && (!this.companyPlanFilter || company.plan === this.companyPlanFilter));
  }

  usagePercent(company: Company): number {
    const limit = company.maxSucursales ?? 0;
    return limit > 0 ? Math.min(100, Math.round(company.sucursalesActivas / limit * 100)) : 0;
  }

  selectedPlanName(id = this.subscription.idPlan): string {
    return this.plans().find(plan => plan.idPlan === id)?.nombre || 'Plan no disponible';
  }

  selectedPlanLimit(id = this.subscription.idPlan): number | string {
    return this.plans().find(plan => plan.idPlan === id)?.maxSucursales ?? 'sin límite disponible';
  }

  formatDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('es-BO', {
      dateStyle: 'medium', timeStyle: 'short',
    }).format(date);
  }

  formatDateOnly(value: string): string {
    const [year, month, day] = value.slice(0, 10).split('-').map(Number);
    return new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium' }).format(new Date(year, month - 1, day));
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  backupStatus(status: BackupJob['estado']): string {
    return ({ solicitado: 'Solicitado', en_proceso: 'En proceso', completado: 'Completado', fallido: 'Fallido' } as const)[status];
  }

  backupDownloadUrl(id: string): string {
    return `${this.api}/saas/respaldos/${encodeURIComponent(id)}/descarga`;
  }

  actionLabel(action: string): string {
    const labels: Record<string, string> = {
      empresa_aprovisionada: 'Empresa aprovisionada',
      empresa_estado_actualizado: 'Estado de empresa actualizado',
      empresa_identidad_actualizada: 'Identidad de empresa actualizada',
      empresa_plan_cambiado: 'Plan de empresa cambiado',
      respaldo_plataforma_solicitado: 'Respaldo solicitado',
      respaldo_plataforma_descargado: 'Respaldo descargado',
      soporte_acceso_empresa: 'Consulta de soporte',
    };
    return labels[action] || action.replaceAll('_', ' ');
  }

  auditCompany(event: AuditEvent): string {
    const companyId = event.detalles?.['idEmp'];
    return typeof companyId === 'number' ? `Empresa #${companyId}` : '—';
  }

  private today(): string { return new Date().toISOString().slice(0, 10); }
  private nextYear(): string { const date = new Date(); date.setFullYear(date.getFullYear() + 1); return date.toISOString().slice(0, 10); }
  private emptyProvision() {
    return { codigo: '', nombre: '', nit: '', idPlan: 1, fechaInicio: this.today(), fechaVencimiento: this.nextYear(),
      administrador: { idUsuario: '', ci: '', nombre: '', apellidoPat: '', apellidoMat: '', sexo: 'M', correo: '',
        telefono: '', direccion: '', fechaNac: '', contrasena: '' } };
  }

  reload(): void {
    this.error.set('');
    this.loadSummary();
    if (this.can('SAAS-EMPRESAS')) {
      this.loading.set(true);
      this.http.get<Company[]>(`${this.api}/saas/empresas`).subscribe({
        next: rows => { this.companies.set(rows); this.loading.set(false); if (this.selected()) this.select(rows.find(row => row.idEmp === this.selected()!.idEmp) || null); },
        error: () => { this.error.set('No se pudieron cargar las empresas.'); this.loading.set(false); },
      });
    } else {
      this.loading.set(false);
    }
    if (this.can('SAAS-PLANES')) this.http.get<Plan[]>(`${this.api}/saas/planes`).subscribe({
      next: rows => { this.plans.set(rows); if (rows[0] && !this.plans().some(plan => plan.idPlan === this.subscription.idPlan)) this.subscription.idPlan = rows[0].idPlan; if (rows[0]) this.provisionData.idPlan = rows[0].idPlan; },
      error: () => this.error.set('No se pudieron cargar los planes.'),
    });
    if (this.can('SAAS-AUDITORIA')) this.loadAudit(0);
  }

  loadSummary(): void {
    if (!this.can('SAAS-EMPRESAS')) return;
    this.loadingSummary.set(true);
    this.http.get<PlatformSummary>(`${this.api}/saas/resumen`).subscribe({
      next: result => { this.summary.set(result); this.loadingSummary.set(false); },
      error: () => { this.summary.set(null); this.error.set('No se pudieron cargar los indicadores de plataforma.'); this.loadingSummary.set(false); },
    });
  }

  loadAudit(page = 0): void {
    if (!this.can('SAAS-AUDITORIA')) return;
    this.auditLoading.set(true);
    const request = ++this.auditRequest;
    const filter = this.auditFilter.trim();
    const params = `?limite=21&desplazamiento=${page * 20}${filter ? `&accion=${encodeURIComponent(filter)}` : ''}`;
    this.http.get<AuditEvent[]>(`${this.api}/saas/auditoria${params}`).subscribe({
      next: rows => { if (request !== this.auditRequest) return; this.audit.set(rows.slice(0, 20)); this.auditHasNext.set(rows.length > 20); this.auditPage.set(page); this.auditLoading.set(false); },
      error: () => { if (request !== this.auditRequest) return; this.error.set('No se pudo cargar la auditoría.'); this.auditLoading.set(false); },
    });
  }

  backupRunning(): boolean {
    return !!this.backupList()?.respaldos.some(job => job.estado === 'solicitado' || job.estado === 'en_proceso');
  }

  loadBackups(): void {
    clearTimeout(this.backupPoll);
    if (!this.can('SAAS-RESPALDOS')) return;
    this.backupsLoading.set(true);
    this.http.get<BackupList>(`${this.api}/saas/respaldos`).subscribe({
      next: response => {
        this.backupList.set(response); this.backupsLoading.set(false);
        if (this.backupRunning() && this.section() === 'respaldos') {
          this.backupPoll = setTimeout(() => { if (this.section() === 'respaldos') this.loadBackups(); }, 2000);
        }
      },
      error: () => { this.backupList.set(null); this.error.set('No se pudo consultar la configuración de respaldos.'); this.backupsLoading.set(false); },
    });
  }

  requestBackup(): void {
    if (this.saving() || this.backupRunning() || !this.can('SAAS-RESPALDOS') || !this.backupList()?.configuracion.configurado) return;
    this.saving.set(true);
    this.error.set('');
    this.success.set('');
    this.http.post<BackupJob>(`${this.api}/saas/respaldos`, {}).subscribe({
      next: () => {
        this.success.set('Solicitud de respaldo registrada y auditada.');
        this.saving.set(false);
        this.loadBackups();
      },
      error: (error: { error?: { error?: { message?: string } } }) => {
        this.error.set(error.error?.error?.message || 'No se pudo solicitar el respaldo.');
        this.saving.set(false);
        this.loadBackups();
      },
    });
  }

  select(company: Company | null): void {
    this.selected.set(company); this.supportView.set(null);
    this.subscriptionReview.set(false);
    if (!company) return;
    this.brand.nombre = company.nombre; this.brand.logoUrl = company.logoUrl || '';
    this.brand.colorPrimario = company.colorPrimario || ''; this.brand.colorSecundario = company.colorSecundario || '';
    this.subscription.idPlan = company.idPlan || this.plans()[0]?.idPlan || 1;
    this.subscription.fechaInicio = company.fechaInicio || this.today();
    this.subscription.fechaVencimiento = company.fechaVencimiento || this.nextYear();
  }

  private finish<T>(request: Observable<T>, success: string, apply: (value: T) => void): void {
    this.saving.set(true); this.error.set(''); this.success.set('');
    request.subscribe({ next: value => { apply(value); this.success.set(success); this.saving.set(false); if (this.can('SAAS-AUDITORIA')) this.loadAudit(0); },
      error: (error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          this.sessionExpired.set(true); this.error.set('La sesión SaaS venció. Renueva tu acceso para guardar.');
        } else {
          this.error.set(error instanceof HttpErrorResponse && typeof error.error?.error?.message === 'string'
            ? error.error.error.message : 'No se pudo completar la operación. Inténtalo de nuevo.');
        }
        this.saving.set(false);
      } });
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
    const company = this.selected();
    if (!company || !this.subscriptionReview() || this.subscription.fechaVencimiento <= this.subscription.fechaInicio) return;
    this.subscriptionReview.set(false);
    this.finish(this.http.post<Company>(`${this.api}/saas/empresas/${company.idEmp}/suscripcion`, this.subscription),
      'Plan y vigencia actualizados y auditados.', updated => this.updateCompany(updated));
  }

  reviewSubscription(): void {
    if (this.saving() || this.subscription.fechaVencimiento <= this.subscription.fechaInicio) return;
    this.subscriptionReview.set(true);
  }

  reviewProvision(): void {
    const data = this.provisionData;
    const admin = data.administrador;
    if (this.saving() || data.fechaVencimiento <= data.fechaInicio) return;
    if (data.nombre.trim() && !data.codigo.trim()) {
      data.codigo = this.generateCompanyCode(data.nombre);
    }
    if (!/^[a-z0-9-]{1,30}$/i.test(data.codigo.trim())
        || !data.nombre.trim() || !data.idPlan
        || !admin.ci.trim() || !admin.nombre.trim()
        || !admin.apellidoPat.trim() || !admin.apellidoMat.trim()
        || !admin.correo.includes('@') || !admin.telefono.trim() || !admin.direccion.trim()
        || !admin.fechaNac || admin.contrasena.length < 12) {
      this.error.set('Completa los campos obligatorios con valores válidos antes de revisar.');
      return;
    }
    this.error.set('');
    this.provisionReview.set(true);
  }

  provision(): void {
    if (this.saving() || !this.provisionReview()
        || this.provisionData.fechaVencimiento <= this.provisionData.fechaInicio) return;
    if (this.provisionData.nombre.trim() && !this.provisionData.codigo.trim()) {
      this.provisionData.codigo = this.generateCompanyCode(this.provisionData.nombre);
    }
    const { idUsuario, ...adminFields } = this.provisionData.administrador;
    const payload = {
      ...this.provisionData,
      codigo: this.provisionData.codigo.trim().toLowerCase(),
      nombre: this.provisionData.nombre.trim(),
      nit: this.provisionData.nit.trim() || null,
      administrador: {
        ...adminFields,
        ...(idUsuario.trim() ? { idUsuario: idUsuario.trim() } : {}),
        contrasena: this.provisionData.administrador.contrasena,
      },
    };
    this.created.set(null);
    this.provisionReview.set(false);
    this.finish(this.http.post<Company>(`${this.api}/saas/empresas`, payload), 'Empresa aprovisionada y operación auditada.', value => {
      this.created.set({ idEmp: value.idEmp, codigo: value.codigo, nombre: value.nombre });
      this.provisionData.administrador.contrasena = '';
      this.provisionCodeSuffix = this.newCodeSuffix();
      this.reload();
    });
  }

  support(company: Company): void {
    const body = { idEmp: company.idEmp, motivo: this.supportReason.trim() };
    this.finish(this.http.post<SupportView>(`${this.api}/saas/soporte/acceso`, body), 'Resumen de solo lectura generado y auditado.', value => this.supportView.set(value));
  }

  logout(): void {
    if (this.saving()) return;
    this.auth.logout().subscribe({
      error: () => this.error.set('No se pudo cerrar la sesión en el servidor.'),
    });
  }
}
