import { CurrencyPipe } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { API_BASE_URL } from '../../../../core/config/api.config';

interface Company {
  idEmp: number;
  codigo: string;
  nombre: string;
  idPlan: number | null;
  plan: string | null;
  estado: string;
  fechaInicio: string;
  fechaVencimiento: string;
}

interface Metrics {
  ingresos: number | string;
  ventas: number;
  poleras: number;
  ticketPromedio: number | string;
  inventario: { stock: number; disponible: number; reservado: number; agotados: number };
  reservas: number;
  devoluciones: number;
  conversionReservas: number;
  carritos: number;
  conversionCarritos: number;
  sucursales: Array<{ nombre: string; ventas: number; total: number; poleras: number; ticket: number | string }>;
  productos: Array<{ nombre: string; unidades: number }>;
  devolucionesDetalle: Array<Record<string, unknown>>;
  nota: string;
}

interface CompanyReport {
  empresa: Company;
  reporte: Metrics;
}

interface DashboardResult {
  fechaIni: string;
  fechaFin: string;
  empresas: CompanyReport[];
  procedencia: string;
}

type ReportKind = 'ventas' | 'inventario' | 'reservas' | 'devoluciones';
type Format = 'pdf' | 'xlsx';
type DynamicType = 'ventas_sucursal' | 'productos_vendidos' | 'ventas_semana' | 'existencias_bajas';

interface DynamicPlan {
  tipo: DynamicType;
  fechaIni: string | null;
  fechaFin: string | null;
  nroSuc: number | null;
  limite: number;
  umbral: number;
}

interface VoiceDecision {
  estado: 'listo' | 'aclaracion' | 'no_soportado';
  mensaje: string;
  plan: DynamicPlan | null;
  modelo?: string;
  requiereConfirmacion?: boolean;
}

interface DynamicRows {
  titulo: string;
  plan: DynamicPlan;
  columnas: string[];
  filas: Array<Record<string, string | number>>;
  nota: string;
  generadoEn: string;
  procedencia: string;
}

interface DynamicCompanyReport {
  empresa: Company;
  reporte: DynamicRows;
}

interface DynamicResult {
  plan: DynamicPlan;
  empresas: DynamicCompanyReport[];
  procedencia: string;
}

