import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';

export type OfflineKind = 'venta' | 'reserva';
export type OfflineState = 'pendiente' | 'reintento_pendiente' | 'en_proceso' | 'sincronizada' | 'conflicto' | 'rechazada';

export interface OfflineOperation {
  id: string;
  empresa: string;
  usuario: string;
  tipo: OfflineKind;
  version: 1;
  fecha: string;
  datos: Record<string, unknown>;
  sucursal: number;
  dependeDe: string[];
  estado: OfflineState;
  intentos: number;
  siguienteIntento: number;
  codigo?: string;
  detalle?: string;
  nroReserva?: number;
}

const DB_NAME = 'fashionstore-offline-v1';
const STORE = 'operations';
const BATCH_SIZE = 25;

@Injectable({ providedIn: 'root' })
export class PwaSyncService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly api = inject(API_BASE_URL).replace(/\/$/, '');
  private database?: Promise<IDBDatabase>;
  private identity: { empresa: string; usuario: string } | null = null;
  private localFlush: Promise<void> | null = null;
  private retryTimer?: ReturnType<typeof setTimeout>;
  readonly online = signal(true);
  /** Reachability from an authenticated /auth/me probe, not navigator.onLine. */
  readonly apiReachable = signal<boolean | null>(null);
  readonly pending = signal(0);
  readonly conflicts = signal(0);
  readonly operations = signal<OfflineOperation[]>([]);
  readonly conflictItems = computed(() => this.operations().filter(item => item.estado === 'conflicto' || item.estado === 'rechazada'));
  readonly lastSync = signal<string | null>(null);
  readonly busy = signal(false);

  initialize(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.online.set(navigator.onLine);
    window.addEventListener('online', () => { this.online.set(true); void this.probeApi().then(() => this.flush()); });
    window.addEventListener('offline', () => { this.online.set(false); this.apiReachable.set(false); });
    navigator.serviceWorker?.addEventListener('message', event => {
      if (event.data?.type === 'FASHIONSTORE_SYNC_REQUEST') void this.flush();
    });
    void navigator.serviceWorker?.register('/fashionstore-sw.js').catch(() => undefined);
    void this.probeApi();
  }

  activate(empresa: string | null | undefined, usuario: string): void {
    this.identity = empresa ? { empresa, usuario } : null;
    void this.refreshCount();
    if (this.identity && this.online()) void this.probeApi().then(() => this.flush());
  }

  pause(): void {
    this.identity = null;
    this.pending.set(0);
    this.conflicts.set(0);
    this.operations.set([]);
  }

  /** Distinguishes a live API (including 401 session expiry) from offline DNS/network. */
  async probeApi(): Promise<boolean> {
    if (!isPlatformBrowser(this.platformId) || !this.online()) {
      this.apiReachable.set(false);
      return false;
    }
    try {
      await firstValueFrom(this.http.get(`${this.api}/auth/me`));
      this.apiReachable.set(true);
    } catch (error) {
      this.apiReachable.set(error instanceof HttpErrorResponse && error.status !== 0);
    }
    return this.apiReachable() === true;
  }

  async enqueue(input: Omit<OfflineOperation, 'id' | 'empresa' | 'usuario' | 'version' | 'fecha' | 'estado' | 'intentos' | 'siguienteIntento'>): Promise<string> {
    const identity = this.identity;
    if (!identity) throw new Error('Se requiere una sesión de empresa para guardar una operación offline');
    const operation: OfflineOperation = {
      ...input, id: crypto.randomUUID(), ...identity, version: 1,
      fecha: new Date().toISOString(), estado: 'pendiente', intentos: 0, siguienteIntento: 0,
    };
    await this.write(operation);
    await this.refreshCount();
    navigator.serviceWorker?.controller?.postMessage({ type: 'FASHIONSTORE_REGISTER_SYNC' });
    if (this.online()) void this.flush();
    return operation.id;
  }

  async list(): Promise<OfflineOperation[]> {
    const identity = this.identity;
    if (!identity) return [];
    return (await this.all()).filter(item => item.empresa === identity.empresa && item.usuario === identity.usuario);
  }

  async flush(): Promise<void> {
    if (!this.identity || !this.online() || this.busy()) return;
    if (this.localFlush) return this.localFlush;
    const run = async () => {
      this.busy.set(true);
      try {
        const lock = (navigator as Navigator & { locks?: { request<T>(name: string, callback: () => Promise<T>): Promise<T> } }).locks;
        if (lock) await lock.request('fashionstore-offline-queue', () => this.sendBatches());
        else await this.withIndexedDbLock(() => this.sendBatches());
      } finally {
        this.busy.set(false);
        this.localFlush = null;
      }
    };
    this.localFlush = run();
    return this.localFlush;
  }

  private async sendBatches(): Promise<void> {
    const identity = this.identity;
    if (!identity) return;
    const operations = (await this.list())
      .filter(item => ['pendiente', 'reintento_pendiente'].includes(item.estado) && item.siguienteIntento <= Date.now())
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
    for (let index = 0; index < operations.length; index += BATCH_SIZE) {
      if (!this.identity || this.identity.empresa !== identity.empresa || this.identity.usuario !== identity.usuario) return;
      const batch = operations.slice(index, index + BATCH_SIZE);
      try {
        const response = await firstValueFrom(this.http.post<{
          resultados: Array<{ id: string; estado: string; codigo?: string; detalle?: string; nroReserva?: number }>;
        }>(`${this.api}/sync/lote`, {
          dispositivo: 'fashionstore-pwa', origen: 'pwa',
          operaciones: batch.map(({ id, tipo, version, fecha, sucursal, datos, dependeDe }) =>
            ({ id, tipo, version, fecha, sucursal, datos, dependeDe })),
        }));
        for (const result of response.resultados) {
          const existing = batch.find(item => item.id === result.id);
          if (!existing) continue;
          const state: OfflineState = result.estado === 'sincronizada' ? 'sincronizada'
            : result.estado === 'conflicto' ? 'conflicto'
            : result.estado === 'rechazada' ? 'rechazada' : 'reintento_pendiente';
          await this.write({ ...existing, estado: state, intentos: existing.intentos + 1,
            codigo: result.codigo, detalle: result.detalle, nroReserva: result.nroReserva,
            siguienteIntento: state === 'reintento_pendiente' ? Date.now() + this.backoff(existing.intentos + 1) : 0 });
        }
        this.lastSync.set(new Date().toISOString());
      } catch {
        for (const item of batch) {
          const attempts = item.intentos + 1;
          await this.write({ ...item, estado: 'reintento_pendiente', intentos: attempts,
            siguienteIntento: Date.now() + this.backoff(attempts) });
        }
        this.scheduleRetry(Math.min(...batch.map(item => this.backoff(item.intentos + 1))));
        break;
      }
    }
    await this.refreshCount();
  }

  private backoff(attempt: number): number { return Math.min(60_000 * (2 ** Math.min(attempt - 1, 6)), 3_600_000); }

  private scheduleRetry(delay: number): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.identity) this.retryTimer = setTimeout(() => void this.flush(), delay);
  }

  private async withIndexedDbLock(action: () => Promise<void>): Promise<void> {
    const db = await this.open();
    const owner = crypto.randomUUID();
    const acquire = () => new Promise<boolean>((resolve, reject) => {
      const transaction = db.transaction('locks', 'readwrite');
      const store = transaction.objectStore('locks');
      const request = store.get('queue');
      let acquired = false;
      request.onsuccess = () => {
        if (!request.result || request.result.expires < Date.now()) {
          store.put({ key: 'queue', owner, expires: Date.now() + 120_000 });
          acquired = true;
        }
      };
      transaction.oncomplete = () => resolve(acquired);
      transaction.onerror = () => reject(transaction.error);
    });
    let locked = await acquire();
    for (let retry = 0; !locked && retry < 20; retry++) {
      await new Promise(resolve => setTimeout(resolve, 100 + retry * 50));
      if (!this.identity) return;
      locked = await acquire();
    }
    if (!locked) return;
    try { await action(); }
    finally {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction('locks', 'readwrite');
        const store = transaction.objectStore('locks');
        const request = store.get('queue');
        request.onsuccess = () => { if (request.result?.owner === owner) store.delete('queue'); };
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    }
  }

  private async refreshCount(): Promise<void> {
    const identity = this.identity;
    const items = await this.list();
    if (this.identity !== identity) return;
    this.operations.set(items);
    this.pending.set(items.filter(item => !['sincronizada', 'conflicto', 'rechazada'].includes(item.estado)).length);
    this.conflicts.set(items.filter(item => ['conflicto', 'rechazada'].includes(item.estado)).length);
  }

  private async all(): Promise<OfflineOperation[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      request.onsuccess = () => resolve(request.result as OfflineOperation[]);
      request.onerror = () => reject(request.error);
    });
  }

  private async write(operation: OfflineOperation): Promise<void> {
    const db = await this.open();
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(STORE, 'readwrite').objectStore(STORE).put(operation);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private open(): Promise<IDBDatabase> {
    if (!this.database) this.database = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 2);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'id' });
        if (!request.result.objectStoreNames.contains('locks')) request.result.createObjectStore('locks', { keyPath: 'key' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return this.database;
  }
}
