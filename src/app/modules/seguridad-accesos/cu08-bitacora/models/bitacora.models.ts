export const ACCIONES = [
  'cliente_registrado', 'login_correcto', 'login_rechazado', 'logout_correcto',
  'recuperacion_solicitada', 'contrasena_restablecida', 'usuario_creado', 'empleado_creado',
  'usuario_actualizado', 'empleado_actualizado', 'usuario_activado', 'usuario_desactivado',
  'rol_creado', 'rol_actualizado', 'permisos_rol_actualizados',
  'cliente_actualizado', 'cliente_activado', 'cliente_desactivado',
  'ciudad_creada', 'ciudad_actualizada', 'sucursal_creada', 'sucursal_actualizada', 'sucursal_estado_actualizado',
  'reserva_creada', 'reserva_cancelada', 'reserva_vencida',
  'carrito_item_agregado', 'carrito_item_actualizado', 'carrito_item_eliminado',
  'venta_registrada', 'pago_iniciado', 'pago_aprobado', 'pago_rechazado', 'venta_anulada',
  'catalogo_guardado', 'catalogo_eliminado', 'proveedor_guardado', 'proveedor_eliminado', 'inventario_movimiento_registrado',
] as const;
export type Accion = typeof ACCIONES[number];
export function esAccion(value: unknown): value is Accion {
  return typeof value === 'string' && (ACCIONES as readonly string[]).includes(value);
}
export interface BitacoraFiltros {
  accion?: Accion; usuario_id?: string; desde?: string; hasta?: string;
  offset: number; limit: number;
}
export interface BitacoraResumen {
  id: string; usuario_id: string | null; accion: Accion | null; fecha: string; ip: string | null;
}
export interface BitacoraDetalle extends BitacoraResumen {
  detalles: { resultado: 'exito' | 'rechazado' } | null;
}
export interface BitacoraListado {
  items: BitacoraResumen[]; total: number; offset: number; limit: number;
}
export function esId(value: unknown): value is string {
  return typeof value === 'string' && value === value.trim() && /^[1-9][0-9]{0,18}$/.test(value)
    && (value.length < 19 || value <= '9223372036854775807');
}