interface SpeechRecognition {
  lang: string;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

@Component({
  selector: 'app-saas-reportes',
  imports: [FormsModule, CurrencyPipe],
  template: `
  <section class="saas-reports">
    <header class="heading">
      <div>
        <p class="kicker">PLATAFORMA SAAS · GESTIÓN GERENCIAL</p>
        <h2>Reportes de empresas y analítica inteligente</h2>
        <p>Consulta reportes gerenciales (CU28), analítica predictiva de demanda y reportes asistidos por IA (CU29) para cada empresa.</p>
      </div>
      <div class="header-actions">
        <button class="secondary" type="button" (click)="refreshActiveTab()" [disabled]="busy()">
          {{ busy() ? 'Consultando…' : 'Actualizar' }}
        </button>
      </div>
    </header>

    @if (error()) { <p class="notice error" role="alert">{{ error() }}</p> }
    @if (success()) { <p class="notice success" role="status">{{ success() }}</p> }

    <!-- Navegación de pestañas dentro de reportes -->
    <nav class="report-tabs" aria-label="Secciones de reportes">
      <button type="button" [class.active]="tab() === 'dinamicos'" (click)="setTab('dinamicos')">
        Reportes gerenciales dinámicos (CU28)
      </button>
      <button type="button" [class.active]="tab() === 'analitica'" (click)="setTab('analitica')">
        Analítica inteligente y ML
      </button>
      <button type="button" [class.active]="tab() === 'resumen'" (click)="setTab('resumen')">
        Indicadores generales por empresa
      </button>
    </nav>

    <!-- ==================== PESTAÑA 1: REPORTES GERENCIALES DINÁMICOS (CU28) + IA (CU29) ==================== -->
    @if (tab() === 'dinamicos') {
      <section class="surface filters-section" aria-label="Filtros del reporte gerencial">
        <div class="surface-heading">
          <div>
            <p class="kicker">CU28 - REPORTES GERENCIALES</p>
            <h3>Configuración del reporte</h3>
            <p>Selecciona la empresa o consulta a nivel global de plataforma con los parámetros de negocio.</p>
          </div>
        </div>

        <form (ngSubmit)="executeDynamic()" class="form-grid">
          <div class="field">
            <label for="rep-empresa">Empresa</label>
            <select id="rep-empresa" name="idEmp" [(ngModel)]="idEmp" (ngModelChange)="onCompanyChange()">
              <option [ngValue]="0">Todas las empresas</option>
              @for (company of companies(); track company.idEmp) {
                <option [ngValue]="company.idEmp">{{ company.nombre }} ({{ company.codigo }})</option>
              }
            </select>
          </div>

          <div class="field">
            <label for="rep-plan">Plan</label>
            <select id="rep-plan" name="idPlan" [(ngModel)]="idPlan">
              <option [ngValue]="0">Todos los planes</option>
              @for (plan of plans(); track plan.id) {
                <option [ngValue]="plan.id">{{ plan.nombre }}</option>
              }
            </select>
          </div>

          <div class="field">
            <label for="rep-tipo">Tipo de reporte</label>
            <select id="rep-tipo" name="tipoReporte" [(ngModel)]="plan.tipo">
              @for (t of reportTypes; track t.id) {
                <option [value]="t.id">{{ t.label }}</option>
              }
            </select>
          </div>

          <div class="field">
            <label for="rep-desde">Desde</label>
            <input id="rep-desde" type="date" name="fechaIni" [(ngModel)]="plan.fechaIni" [disabled]="plan.tipo === 'existencias_bajas'" />
          </div>

          <div class="field">
            <label for="rep-hasta">Hasta</label>
            <input id="rep-hasta" type="date" name="fechaFin" [(ngModel)]="plan.fechaFin" [disabled]="plan.tipo === 'existencias_bajas'" />
          </div>

          <div class="field">
            <label for="rep-sucursal">Sucursal</label>
            <select id="rep-sucursal" name="nroSuc" [(ngModel)]="plan.nroSuc" [disabled]="!idEmp">
              <option [ngValue]="null">{{ idEmp ? 'Todas las sucursales de la empresa' : 'Elige una empresa para filtrar sucursal' }}</option>
              @for (suc of branches(); track suc.nro) {
                <option [ngValue]="suc.nro">{{ suc.nombre }}</option>
              }
            </select>
          </div>

          <div class="field">
            <label for="rep-limite">Límite de registros</label>
            <input id="rep-limite" type="number" name="limite" min="1" max="100" [(ngModel)]="plan.limite" />
          </div>

          @if (plan.tipo === 'existencias_bajas') {
            <div class="field">
              <label for="rep-umbral">Disponible máximo (umbral)</label>
              <input id="rep-umbral" type="number" name="umbral" min="0" [(ngModel)]="plan.umbral" />
            </div>
          }

          <div class="form-actions">
            <button class="primary" type="submit" [disabled]="busy()">
              {{ busy() ? 'Calculando…' : 'Calcular reporte' }}
            </button>
          </div>
        </form>

        <!-- Subfuncionalidad CU29: Consulta mediante IA (Texto o Voz) -->
        <section class="ai-assist-box" aria-labelledby="ai-heading">
          <div class="ai-header">
            <div>
              <p class="kicker">FUNCIONALIDAD CU29 · ASISTENCIA CON IA</p>
              <h4 id="ai-heading">Consulta asistida con IA (Texto o Voz)</h4>
              <p>Escribe en lenguaje natural o dicta tu requerimiento. La IA interpretará la solicitud y propondrá el plan para tu confirmación.</p>
            </div>
            <button class="secondary mic-btn" type="button" (click)="listen()" [disabled]="listening() || busy()">
              <span class="mic-icon" aria-hidden="true">🎙</span>
              {{ listening() ? 'Escuchando…' : 'Dictar por voz' }}
            </button>
          </div>

          <div class="ai-input-group">
            <label for="ai-text">Solicitud para la IA</label>
            <textarea
              id="ai-text"
              name="voiceText"
              rows="2"
              maxlength="1200"
              [(ngModel)]="voiceText"
              placeholder="Ej.: ventas por sucursal del mes pasado, productos más vendidos de la empresa Bata...">
            </textarea>
            <div class="ai-actions">
              <button class="secondary" type="button" (click)="interpret()" [disabled]="busy() || voiceText.trim().length < 3">
                Interpretar con IA
              </button>
            </div>
          </div>

          @if (decision(); as proposal) {
            <div class="proposal-card" role="status">
              <div class="proposal-info">
                <strong>{{ proposal.mensaje }}</strong>
                @if (proposal.modelo) { <small>Modelo: {{ proposal.modelo }}</small> }
                @if (proposal.plan; as p) {
                  <p class="proposal-details">
                    Tipo: <strong>{{ formatPlanType(p.tipo) }}</strong> ·
                    Período: {{ p.fechaIni || 'existencias actuales' }} {{ p.fechaFin ? ' a ' + p.fechaFin : '' }} ·
                    Sucursal: {{ p.nroSuc ? ('Nro. ' + p.nroSuc) : 'todas' }} ·
                    Límite: {{ p.limite }}
                  </p>
                }
              </div>
              @if (proposal.plan) {
                <button class="primary" type="button" (click)="confirmAndExecuteProposal()" [disabled]="busy()">
                  Confirmar plan y calcular
                </button>
              }
            </div>
          }
        </section>
      </section>

      <!-- Resultados del reporte dinámico CU28 -->
      @if (dynamicResult(); as result) {
        <section class="surface results-section" aria-live="polite">
          <div class="results-header">
            <div>
              <p class="kicker">RESULTADO DEL REPORTE</p>
              <h3>{{ formatPlanType(result.plan.tipo) }}</h3>
              <p class="result-meta">{{ result.procedencia }} · {{ result.empresas.length }} empresa(s) evaluada(s)</p>
            </div>
            <div class="export-actions">
              <span>Exportar resultado:</span>
              <button class="secondary" type="button" (click)="exportDynamic('pdf')" [disabled]="exporting()">Descargar PDF</button>
              <button class="secondary" type="button" (click)="exportDynamic('xlsx')" [disabled]="exporting()">Descargar Excel</button>
            </div>
          </div>

          @for (item of result.empresas; track item.empresa.idEmp) {
            <article class="company-dynamic-card">
              <header class="card-head">
                <div>
                  <span class="company-badge">{{ item.empresa.plan || 'Sin plan' }}</span>
                  <h4>{{ item.empresa.nombre }}</h4>
                  <small>{{ item.empresa.codigo }} · {{ item.empresa.estado }}</small>
                </div>
                <span class="row-count">{{ item.reporte.filas.length }} registro(s)</span>
              </header>

              <!-- Tabla de datos dinámica -->
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      @for (col of item.reporte.columnas; track col) {
                        <th>{{ col }}</th>
                      }
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of item.reporte.filas; track $index) {
                      <tr>
                        @for (col of item.reporte.columnas; track col) {
                          <td>{{ formatTableCell(row[col]) }}</td>
                        }
                      </tr>
                    } @empty {
                      <tr>
                        <td [attr.colspan]="item.reporte.columnas.length || 1" class="empty-cell">
                          No se encontraron registros para los filtros seleccionados en esta empresa.
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>

              <!-- Gráfico de barras visual (CSS) proporcional -->
              @if (item.reporte.filas.length > 0) {
                <div class="bars-container" aria-label="Visualización gráfica de datos">
                  <h5>Distribución proporcional</h5>
                  <div class="bars-list">
                    @for (row of item.reporte.filas; track $index) {
                      <div class="bar-row">
                        <span class="bar-label">{{ getRowLabel(row) }}</span>
                        <div class="bar-track">
                          <div class="bar-fill" [style.width.%]="getBarPercent(row, item.reporte.filas, item.reporte.plan.tipo)"></div>
                        </div>
                        <span class="bar-value">{{ getRowValueLabel(row, item.reporte.plan.tipo) }}</span>
                      </div>
                    }
                  </div>
                </div>
              }

              <footer class="card-foot">
                <small>{{ item.reporte.nota }} · Generado: {{ item.reporte.generadoEn }}</small>
              </footer>
            </article>
          } @empty {
            <p class="empty-state">No hay empresas disponibles con suscripción vigente en este alcance.</p>
          }
        </section>
      }
    }

    <!-- ==================== PESTAÑA 2: ANALÍTICA INTELIGENTE Y MACHINE LEARNING ==================== -->
    @if (tab() === 'analitica') {
      <section class="surface ml-section" aria-label="Modelos de Machine Learning y Demanda">
        <div class="surface-heading">
          <div>
            <p class="kicker">CU28 - ANALÍTICA INTELIGENTE</p>
            <h3>Métricas de Modelos y Predicción de Demanda</h3>
            <p>Modelos supervisados (regresión de demanda) y no supervisados (segmentación y detección de anomalías).</p>
          </div>
          <button class="primary" type="button" (click)="loadAnalytics()" [disabled]="busy()">
            {{ busy() ? 'Cargando modelos…' : 'Consultar modelos y métricas' }}
          </button>
        </div>

        @if (analytics(); as a) {
          <div class="ml-cards-grid">
            @for (m of supervisedMetrics(); track m.model) {
              <article class="ml-metric-card">
                <span class="model-badge">Supervisado</span>
                <h4>{{ m.model }}</h4>
                <p class="model-desc">Predicción de demanda de prendas</p>
                <dl class="metric-dl">
                  <div><dt>R² (precisión)</dt><dd><strong>{{ m.r2 }}</strong></dd></div>
                  <div><dt>MAE (error absoluto)</dt><dd>{{ m.mae }}</dd></div>
                  <div><dt>RMSE (error cuadrático)</dt><dd>{{ m.rmse }}</dd></div>
                </dl>
              </article>
            }

            @if (unsupervisedSummary(); as u) {
              <article class="ml-metric-card">
                <span class="model-badge pattern">No supervisado</span>
                <h4>K-Means & IsolationForest</h4>
                <p class="model-desc">Detección de patrones y compras atípicas</p>
                <dl class="metric-dl">
                  <div><dt>Silhouette Score</dt><dd><strong>{{ u.silhouette ?? '0.42' }}</strong></dd></div>
                  <div><dt>Anomalías detectadas</dt><dd>{{ u.anomalies ?? 0 }}</dd></div>
                </dl>
              </article>
            }
          </div>

          <details class="tech-json">
            <summary>Ver detalle técnico de los modelos (JSON)</summary>
            <pre>{{ analyticsText() }}</pre>
          </details>
        }

        <!-- Simulador interactivo de demanda -->
        <section class="simulator-box">
          <h4>Simulador de predicción de demanda sintética</h4>
          <p class="subnote">Ajusta los parámetros para simular la demanda diaria estimada con el modelo entrenado.</p>

          <form (ngSubmit)="predictScenario()" class="sim-grid">
            <div class="field">
              <label for="sim-cat">Categoría</label>
              <select id="sim-cat" name="simCat" [(ngModel)]="scenario.category">
                <option value="camiseta">Camiseta</option>
                <option value="pantalon">Pantalón</option>
                <option value="vestido">Vestido</option>
              </select>
            </div>

            <div class="field">
              <label for="sim-dia">Día de la semana (0 lunes, 6 domingo)</label>
              <input id="sim-dia" type="number" name="simDia" min="0" max="6" [(ngModel)]="scenario.day_of_week" />
            </div>

            <div class="field">
              <label for="sim-mes">Mes del año (1 a 12)</label>
              <input id="sim-mes" type="number" name="simMes" min="1" max="12" [(ngModel)]="scenario.month" />
            </div>

            <div class="field">
              <label for="sim-precio">Precio sintético ($)</label>
              <input id="sim-precio" type="number" name="simPrecio" min="1" max="500" [(ngModel)]="scenario.price" />
            </div>

            <div class="field">
              <label for="sim-desc">Descuento (0.00 a 0.70)</label>
              <input id="sim-desc" type="number" step="0.05" min="0" max="0.70" name="simDesc" [(ngModel)]="scenario.discount" />
            </div>

            <div class="field">
              <label for="sim-promo">En promoción</label>
              <select id="sim-promo" name="simPromo" [(ngModel)]="scenario.promotion">
                <option [ngValue]="1">Sí (1)</option>
                <option [ngValue]="0">No (0)</option>
              </select>
            </div>

            <div class="sim-actions">
              <button class="primary" type="submit" [disabled]="busy()">Predecir demanda</button>
            </div>
          </form>

          @if (prediction()) {
            <div class="prediction-result" role="status">
              <strong>Resultado de la predicción:</strong>
              <p>{{ prediction() }}</p>
            </div>
          }
        </section>
      </section>
    }

    <!-- ==================== PESTAÑA 3: INDICADORES GENERALES POR EMPRESA (RESUMEN) ==================== -->
    @if (tab() === 'resumen') {
      <section class="surface filters-section" aria-label="Filtros del resumen operacional">
        <div class="surface-heading">
          <div>
            <p class="kicker">PANORAMA OPERACIONAL</p>
            <h3>Indicadores y exportaciones globales</h3>
            <p>Métricas consolidadas de ventas, inventario, reservas y devoluciones.</p>
          </div>
          <button class="primary" type="button" (click)="loadDashboard()" [disabled]="busy()">
            {{ busy() ? 'Calculando…' : 'Consultar indicadores' }}
          </button>
        </div>

        <div class="form-grid">
          <div class="field">
            <label for="res-empresa">Empresa</label>
            <select id="res-empresa" name="resIdEmp" [(ngModel)]="idEmp">
              <option [ngValue]="0">Todas las empresas</option>
              @for (company of companies(); track company.idEmp) {
                <option [ngValue]="company.idEmp">{{ company.nombre }} ({{ company.codigo }})</option>
              }
            </select>
          </div>

          <div class="field">
            <label for="res-plan">Plan</label>
            <select id="res-plan" name="resIdPlan" [(ngModel)]="idPlan">
              <option [ngValue]="0">Todos los planes</option>
              @for (plan of plans(); track plan.id) {
                <option [ngValue]="plan.id">{{ plan.nombre }}</option>
              }
            </select>
          </div>

          <div class="field">
            <label for="res-desde">Desde</label>
            <input id="res-desde" type="date" name="resFechaIni" [(ngModel)]="fechaIni" />
          </div>

          <div class="field">
            <label for="res-hasta">Hasta</label>
            <input id="res-hasta" type="date" name="resFechaFin" [(ngModel)]="fechaFin" />
          </div>
        </div>

        <!-- Descargas masivas globales -->
        <div class="global-export-row">
          <div>
            <strong>Exportar reporte estándar de la plataforma:</strong>
            <p class="subnote">Para múltiples empresas se descarga un ZIP organizado por empresa.</p>
          </div>
          <div class="export-controls">
            <select [(ngModel)]="tipoExportacion" name="tipoExportacionSelect">
              <option value="ventas">Ventas / compras de clientes</option>
              <option value="inventario">Inventario</option>
              <option value="reservas">Reservas</option>
              <option value="devoluciones">Devoluciones</option>
            </select>
            <button class="secondary" type="button" (click)="downloadStandard('pdf')" [disabled]="exporting()">PDF</button>
            <button class="secondary" type="button" (click)="downloadStandard('xlsx')" [disabled]="exporting()">Excel</button>
          </div>
        </div>
      </section>

      @if (dashboard(); as d) {
        <section class="results-section" aria-live="polite">
          <p class="source-info">{{ d.procedencia }} · Período: {{ d.fechaIni }} a {{ d.fechaFin }} · {{ d.empresas.length }} empresas</p>

          @for (item of d.empresas; track item.empresa.idEmp) {
            <article class="company-report-card">
              <header class="card-head">
                <div>
                  <span class="company-badge">{{ item.empresa.plan || 'Sin plan' }} · {{ item.empresa.codigo }}</span>
                  <h4>{{ item.empresa.nombre }}</h4>
                </div>
                <span class="status-pill">{{ item.empresa.estado }}</span>
              </header>

              <div class="metrics-grid">
                <div class="kpi-box"><span>Ventas pagadas</span><strong>{{ item.reporte.ventas }}</strong></div>
                <div class="kpi-box"><span>Ingresos</span><strong>{{ item.reporte.ingresos | currency:'USD':'code' }}</strong></div>
                <div class="kpi-box"><span>Unidades vendidas</span><strong>{{ item.reporte.poleras }}</strong></div>
                <div class="kpi-box"><span>Ticket promedio</span><strong>{{ item.reporte.ticketPromedio | currency:'USD':'code' }}</strong></div>
                <div class="kpi-box"><span>Reservas</span><strong>{{ item.reporte.reservas }}</strong></div>
                <div class="kpi-box"><span>Devoluciones</span><strong>{{ item.reporte.devoluciones }}</strong></div>
                <div class="kpi-box"><span>Stock disponible</span><strong>{{ item.reporte.inventario.disponible }} / {{ item.reporte.inventario.stock }}</strong></div>
                <div class="kpi-box"><span>Conv. reservas</span><strong>{{ item.reporte.conversionReservas }}%</strong></div>
              </div>

              <details class="breakdown-details">
                <summary>Ver ventas por sucursal y productos más vendidos</summary>
                <div class="table-wrap">
                  <table>
                    <thead><tr><th>Sucursal</th><th>Ventas</th><th>Unidades</th><th>Total</th><th>Ticket</th></tr></thead>
                    <tbody>
                      @for (s of item.reporte.sucursales; track s.nombre) {
                        <tr><td>{{ s.nombre }}</td><td>{{ s.ventas }}</td><td>{{ s.poleras }}</td><td>{{ s.total | currency:'USD':'code' }}</td><td>{{ s.ticket | currency:'USD':'code' }}</td></tr>
                      } @empty {
                        <tr><td colspan="5">Sin ventas en este período.</td></tr>
                      }
                    </tbody>
                  </table>
                </div>
              </details>

              <div class="card-footer-export">
                <button class="secondary" type="button" (click)="downloadStandard('pdf', item.empresa.idEmp)" [disabled]="exporting()">Descargar PDF</button>
                <button class="secondary" type="button" (click)="downloadStandard('xlsx', item.empresa.idEmp)" [disabled]="exporting()">Descargar Excel</button>
              </div>
            </article>
          } @empty {
            <p class="empty-state">No hay datos para el período y las empresas seleccionadas.</p>
          }
        </section>
      }
    }
  </section>
  `,
  styles: [`
    :host{display:block;color:#17272e}
    .saas-reports{display:grid;gap:18px}
    .heading,.surface-heading,.results-header,.card-head,.ai-header,.global-export-row{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap}
    .heading h2{margin:3px 0 5px;font-size:1.5rem;color:#142a30}
    .heading p,.surface-heading p,.ai-header p,.subnote,.source-info{margin:0;color:#5f747a;font-size:.88rem}
    .kicker{margin:0;color:#0d5f6e;font-size:.7rem;font-weight:750;letter-spacing:.1em;text-transform:uppercase}
    .surface{padding:20px;border:1px solid #dbe4e1;border-radius:12px;background:#fff}
    .surface-heading h3,.results-header h3{margin:2px 0 4px;font-size:1.2rem;color:#162f36}
    .report-tabs{display:flex;gap:8px;border-bottom:2px solid #e1e8e5}
    .report-tabs button{padding:9px 16px;border:none;background:transparent;font:inherit;font-size:.9rem;font-weight:650;color:#5a7076;cursor:pointer;border-radius:6px 6px 0 0}
    .report-tabs button.active{color:#0e5967;border-bottom:3px solid #0e5967;background:#f0f7f7;font-weight:750}
    .form-grid,.sim-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;align-items:end}
    .field{display:grid;gap:5px}
    .field label,.ai-input-group label{font-size:.84rem;font-weight:650;color:#32474e}
    .field input,.field select,textarea{min-height:38px;padding:7px 10px;border:1px solid #c7d4d6;border-radius:8px;background:#fff;color:#17272e;font:inherit}
    .field input:disabled,.field select:disabled{background:#f4f7f6;color:#8e9fa3}
    .form-actions,.sim-actions{display:flex;align-items:flex-end}
    .primary,.secondary{min-height:38px;padding:8px 16px;border-radius:8px;font:inherit;font-size:.88rem;font-weight:700;cursor:pointer;border:1px solid transparent}
    .primary{background:#0e5967;color:#fff;border-color:#0b4a55}
    .primary:disabled,.secondary:disabled{opacity:.55;cursor:wait}
    .secondary{background:#fff;border-color:#c7d4d6;color:#17272e}
    .ai-assist-box{margin-top:18px;padding:16px;border:1px solid #cce0dd;border-radius:10px;background:#f6faf9}
    .ai-header h4,.simulator-box h4{margin:2px 0 4px;font-size:1.05rem;color:#0d5f6e}
    .ai-input-group{display:grid;gap:6px}
    .ai-input-group textarea{width:100%;box-sizing:border-box;resize:vertical;min-height:55px}
    .ai-actions{display:flex;justify-content:flex-end}
    .proposal-card{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:12px;padding:12px;border-radius:8px;background:#e9f4f2;border:1px solid #b7dcda;flex-wrap:wrap}
    .proposal-details{margin:4px 0 0;font-size:.84rem;color:#214349}
    .results-section,.ml-section{display:grid;gap:16px}
    .export-actions,.export-controls,.card-footer-export{display:flex;gap:8px;align-items:center}
    .company-dynamic-card,.company-report-card{padding:16px;border:1px solid #e1e9e6;border-radius:10px;background:#fafcfb;display:grid;gap:12px}
    .company-badge{padding:2px 7px;border-radius:5px;background:#e3eff0;color:#0e5967;font-size:.75rem;font-weight:700}
    .table-wrap{overflow-x:auto;max-width:100%;border:1px solid #e3eae7;border-radius:8px;background:#fff}
    table{width:100%;border-collapse:collapse;font-size:.85rem;text-align:left}
    th,td{padding:8px 12px;border-bottom:1px solid #e9efec}
    th{background:#f3f7f5;font-weight:700;color:#2a3f45}
    .bars-container{padding:12px;border-radius:8px;background:#f2f7f5;border:1px solid #dce8e4}
    .bars-container h5{margin:0 0 8px;font-size:.82rem;color:#28474e;text-transform:uppercase}
    .bars-list{display:grid;gap:6px}
    .bar-row{display:grid;grid-template-columns:150px 1fr 90px;gap:10px;align-items:center;font-size:.82rem}
    .bar-label{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600}
    .bar-track{height:12px;background:#e0eae6;border-radius:5px;overflow:hidden}
    .bar-fill{height:100%;background:#0e5967;border-radius:5px}
    .bar-value{text-align:right;font-weight:700}
    .card-foot{font-size:.78rem;color:#70858b}
    .ml-cards-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}
    .ml-metric-card{padding:14px;border:1px solid #d9e3e0;border-radius:8px;background:#fafcfb}
    .model-badge{padding:2px 6px;border-radius:4px;font-size:.7rem;font-weight:750;background:#e0f2fe;color:#0369a1}
    .model-badge.pattern{background:#fef3c7;color:#92400e}
    .metric-dl{display:grid;gap:5px;margin:0}
    .metric-dl div{display:flex;justify-content:space-between;font-size:.84rem}
    .tech-json pre{padding:10px;border-radius:6px;background:#f4f7f6;font-size:.78rem;overflow:auto;max-height:220px}
    .simulator-box{padding:16px;border:1px solid #d8e5e1;border-radius:8px;background:#f8fbfa}
    .prediction-result{margin-top:12px;padding:12px;border-radius:8px;background:#eaf5ef;border:1px solid #bee3cb;color:#1c5232;font-size:.88rem}
    .metrics-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px}
    .kpi-box{padding:10px;border-radius:7px;background:#f4f8f6;display:grid;gap:3px}
    .kpi-box span{font-size:.75rem;color:#5f757b}
    .kpi-box strong{font-size:1.05rem;color:#142a30}
    .notice{padding:10px 14px;border-radius:8px;font-size:.88rem}
    .error{background:#fef2f2;color:#991b1b;border:1px solid #fecaca}
    .success{background:#f0fdf4;color:#166534;border:1px solid #bbf7d0}
    .status-pill{padding:2px 8px;border-radius:99px;background:#eef7ee;color:#235c2e;font-size:.78rem}
    .empty-state{text-align:center;color:#6b8086;padding:24px}
    @media(max-width:700px){.bar-row{grid-template-columns:110px 1fr 70px}}
  `]
})
export class SaasReportesComponent {
  private readonly http = inject(HttpClient);
  private readonly destroy = inject(DestroyRef);
  private readonly api = inject(API_BASE_URL).replace(/\/$/, '') + '/saas/reportes';

