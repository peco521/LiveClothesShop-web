// Registrar aquí futuros módulos únicamente cuando tengan rutas implementadas.
export const ADMIN_MODULES = [
  { id: 'seguridad', title: 'Seguridad y accesos', items: [
    { title: 'Usuarios y empleados', path: '/admin/usuarios', permission: 'CU05' },
    { title: 'Roles y permisos', path: '/admin/roles', permission: 'CU06' },
    { title: 'Clientes', path: '/admin/clientes', permission: 'CU07' },
    { title: 'Bitácora', path: '/admin/bitacora', permission: 'CU08' },
    { title: 'Sucursales', path: '/admin/sucursales', permission: 'CU09' },
    { title: 'Ciudades', path: '/admin/ciudades', permission: 'CU09' },
  ] },
  { id: 'compras', title: 'Cliente y experiencia de compra', items: [
    { title: 'Historial de compras', path: '/admin/historial-compras', permission: 'CU15' },
  ] },
  { id: 'inventario', title: 'Inventario y productos', items: [
    { title: 'Gestionar catálogo', path: '/admin/catalogo/productos', permission: 'CU18' },
    { title: 'Gestionar proveedores', path: '/admin/proveedores', permission: 'CU19' },
    { title: 'Gestionar inventario', path: '/admin/inventario', permission: 'CU20' },
    { title: 'Promociones y descuentos', path: '/admin/promociones', permission: 'CU21' },
  ] },
  { id: 'sucursal', title: 'Operaciones de sucursal', items: [
    { title: 'Reservas de sucursal', path: '/admin/reservas-sucursal', permission: 'CU22' },
    { title: 'Devoluciones', path: '/admin/devoluciones', permission: 'CU23' },
    { title: 'Políticas de devolución', path: '/admin/politicas-devolucion', permission: 'CU23' },
    { title: 'Punto de venta', path: '/admin/caja', permission: 'CU24' },
  ] },
  { id: 'gerencia', title: 'Gestión gerencial', items: [
    { title: 'Dashboard y reportes', path: '/admin/reportes', permission: 'CU25' },
  ] },
];
