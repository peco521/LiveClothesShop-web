import { ParamMap } from '@angular/router';

// Only non-sensitive pagination filters may travel through navigation.
export function clienteNavigationParams(params: ParamMap): { offset?: number; limit?: number } {
  const result: { offset?: number; limit?: number } = {};
  const offset = Number(params.get('offset')), limit = Number(params.get('limit'));
  if (params.has('offset') && Number.isSafeInteger(offset) && offset >= 0) result.offset = offset;
  if (params.has('limit') && Number.isInteger(limit) && limit >= 1 && limit <= 100) result.limit = limit;
  return result;
}
