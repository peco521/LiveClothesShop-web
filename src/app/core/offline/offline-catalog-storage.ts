import { Injectable } from '@angular/core';

/** Dedicated database: never a cache of authenticated HTTP responses or queue data. */
@Injectable({ providedIn: 'root' })
export class OfflineCatalogStorage {
  private database?: Promise<IDBDatabase>;

  private open(): Promise<IDBDatabase> {
    if (typeof indexedDB === 'undefined') return Promise.reject(new Error('Este navegador no permite almacenamiento offline.'));
    if (!this.database) {
      this.database = new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('fashionstore-catalog-v1', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('catalogs');
        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => { db.close(); this.database = undefined; };
          resolve(db);
        };
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('Cierra otras pestañas para habilitar el catálogo offline.'));
      }).catch(error => { this.database = undefined; throw error; });
    }
    return this.database;
  }

  async read<T>(empresa: string, usuario: string): Promise<T | null> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('catalogs', 'readonly');
      const request = transaction.objectStore('catalogs').get(JSON.stringify([empresa, usuario]));
      transaction.oncomplete = () => resolve((request.result as T | undefined) ?? null);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? new Error('Lectura offline interrumpida.'));
    });
  }

  async write<T>(empresa: string, usuario: string, value: T): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('catalogs', 'readwrite');
      transaction.objectStore('catalogs').put(value, JSON.stringify([empresa, usuario]));
      // A successful request is not enough: quota/abort can still roll back the transaction.
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? new Error('No se pudo guardar el catálogo offline.'));
    });
  }

  async remove(empresa: string, usuario: string): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('catalogs', 'readwrite');
      transaction.objectStore('catalogs').delete(JSON.stringify([empresa, usuario]));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? new Error('No se pudo eliminar el catálogo offline.'));
    });
  }
}