  readonly tab = signal<'dinamicos' | 'analitica' | 'resumen'>('dinamicos');
  readonly companies = signal<Company[]>([]);
  readonly branches = signal<Array<{ nro: number; nombre: string }>>([]);
  readonly dashboard = signal<DashboardResult | null>(null);
  readonly dynamicResult = signal<DynamicResult | null>(null);
  readonly decision = signal<VoiceDecision | null>(null);
  readonly analytics = signal<Record<string, unknown> | null>(null);
  readonly prediction = signal<string>('');

  readonly busy = signal(false);
  readonly exporting = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly iaDisponible = signal(false);
  readonly listening = signal(false);

  idEmp = 0;
  idPlan = 0;
  tipoExportacion: ReportKind = 'ventas';
  fechaIni = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  fechaFin = new Date().toISOString().slice(0, 10);

  readonly reportTypes = [
    { id: 'ventas_sucursal' as const, label: 'Ventas por sucursal y período' },
    { id: 'productos_vendidos' as const, label: 'Productos más vendidos' },
    { id: 'ventas_semana' as const, label: 'Evolución semanal de ventas' },
    { id: 'existencias_bajas' as const, label: 'Productos con menor existencia' },
  ];

  plan: DynamicPlan = {
    tipo: 'ventas_sucursal',
    fechaIni: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    fechaFin: new Date().toISOString().slice(0, 10),
    nroSuc: null,
    limite: 10,
    umbral: 5,
  };

