import { BitacoraDetalle, BitacoraListado, BitacoraResumen, esAccion, esId } from '../models/bitacora.models';
import { microsegundosISO } from '../models/bitacora-fecha';

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function invalid(): never { throw new Error('Respuesta de bitácora inválida'); }
function count(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0; }

export function resumenDTO(input: unknown): BitacoraResumen {
  const row = object(input);
  if (!row || !esId(row['id']) || typeof row['fecha'] !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(row['fecha'])
    || microsegundosISO(row['fecha']) === null) return invalid();
  const actor = row['usuario_id'];
  return { id: row['id'], fecha: row['fecha'], accion: esAccion(row['accion']) ? row['accion'] : null,
    ip: ipSegura(row['ip']),
    usuario_id: typeof actor === 'string' && actor.length > 0 && [...actor].length <= 100
      && !/[\u0000-\u001f\u007f]/.test(actor) ? actor : null };
}

export function ipSegura(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 45 || value !== value.trim()) return null;
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(value)) {
    return value.split('.').every(part => Number(part) <= 255 && String(Number(part)) === part) ? value : null;
  }
  if (!/^[0-9a-fA-F:.]+$/.test(value) || !value.includes(':')) return null;
  try { return new URL(`http://[${value}]/`).hostname.slice(1, -1); } catch { return null; }
}

export function detalleDTO(input: unknown): BitacoraDetalle {
  const summary = resumenDTO(input), row = object(input)!;
  const result = object(row['detalles'])?.['resultado'];
  const valid = summary.accion !== null && (summary.accion === 'login_rechazado' ? result === 'rechazado'
    : summary.accion === 'recuperacion_solicitada' ? result === 'exito' || result === 'rechazado' : result === 'exito');
  return { ...summary, ip: ipSegura(row['ip']),
    detalles: valid && (result === 'exito' || result === 'rechazado') ? { resultado: result } : null };
}

export function listadoDTO(input: unknown): BitacoraListado {
  const row = object(input);
  if (!row || !Array.isArray(row['items']) || !count(row['total']) || !count(row['offset'])
    || !count(row['limit']) || row['limit'] < 1 || row['limit'] > 100 || row['items'].length > row['limit']
    || row['items'].length > row['total']) return invalid();
  return { items: row['items'].map(resumenDTO), total: row['total'], offset: row['offset'], limit: row['limit'] };
}
