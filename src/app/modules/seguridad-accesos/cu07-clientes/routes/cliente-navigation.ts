import { ParamMap } from '@angular/router';

// Only non-sensitive pagination/account filters may travel through navigation.
export function clienteNavigationParams(params: ParamMap): { offset?: number; limit?: number; activo?: boolean } {
  const result: { offset?: number; limit?: number; activo?: boolean } = {};
  const offset = Number(params.get('offset')), limit = Number(params.get('limit'));
  if (params.has('offset') && Number.isSafeInteger(offset) && offset >= 0) result.offset = offset;
  if (params.has('limit') && Number.isInteger(limit) && limit >= 1 && limit <= 100) result.limit = limit;
  if (params.get('activo') === 'true' || params.get('activo') === 'false') result.activo = params.get('activo') === 'true';
  return result;
}