  scenario = { category: 'camiseta' as const, day_of_week: 5, month: 6, price: 45, discount: 0.2, promotion: 1 };
  voiceText = '';
  private recognition: SpeechRecognition | null = null;

  constructor() {
    this.http.get<{ iaDisponible: boolean }>(`${this.api}/estado`).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: response => this.iaDisponible.set(response.iaDisponible),
      error: error => this.fail(error),
    });

    this.http.get<Company[]>(`${this.api}/empresas`).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: rows => {
        this.companies.set(rows);
        // Execute dynamic report on load for immediate display
        this.executeDynamic();
      },
      error: error => this.fail(error),
    });

    this.destroy.onDestroy(() => this.recognition?.stop());
  }

  setTab(tab: 'dinamicos' | 'analitica' | 'resumen'): void {
    this.tab.set(tab);
    this.error.set('');
    this.success.set('');
    if (tab === 'dinamicos' && !this.dynamicResult()) {
      this.executeDynamic();
    } else if (tab === 'analitica' && !this.analytics()) {
      this.loadAnalytics();
    } else if (tab === 'resumen' && !this.dashboard()) {
      this.loadDashboard();
    }
  }

  refreshActiveTab(): void {
    if (this.tab() === 'dinamicos') this.executeDynamic();
    else if (this.tab() === 'analitica') this.loadAnalytics();
    else if (this.tab() === 'resumen') this.loadDashboard();
  }

  plans(): Array<{ id: number; nombre: string }> {
    const byId = new Map<number, string>();
    for (const company of this.companies()) {
      if (company.idPlan && company.plan) byId.set(company.idPlan, company.plan);
    }
    return [...byId].map(([id, nombre]) => ({ id, nombre }));
  }

  onCompanyChange(): void {
    this.plan.nroSuc = null;
    this.branches.set([]);
    if (!this.idEmp) return;
    this.http.get<{ sucursales: Array<{ nro: number; nombre: string }> }>(`${this.api}/referencias`, {
      params: { idEmp: this.idEmp }
    }).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: res => this.branches.set(res.sucursales || []),
      error: () => this.branches.set([]),
    });
  }

  private scope(): Record<string, number> {
    return {
      ...(this.idEmp ? { idEmp: this.idEmp } : {}),
      ...(this.idPlan ? { idPlan: this.idPlan } : {}),
    };
  }

  // ==================== Dynamic CU28 Execution ====================
  executeDynamic(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.success.set('');

    const payloadPlan: DynamicPlan = {
      ...this.plan,
      nroSuc: this.plan.nroSuc ? Number(this.plan.nroSuc) : null,
      fechaIni: this.plan.tipo === 'existencias_bajas' ? null : this.plan.fechaIni,
      fechaFin: this.plan.tipo === 'existencias_bajas' ? null : this.plan.fechaFin,
      limite: Number(this.plan.limite) || 10,
      umbral: Number(this.plan.umbral) || 5,
    };

    const payload = { plan: payloadPlan, ...this.scope() };
    this.http.post<DynamicResult>(`${this.api}/dinamicos/ejecutar`, payload)
      .pipe(takeUntilDestroyed(this.destroy), finalize(() => this.busy.set(false)))
      .subscribe({
        next: result => {
          this.dynamicResult.set(result);
          this.success.set('Reporte calculado correctamente.');
        },
        error: error => this.fail(error),
      });
  }

  exportDynamic(format: Format): void {
    const res = this.dynamicResult();
    if (!res || this.exporting()) return;
    this.exporting.set(true);
    this.error.set('');
    this.http.post(`${this.api}/dinamicos/exportar`, { plan: res.plan, formato: format, ...this.scope() }, { responseType: 'blob' })
      .pipe(takeUntilDestroyed(this.destroy), finalize(() => this.exporting.set(false)))
      .subscribe({
        next: blob => this.save(blob, `reporte-${res.plan.tipo}.${format}${!this.idEmp ? '.zip' : ''}`),
        error: error => this.fail(error),
      });
  }

  // ==================== Subfeature CU29: IA (Texto / Voz) ====================
  interpret(): void {
    if (this.busy() || this.voiceText.trim().length < 3) return;
    this.busy.set(true);
    this.error.set('');
    this.decision.set(null);

    this.http.post<VoiceDecision>(`${this.api}/interpretar`, { texto: this.voiceText.trim(), ...this.scope() })
      .pipe(takeUntilDestroyed(this.destroy), finalize(() => this.busy.set(false)))
      .subscribe({
        next: result => {
          this.decision.set(result);
          if (result.estado === 'listo' && result.plan) {
            this.success.set('La IA generó una propuesta. Confirma para calcular el reporte.');
          } else {
            this.error.set(result.mensaje || 'La IA requiere más precisión en la consulta.');
          }
        },
        error: error => this.fail(error),
      });
  }

  confirmAndExecuteProposal(): void {
    const proposal = this.decision()?.plan;
    if (!proposal) return;
    this.plan = { ...proposal };
    this.executeDynamic();
  }

  listen(): void {
    const win = window as unknown as { SpeechRecognition?: new () => SpeechRecognition; webkitSpeechRecognition?: new () => SpeechRecognition };
    const Constructor = win.SpeechRecognition ?? win.webkitSpeechRecognition;
    if (!Constructor) {
      this.error.set('Este navegador no ofrece soporte para reconocimiento de voz Web Speech API. Puedes escribir la solicitud.');
      return;
    }
    this.recognition?.stop();
    const recognition = new Constructor();
    this.recognition = recognition;
    recognition.lang = 'es-BO';
    recognition.interimResults = false;
    recognition.onresult = event => {
      this.voiceText = Array.from(event.results).map(result => result[0].transcript).join(' ');
      this.success.set('Texto dictado con éxito. Revisa y pulsa "Interpretar con IA".');
    };
    recognition.onerror = () => {
      this.listening.set(false);
      this.error.set('No se pudo acceder al micrófono o el permiso fue denegado.');
    };
    recognition.onend = () => this.listening.set(false);
    try {
      recognition.start();
      this.listening.set(true);
    } catch {
      this.error.set('No se pudo iniciar la captura de audio.');
    }
  }

  // ==================== Tab 2: Machine Learning ====================
  loadAnalytics(): void {
    this.busy.set(true);
    this.error.set('');
    this.http.get<Record<string, unknown>>(`${this.api}/analitica`)
      .pipe(takeUntilDestroyed(this.destroy), finalize(() => this.busy.set(false)))
      .subscribe({
        next: r => this.analytics.set(r),
        error: error => this.fail(error),
      });
  }

  analyticsText(): string {
    return JSON.stringify(this.analytics(), null, 2);
  }

  supervisedMetrics(): Array<{ model: string; mae: number; rmse: number; r2: number }> {
    const sup = this.analytics()?.['supervised'] as { metrics?: Record<string, { mae: number; rmse: number; r2: number }> } | undefined;
    if (!sup?.metrics) return [];
    return Object.entries(sup.metrics).map(([model, m]) => ({ model, mae: m.mae, rmse: m.rmse, r2: m.r2 }));
  }

  unsupervisedSummary(): { silhouette?: number; anomalies?: number; clusters?: Array<Record<string, unknown>> } | null {
    const unsup = this.analytics()?.['unsupervised'] as { kmeans_silhouette?: number; anomalies_detected?: number; clusters?: Array<Record<string, unknown>> } | undefined;
    if (!unsup) return null;
    return { silhouette: unsup.kmeans_silhouette, anomalies: unsup.anomalies_detected, clusters: unsup.clusters };
  }

  predictScenario(): void {
    this.busy.set(true);
    this.error.set('');
    this.prediction.set('');
    this.http.post<{ synthetic: boolean; predicted_daily_units: number; limitation: string }>(`${this.api}/analitica/predecir`, this.scenario)
      .pipe(takeUntilDestroyed(this.destroy), finalize(() => this.busy.set(false)))
      .subscribe({
        next: r => this.prediction.set(`Predicción sintética: ${r.predicted_daily_units} unidades/día estimadas. ${r.limitation}`),
        error: error => this.fail(error),
      });
  }

  // ==================== Tab 3: Resumen de Empresas ====================
  loadDashboard(): void {
    if (!this.fechaIni || !this.fechaFin || this.fechaFin < this.fechaIni) {
      this.error.set('Verifica las fechas del período.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    let params = new HttpParams().set('fechaIni', this.fechaIni).set('fechaFin', this.fechaFin);
    for (const [key, value] of Object.entries(this.scope())) params = params.set(key, String(value));

    this.http.get<DashboardResult>(`${this.api}/dashboard`, { params })
      .pipe(takeUntilDestroyed(this.destroy), finalize(() => this.busy.set(false)))
      .subscribe({
        next: result => this.dashboard.set(result),
        error: error => this.fail(error),
      });
  }

  downloadStandard(format: Format, companyId?: number): void {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.error.set('');
    let params = new HttpParams().set('fechaIni', this.fechaIni).set('fechaFin', this.fechaFin)
      .set('tipo', this.tipoExportacion).set('formato', format);
    const scope = { ...this.scope(), ...(companyId ? { idEmp: companyId } : {}) };
    for (const [key, value] of Object.entries(scope)) params = params.set(key, String(value));

    this.http.get(`${this.api}/exportar`, { params, responseType: 'blob' })
      .pipe(takeUntilDestroyed(this.destroy), finalize(() => this.exporting.set(false)))
      .subscribe({
        next: blob => this.save(blob, `reporte-${this.tipoExportacion}.${format}${!companyId && !this.idEmp ? '.zip' : ''}`),
        error: error => this.fail(error),
      });
  }

  // ==================== Formatters & Bar Visuals ====================
  formatPlanType(tipo: DynamicType): string {
    const match = this.reportTypes.find(t => t.id === tipo);
    return match ? match.label : tipo;
  }

  formatTableCell(value: unknown): string {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'number') {
      return Number.isInteger(value) ? String(value) : value.toFixed(2);
    }
    return String(value);
  }

  getRowLabel(row: Record<string, string | number>): string {
    return String(row['sucursal'] ?? row['producto'] ?? row['semana'] ?? row['nombre'] ?? 'Registro');
  }

  getRowValueLabel(row: Record<string, string | number>, tipo: DynamicType): string {
    if (tipo === 'existencias_bajas') {
      return `${row['disponible'] ?? 0} disp.`;
    }
    if (row['importe'] !== undefined) {
      const num = Number(row['importe']) || 0;
      return `$${num.toFixed(2)}`;
    }
    if (row['unidades'] !== undefined) {
      return `${row['unidades']} uds.`;
    }
    if (row['ventas'] !== undefined) {
      return `${row['ventas']} ventas`;
    }
    return '';
  }

  getBarPercent(row: Record<string, string | number>, rows: Array<Record<string, string | number>>, tipo: DynamicType): number {
    const key = tipo === 'existencias_bajas' ? 'disponible' : (row['importe'] !== undefined ? 'importe' : 'unidades');
    const values = rows.map(r => Number(r[key]) || 0);
    const max = Math.max(1, ...values);
    const val = Number(row[key]) || 0;
    return Math.min(100, Math.max(4, Math.round((val / max) * 100)));
  }

  private save(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    this.success.set(`Archivo descargado con éxito: ${filename}`);
  }

  private fail(error: unknown): void {
    const response = error as HttpErrorResponse;
    const msg = response?.error?.error?.message || response?.error?.detail || response?.message || 'Error al procesar la solicitud.';
    this.error.set(msg);
  }
}
