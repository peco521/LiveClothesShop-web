import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { BitacoraListaPage } from '../pages/bitacora-lista/bitacora-lista';
import { BitacoraService } from '../services/bitacora.service';
import { BitacoraFiltrosComponent } from '../components/bitacora-filtros';
import { microsegundosISO } from '../models/bitacora-fecha';
import { ACCIONES, esId } from '../models/bitacora.models';
import { detalleDTO, ipSegura, listadoDTO } from '../services/bitacora-dto';
import { listado, registro } from './bitacora.fixtures';

describe('CU08 DTO y fechas exactas', () => {
  it('mantiene ISO original, bigint string, orden y allowlist', () => {
    const result = listadoDTO({ ...listado, token: 'secret-marker', items: [
      { ...listado.items[0], contrasena: 'secret-marker', detalles: { token: 'secret-marker' } },
      { ...listado.items[0], id: '2' },
    ] });
    expect(result.items.map(v => v.id)).toEqual([registro.id, '2']);
    expect(result.items[0].fecha).toBe(registro.fecha); expect(JSON.stringify(result)).not.toContain('secret-marker');
    expect(result.items[0].ip).toBe(registro.ip);
    expect(listadoDTO({ ...listado, items: [{ ...listado.items[0], ip: 'secret-marker' }] }).items[0].ip).toBeNull();
    expect(detalleDTO({ ...registro, detalles: { resultado: 'exito', rol: 'secret-marker', agregadas: ['secret-marker'], retiradas: { token: 'secret-marker' } } })).toEqual(registro);
  });
  it.each([null, [], 'secret-marker', {}, { resultado: null }, { resultado: ['exito'] }, { resultado: { token: 'secret-marker' } }, { resultado: 'exito secret-marker' }, { resultado: true }])('descarta detalles malformados %j', detalles => {
    expect(detalleDTO({ ...registro, detalles }).detalles).toBeNull();
  });
  it.each(ACCIONES)('valida resultado por acción %s', accion => {
    for (const resultado of ['exito', 'rechazado', 'secret-marker']) {
      const allowed = accion === 'login_rechazado' ? resultado === 'rechazado'
        : accion === 'recuperacion_solicitada' ? resultado !== 'secret-marker' : resultado === 'exito';
      expect(detalleDTO({ ...registro, accion, detalles: { resultado } }).detalles).toEqual(allowed ? { resultado } : null);
    }
    // Security, organization and commerce events supported by the backend.
    expect(ACCIONES).toHaveLength(39);
  });
  it('desconocida, actor nullable/missing/malformado y propiedades privadas', () => {
    const result = detalleDTO({ ...registro, accion: 'secret-marker', usuario_id: { correo: 'secret-marker' }, usuario: { nombre: 'secret-marker' } });
    expect(result.accion).toBeNull(); expect(result.usuario_id).toBeNull(); expect(result.detalles).toBeNull();
    expect(JSON.stringify(result)).not.toContain('secret-marker');
    expect(detalleDTO({ id: registro.id, fecha: registro.fecha }).usuario_id).toBeNull();
  });
  it.each([0, 9007199254740992, '0', '01', '-1', '1e3', '1\n', '9223372036854775808', 'secret-marker'])('rechaza ID %s sin coerción', id => {
    expect(esId(id)).toBe(false); expect(() => detalleDTO({ ...registro, id })).toThrow('Respuesta de bitácora inválida');
  });
  it('admite máximo bigint sin Number', () => expect(esId('9223372036854775807')).toBe(true));
  it.each([null, {}, { ...listado, total: '21' }, { ...listado, limit: 101 }, { ...listado, items: {} }, { ...listado, items: [{ ...registro, fecha: 'secret-marker' }] }])('rechaza envelope malformado', value => {
    expect(() => listadoDTO(value)).toThrow('Respuesta de bitácora inválida');
  });
  it.each([['127.0.0.1', '127.0.0.1'], ['2001:0DB8::1', '2001:db8::1'], ['256.1.1.1', null], ['127.00.0.1', null], ['fe80::1%eth0', null], ['10.0.0.1/32', null], ['secret-marker', null], [{ ip: 'secret-marker' }, null]])('valida IP %s', (value, expected) => expect(ipSegura(value)).toBe(expected));
  it('compara offsets equivalentes y diferencias de un microsegundo', () => {
    const utc = microsegundosISO(registro.fecha)!;
    expect(microsegundosISO('2026-09-12T08:30:45.123456-04:00')).toBe(utc);
    expect(microsegundosISO('2026-09-12T14:30:45.123456+02:00')).toBe(utc);
    expect(microsegundosISO('2026-09-12T12:30:45.123457Z')! - utc).toBe(1n);
    expect(microsegundosISO('0001-01-01T00:00:00Z')).not.toBeNull();
    expect(microsegundosISO('2024-02-29T23:59:59Z')).not.toBeNull();
    expect(microsegundosISO(registro.fecha + '\n')).toBeNull();
    expect(ipSegura('::1\n')).toBeNull();
  });
  it.each(['2026-09-12', '2026-09-12T12:30:45', '1234567890', '2026-02-29T00:00:00Z', '2026-09-12T24:00:00Z', '2026-09-12T00:00:00+24:00', '2026-09-12T00:00:00+00:60', '2026-09-12T00:00:00.1234567Z', '0001-01-01T00:00:00+01:00', '9999-12-31T23:59:59-01:00'])('rechaza fecha %s', date => expect(microsegundosISO(date)).toBeNull());
});

