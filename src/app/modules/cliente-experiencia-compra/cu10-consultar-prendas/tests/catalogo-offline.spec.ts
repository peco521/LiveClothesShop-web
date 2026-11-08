import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { OfflineCatalogStorage } from '../../../../core/offline/offline-catalog-storage';
import { AuthService } from '../../../seguridad-accesos/services/auth.service';
import { AuthResponse } from '../../../seguridad-accesos/models/auth.models';
import { CatalogoDescargado, CatalogoOfflineRepository } from '../services/catalogo-offline.repository';
import { CatalogoService } from '../services/catalogo.service';
import { clienteSession as legacySession, detail, list } from './catalogo.fixtures';
const clienteSession: AuthResponse = { ...legacySession, empresa: 'manaco',
  usuario: { ...legacySession.usuario, tipo: 'C' } };

describe('Catálogo PWA explícito y separado por empresa/cuenta', () => {
  const auth = { session: signal<AuthResponse | null>(clienteSession) };
  let data: Map<string, unknown>;
  let storage: { read: ReturnType<typeof vi.fn>; write: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> };
  let service: CatalogoService;
  let repository: CatalogoOfflineRepository;
  let http: HttpTestingController;
  const key = (empresa: string, usuario: string) => JSON.stringify([empresa, usuario]);
  const saved = (): CatalogoDescargado => ({ version: 1, actualizado: '2026-01-01T12:00:00.000Z', productos: [detail] });
  beforeEach(() => {
    auth.session.set(clienteSession);
    data = new Map();
    storage = {
      read: vi.fn(async (empresa: string, usuario: string) => structuredClone(data.get(key(empresa, usuario)) ?? null)),
      write: vi.fn(async (empresa: string, usuario: string, value: unknown) => { data.set(key(empresa, usuario), structuredClone(value)); }),
      remove: vi.fn(async (empresa: string, usuario: string) => { data.delete(key(empresa, usuario)); }),
    };
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: AuthService, useValue: auth }, { provide: OfflineCatalogStorage, useValue: storage }] });
    service = TestBed.inject(CatalogoService); repository = TestBed.inject(CatalogoOfflineRepository);
    http = TestBed.inject(HttpTestingController);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  });
  afterEach(() => { http.verify(); vi.restoreAllMocks(); });

  function seed() { data.set(key(clienteSession.empresa!, clienteSession.usuario.idUsuario), saved()); }

  it('navegar online no escribe respuestas privadas ni catálogo', async () => {
    const response = firstValueFrom(service.listar({ offset: 0, limit: 20 }));
    http.expectOne('/api/catalogo/productos?offset=0&limit=20').flush(list);
    expect(await response).toEqual(list);
    expect(storage.write).not.toHaveBeenCalled();
  });

  it('descarga explícita obtiene detalle completo, allowlist y metadatos en una escritura', async () => {
    const download = service.descargar([detail.idProd, detail.idProd]);
    http.expectOne(`/api/catalogo/productos/${detail.idProd}`).flush({ ...detail, token: 'not-persisted',
      variantes: detail.variantes.map(variant => ({ ...variant, privado: 'not-persisted' })) });
    await download;
    expect(storage.write).toHaveBeenCalledOnce();
    const snapshot = repository.snapshot()!;
    expect(snapshot.productos).toEqual([detail]);
    expect(Number.isFinite(Date.parse(snapshot.actualizado))).toBe(true);
    expect(JSON.stringify(snapshot)).not.toContain('not-persisted');
    expect(storage.write.mock.calls[0].slice(0, 2)).toEqual([clienteSession.empresa, clienteSession.usuario.idUsuario]);
  });

  it('fallo parcial no reemplaza una descarga anterior', async () => {
    seed();
    const download = service.descargar([detail.idProd, 'otra-prenda']);
    const rejected = expect(download).rejects.toBeTruthy();
    http.expectOne(`/api/catalogo/productos/${detail.idProd}`).flush(detail);
    await Promise.resolve(); await Promise.resolve();
    http.expectOne('/api/catalogo/productos/otra-prenda').flush({}, { status: 503, statusText: 'Unavailable' });
    await rejected;
    expect(storage.write).not.toHaveBeenCalled();
    expect((await repository.read())?.productos).toEqual([detail]);
  });

  it('relee almacenamiento sin caché en memoria y permite lista, variante, facetas y detalle sin HTTP', async () => {
    seed(); vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const result = await firstValueFrom(service.listar({ offset: 20, limit: 20 }));
    expect(result.items[0].idProd).toBe(detail.idProd); expect(result.offset).toBe(0); expect(result.total).toBe(1);
    expect(await firstValueFrom(service.detalle(detail.idProd))).toEqual(detail);
    expect(await firstValueFrom(service.detalleVariante(detail.variantes[0].idVariante))).toEqual(detail);
    expect((await firstValueFrom(service.faceta('tallas'))).items.length).toBeGreaterThan(0);
    expect(repository.usingOffline()).toBe(true); expect(repository.stale()).toBe(true);
    http.expectNone(() => true);
  });

  it('falla claramente si la prenda no está descargada o no hay copia', async () => {
    seed(); vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await expect(firstValueFrom(service.detalle('no-descargada'))).rejects.toThrow('subconjunto descargado');
    await repository.remove();
    await expect(firstValueFrom(service.listar({ offset: 0, limit: 20 }))).rejects.toThrow('Descarga explícitamente');
  });

  it.each([401, 403, 404, 422, 503])('no oculta HTTP %s con una copia offline', async status => {
    seed();
    const response = firstValueFrom(service.detalle(detail.idProd));
    const rejected = expect(response).rejects.toMatchObject({ status });
    http.expectOne(`/api/catalogo/productos/${detail.idProd}`).flush({}, { status, statusText: 'Rejected' });
    await rejected;
    expect(repository.usingOffline()).toBe(false);
  });

  it('API inaccesible con navegador online usa exclusivamente la descarga explícita', async () => {
    seed();
    const response = firstValueFrom(service.detalle(detail.idProd));
    http.expectOne(`/api/catalogo/productos/${detail.idProd}`).error(new ProgressEvent('error'));
    expect(await response).toEqual(detail); expect(repository.usingOffline()).toBe(true);
  });

  it.each(['empresa', 'usuario'])('una nueva %s no puede leer la partición anterior', async field => {
    seed(); await repository.read();
    auth.session.set(field === 'empresa' ? { ...clienteSession, empresa: 'otra-empresa' }
      : { ...clienteSession, usuario: { ...clienteSession.usuario, idUsuario: 'otro-usuario' } });
    expect(repository.snapshot()).toBeNull();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await expect(firstValueFrom(service.detalle(detail.idProd))).rejects.toThrow('Descarga explícitamente');
  });

  it('descarta HTTP tardío de descarga después del cambio de sesión', async () => {
    const download = service.descargar([detail.idProd]);
    const rejected = expect(download).rejects.toThrow('sesión cambió');
    const pending = http.expectOne(`/api/catalogo/productos/${detail.idProd}`);
    auth.session.set({ ...clienteSession, empresa: 'otra' });
    pending.flush(detail);
    await rejected;
    expect(storage.write).not.toHaveBeenCalled(); expect(repository.snapshot()).toBeNull();
  });

  it('descarta lectura local tardía de otra cuenta', async () => {
    let finish!: (value: CatalogoDescargado) => void;
    storage.read.mockReturnValueOnce(new Promise<CatalogoDescargado>(resolve => { finish = resolve; }));
    const pending = repository.read();
    auth.session.set({ ...clienteSession, usuario: { ...clienteSession.usuario, idUsuario: 'otro' } });
    finish(saved());
    expect(await pending).toBeNull(); expect(repository.snapshot()).toBeNull();
  });

  it('elimina solo la descarga actual, sin tocar otras empresas ni la cola', async () => {
    seed(); data.set(key('otra', 'otro'), saved());
    await repository.remove();
    expect(data.size).toBe(1); expect(data.has(key('otra', 'otro'))).toBe(true);
    expect(repository.snapshot()).toBeNull();
  });

  it('aplica filtros locales conocidos sin inventar temporada', () => {
    expect(repository.list(saved(), { offset: 0, limit: 20, idCat: -1 }).total).toBe(0);
    expect(repository.list(saved(), { offset: 0, limit: 20, minPrecio: 999999 }).total).toBe(0);
    expect(() => repository.list(saved(), { offset: 0, limit: 20, idTemp: 1 })).toThrow('temporada requiere conexión');
  });
});
