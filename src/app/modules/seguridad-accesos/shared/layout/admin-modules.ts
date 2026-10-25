// Registrar aquí futuros módulos únicamente cuando tengan rutas implementadas.
export const ADMIN_MODULES = [
  { id: 'seguridad', icon: 'shield', title: 'Seguridad y accesos', items: [
    { icon: 'users', title: 'Usuarios y empleados', path: '/admin/usuarios', permission: 'CU05' },
    { icon: 'key', title: 'Roles y permisos', path: '/admin/roles', permission: 'CU06' },
    { icon: 'user', title: 'Clientes', path: '/admin/clientes', permission: 'CU07' },
    { icon: 'receipt', title: 'Bitácora', path: '/admin/bitacora', permission: 'CU08' },
    { icon: 'store', title: 'Sucursales', path: '/admin/sucursales', permission: 'CU09' },
    { icon: 'city', title: 'Ciudades', path: '/admin/ciudades', permission: 'CU09' },
  ] },
  { id: 'compras', icon: 'bag', title: 'Cliente y experiencia de compra', items: [
    { icon: 'receipt', title: 'Historial de compras', path: '/admin/historial-compras', permission: 'CU15' },
  ] },
  { id: 'inventario', icon: 'hanger', title: 'Inventario y productos', items: [
    { icon: 'tag', title: 'Gestionar catálogo', path: '/admin/catalogo/productos', permission: 'CU18' },
    { icon: 'truck', title: 'Gestionar proveedores', path: '/admin/proveedores', permission: 'CU19' },
    { icon: 'boxes', title: 'Gestionar inventario', path: '/admin/inventario', permission: 'CU20' },
    { icon: 'tag', title: 'Promociones y descuentos', path: '/admin/promociones', permission: 'CU21' },
  ] },
  { id: 'sucursal', icon: 'store', title: 'Operaciones de sucursal', items: [
    { icon: 'calendar', title: 'Reservas de sucursal', path: '/admin/reservas-sucursal', permission: 'CU22' },
    { icon: 'return', title: 'Devoluciones', path: '/admin/devoluciones', permission: 'CU23' },
    { icon: 'receipt', title: 'Políticas de devolución', path: '/admin/politicas-devolucion', permission: 'CU23' },
    { icon: 'cash', title: 'Punto de venta', path: '/admin/caja', permission: 'CU24' },
  ] },
  { id: 'gerencia', icon: 'chart', title: 'Gestión gerencial', items: [
    { icon: 'chart', title: 'Dashboard y reportes', path: '/admin/reportes', permission: 'CU25' },
  ] },
];
