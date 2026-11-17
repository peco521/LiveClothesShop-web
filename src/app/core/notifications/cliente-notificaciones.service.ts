import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../config/api.config';

export interface NotificacionPromo {
  id: string;
  idEmp: number;
  tipo: string;
  idPromo?: number;
  titulo: string;
  promocion: string;
  descripcion: string;
  descuento: string;
  prendas: string;
  mensaje: string;
  fechaInicio?: string;
  fechaFin?: string;
  creadoEn: string;
}

@Injectable({
  providedIn: 'root',
})
export class ClienteNotificacionesService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL).replace(/\/$/, '');

  readonly notificaciones = signal<NotificacionPromo[]>([]);
  readonly readIds = signal<Set<string>>(this.loadReadIds());
  readonly permission = signal<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default',
  );
  readonly panelOpen = signal<boolean>(false);

  readonly unreadCount = computed(() => {
    const reads = this.readIds();
    return this.notificaciones().filter(item => !reads.has(item.id)).length;
  });

  private eventSource: EventSource | null = null;
  private iniciado = false;

  private loadReadIds(): Set<string> {
    if (typeof localStorage === 'undefined') return new Set();
    try {
      const stored = localStorage.getItem('fs_read_promo_notifs');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  }

  private saveReadIds(ids: Set<string>): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem('fs_read_promo_notifs', JSON.stringify(Array.from(ids)));
    } catch {
      // Ignorar error de storage
    }
  }

  iniciar(): void {
    if (this.iniciado) return;
    this.iniciado = true;

    this.cargarNotificaciones();
    this.conectarStream();
  }

  cargarNotificaciones(): void {
    this.http.get<{ items: NotificacionPromo[] }>(`${this.api}/api/cliente/notificaciones`, { withCredentials: true })
      .subscribe({
        next: res => {
          if (Array.isArray(res?.items)) {
            this.notificaciones.set(res.items);
          }
        },
        error: () => {
          // Si el endpoint no responde temporalmente o está fuera de línea, ignorar
        },
      });
  }

  private conectarStream(): void {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;

    try {
      if (this.eventSource) {
        this.eventSource.close();
      }
      this.eventSource = new EventSource(`${this.api}/api/cliente/notificaciones/stream`, { withCredentials: true });

      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.tipo === 'promocion' && data.id) {
            this.recibirNuevaNotificacion(data);
          }
        } catch {
          // Ping o mensaje no JSON
        }
      };

      this.eventSource.onerror = () => {
        // EventSource reintenta automáticamente
      };
    } catch {
      // Entorno sin soporte SSE
    }
  }

  private recibirNuevaNotificacion(item: NotificacionPromo): void {
    this.notificaciones.update(lista => {
      const exists = lista.some(n => n.id === item.id);
      if (exists) return lista;
      return [item, ...lista];
    });

    this.dispararPushNativo(item);
  }

  async pedirPermisoPush(): Promise<void> {
    if (typeof Notification === 'undefined') return;
    try {
      const res = await Notification.requestPermission();
      this.permission.set(res);
    } catch {
      // Ignorar
    }
  }

  private dispararPushNativo(item: NotificacionPromo): void {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(registration => {
          registration.showNotification(item.titulo || 'Nueva promoción en FashionStore', {
            body: item.mensaje || `${item.promocion}: ${item.descuento} en ${item.prendas}`,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            data: '/tienda',
            tag: item.id,
          });
        });
      } else {
        new Notification(item.titulo || 'Nueva promoción en FashionStore', {
          body: item.mensaje || `${item.promocion}: ${item.descuento} en ${item.prendas}`,
          icon: '/favicon.ico',
        });
      }
    } catch {
      // Manejo seguro en caso de política de navegador
    }
  }

  togglePanel(): void {
    this.panelOpen.update(v => !v);
  }

  marcarTodasLeidas(): void {
    const todos = new Set(this.readIds());
    for (const notif of this.notificaciones()) {
      todos.add(notif.id);
    }
    this.readIds.set(todos);
    this.saveReadIds(todos);
  }

  cerrarPanel(): void {
    this.panelOpen.set(false);
  }
}