describe('CU08 formulario de filtros', () => {
  it('oculta instrucciones técnicas y conserva la validación de filtros', () => {
    const fixture = TestBed.createComponent(BitacoraFiltrosComponent); fixture.detectChanges();
    const component = fixture.componentInstance, emit = vi.spyOn(component.aplicar, 'emit');
    expect(fixture.nativeElement.textContent).not.toContain('zona obligatoria');
    expect(fixture.nativeElement.textContent).not.toContain('Los filtros se conservan');
    expect(fixture.nativeElement.querySelector('[aria-describedby*="fecha-ayuda"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('input[type="datetime-local"]')).toBeNull();
    component.form.patchValue({ desde: '2026-09-12T12:30:45.123457Z', hasta: '2026-09-12T08:30:45.123456-04:00' });
    component.enviar(); fixture.detectChanges(); expect(emit).not.toHaveBeenCalled(); expect(fixture.nativeElement.textContent).toContain('Desde debe ser anterior');
    component.form.patchValue({ desde: registro.fecha, usuario_id: ' actor-exacto ' }); component.enviar();
    expect(emit).toHaveBeenLastCalledWith({ offset: 0, limit: 20, desde: registro.fecha, hasta: '2026-09-12T08:30:45.123456-04:00', usuario_id: ' actor-exacto ' });
    emit.mockClear();
    for (const limit of [0, 101, 1.5]) { component.form.patchValue({ limit }); component.enviar(); }
    component.form.patchValue({ limit: 20, desde: '2026-09-12T12:30:45' }); component.enviar();
    expect(emit).not.toHaveBeenCalled();
  });
});

describe('CU08 tabla de bitácora', () => {
  function render(ip: string | null) {
    TestBed.configureTestingModule({ imports: [BitacoraListaPage], providers: [
      provideRouter([]), { provide: BitacoraService, useValue: {
        listar: () => of({ ...listado, items: [{ ...listado.items[0], ip }] }),
      } },
    ] });
    const fixture = TestBed.createComponent(BitacoraListaPage); fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('muestra IP en lugar de Consulta y mantiene el detalle desde el ID', () => {
    const element = render(registro.ip);
    expect(Array.from(element.querySelectorAll('th')).map(th => th.textContent)).toEqual(['ID', 'Fecha (UTC)', 'Acción', 'ID del usuario', 'IP']);
    expect(element.querySelector('tbody td:last-child')?.textContent).toBe(registro.ip);
    const link = element.querySelector(`tbody a[href="/admin/bitacora/${registro.id}"]`);
    expect(link?.textContent).toBe(registro.id);
    for (const text of ['Consulta de solo lectura', 'zona obligatoria', 'Los filtros se conservan', 'orden: fecha descendente']) {
      expect(element.textContent).not.toContain(text);
    }
  });

  it('indica cuando no hay IP registrada', () => {
    expect(render(null).querySelector('tbody td:last-child')?.textContent).toBe('No registrada');
  });
});
