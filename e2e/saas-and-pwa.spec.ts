import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

type DemoCredentials = {
  plataforma: { correo: string; contrasena: string };
  empresas: Array<{ codigo: string; usuarios: Record<string, { correo: string; contrasena: string }> }>;
};

const apiRoot = path.resolve(__dirname, '../../LiveClothesShop-api');
const python = path.join(apiRoot, '.venv', 'Scripts', 'python.exe');
const offlineOperationIds = new Set<string>();
const cu07Clients: Array<{ empresa: string; correo: string }> = [];
let saasSnapshot: string | undefined;
let rcManifest: string | undefined;
let cu23Manifest: string | undefined;
type RCCompany = { code: string; tenant: number; user: string; email: string; password: string;
  product: string; variant: string; branch: number; branchName: string; city: string };

function prepareRC(): RCCompany[] {
  rcManifest = execFileSync(python, [path.join(apiRoot, 'scripts', 'manage_reservas_carrito_e2e.py'), 'prepare'],
    { cwd: apiRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  return JSON.parse(readFileSync(rcManifest, 'utf8')).companies;
}
function verifyRC(): Array<{ code: string; stock: number; reservations: number }> {
  return JSON.parse(execFileSync(python, [path.join(apiRoot, 'scripts', 'manage_reservas_carrito_e2e.py'),
    'verify', '--manifest', rcManifest!], { cwd: apiRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
}
type CU23Fixture = { tenant: number; sale: number; inventory: number };
function prepareCU23(): CU23Fixture {
  cu23Manifest = execFileSync(python, [path.join(apiRoot, 'scripts', 'manage_cu23_e2e.py'), 'prepare'],
    { cwd: apiRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  return JSON.parse(readFileSync(cu23Manifest, 'utf8')) as CU23Fixture;
}
function verifyCU23(): { returnState: string; inventory: number[] } {
  return JSON.parse(execFileSync(python, [path.join(apiRoot, 'scripts', 'manage_cu23_e2e.py'),
    'verify', '--manifest', cu23Manifest!], { cwd: apiRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
}
async function loginRC(page: Page, company: RCCompany): Promise<void> {
  const started = Date.now();
  const restored = page.waitForResponse(response => response.url().endsWith('/api/auth/me')
    && response.request().timing().startTime >= started);
  await page.goto('/login'); await restored;
  await page.getByLabel('Empresa', { exact: true }).fill(company.code);
  await page.getByLabel('Correo electrónico').fill(company.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(company.password);
  const loggedIn = page.waitForResponse(response => response.url().endsWith('/api/auth/login/cliente') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Iniciar sesión', exact: false }).click();
  expect((await loggedIn).status()).toBe(200); await expect(page).toHaveURL(/\/tienda$/);
}
async function localReservation(page: Page, id: string): Promise<{ estado: string; nroReserva?: number } | null> {
  return page.evaluate(id => new Promise<{ estado: string; nroReserva?: number } | null>((resolve, reject) => {
    const opening = indexedDB.open('fashionstore-offline-v1');
    opening.onerror = () => reject(new Error('No se pudo leer la cola propia'));
    opening.onsuccess = () => { const db = opening.result;
      const request = db.transaction('operations', 'readonly').objectStore('operations').get(id);
      request.onsuccess = () => { db.close(); resolve(request.result ? { estado: request.result.estado, nroReserva: request.result.nroReserva } : null); };
      request.onerror = () => { db.close(); reject(new Error('No se pudo leer la operación propia')); };
    };
  }), id);
}

test.afterEach(() => {
  const cleanupErrors: unknown[] = [];
  if (cu23Manifest) {
    try {
      execFileSync(python, [path.join(apiRoot, 'scripts', 'manage_cu23_e2e.py'),
        'cleanup', '--manifest', cu23Manifest], { cwd: apiRoot, stdio: 'ignore' });
    } catch (error) {
      cleanupErrors.push(error);
    }
    cu23Manifest = undefined;
  }
  if (rcManifest) {
    try { execFileSync(python, [path.join(apiRoot, 'scripts', 'manage_reservas_carrito_e2e.py'),
      'cleanup', '--manifest', rcManifest], { cwd: apiRoot, stdio: 'ignore' }); }
    catch (error) { cleanupErrors.push(error); }
    rcManifest = undefined;
  }
  if (saasSnapshot) {
    try {
      execFileSync(python, [path.join(apiRoot, 'scripts', 'manage_saas_e2e.py'),
        'restore', '--snapshot', saasSnapshot], { cwd: apiRoot, stdio: 'ignore' });
    } catch (error) {
      cleanupErrors.push(error);
    }
    saasSnapshot = undefined;
  }
  if (offlineOperationIds.size) {
    const cleanupArgs = [path.join(apiRoot, 'scripts', 'verify_offline_sale_e2e.py'), 'cleanup'];
    for (const id of offlineOperationIds) cleanupArgs.push('--cleanup-uuid', id);
    try {
      execFileSync(python, cleanupArgs, { cwd: apiRoot, stdio: 'ignore' });
    } catch (error) {
      cleanupErrors.push(error);
    }
    offlineOperationIds.clear();
  }
  for (const account of cu07Clients) {
    try {
      execFileSync(python, [path.join(apiRoot, 'scripts', 'cleanup_cu07_e2e.py'),
        '--empresa', account.empresa, '--correo', account.correo], { cwd: apiRoot, stdio: 'ignore' });
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  cu07Clients.length = 0;
  if (cleanupErrors.length) {
    throw new AggregateError(cleanupErrors, 'La limpieza de efectos E2E falló');
  }
});

function credentials(): DemoCredentials {
  const file = process.env.FASHIONSTORE_DEMO_CREDENTIALS
    || path.resolve(__dirname, '../../LiveClothesShop-api/.local/demo_credentials.json');
  return JSON.parse(readFileSync(file, 'utf8')) as DemoCredentials;
}

async function reservationForm(page: Page, company: RCCompany, quantity: number) {
  const ranges = (await (await page.request.get(`/api/cliente/sucursales/${company.branch}/horarios`)).json()).rangos;
  let date = '', hour = '11:00';
  for (let offset = 1; offset < 15; offset++) {
    const future = new Date(); future.setDate(future.getDate() + offset);
    const range = ranges.find((row: { dias: number[] }) => row.dias.includes(future.getDay() || 7));
    if (range || !ranges.length) {
      date = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
      if (range) hour = range.horaIni.slice(0, 5);
      break;
    }
  }
  expect(date).not.toBe('');
  await page.goto(`/tienda/reservas/nueva?idVar=${company.variant}&cantidad=${quantity}`);
  await page.getByLabel('Sucursal', { exact: true }).selectOption({ label: `${company.branchName} · ${company.city}` });
  await page.getByLabel('Fecha de la visita').fill(date);
  await page.getByLabel('Hora aproximada').fill(hour);
  await expect(page.locator('.reservation-item')).toContainText('Prenda reservas carrito E2E');
  await expect(page.locator('.reservation-item .stock')).toContainText('7 unidades disponibles');
  return { nroSuc: company.branch, fechaReserva: date, horaAtencion: hour,
    items: [{ idVar: company.variant, cantidad: quantity }] };
}

test('Reservas CU11: offline sin retención, aceptación única, cancelación y conflicto real', async ({ page, context }) => {
  test.setTimeout(180_000);
  const company = prepareRC()[0];
  await loginRC(page, company);
  await reservationForm(page, company, 1);
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Confirmar reserva', exact: true }).click();
  const local = page.locator('p.local-reservation');
  await expect(local).toContainText('no retiene stock');
  const uuid = (await local.getAttribute('data-operation-id'))!;
  expect((await localReservation(page, uuid))?.estado).toBe('pendiente');
  expect(verifyRC().find(row => row.code === company.code)).toMatchObject({ stock: 7, reservations: 0 });
  await context.setOffline(false);
  await expect.poll(async () => (await localReservation(page, uuid))?.estado).toBe('sincronizada');
  const accepted = (await localReservation(page, uuid))!;
  expect(accepted.nroReserva).toBeGreaterThan(0);
  expect(verifyRC().find(row => row.code === company.code)).toMatchObject({ stock: 6, reservations: 1 });
  await page.goto('/tienda/reservas');
  await expect(page.locator(`[data-operation-id="${uuid}"]`)).toContainText('sincronizada');
  await page.getByRole('link', { name: `Ver reserva ${accepted.nroReserva}`, exact: true }).click();
  await page.getByRole('button', { name: 'Cancelar reserva', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar cancelación', exact: true }).click();
  await expect(page.locator('.reservation-heading .badge')).toHaveText('cancelada');
  expect(verifyRC().find(row => row.code === company.code)?.stock).toBe(7);
  // Change availability after the UI's snapshot, before synchronizing the next
  // offline intent. The server, not the locally displayed 7, decides the result.
  const payload = await reservationForm(page, company, 2);
  const held = await page.request.post('/api/cliente/reservas', {
    headers: { Origin: 'http://localhost:4200', 'X-CSRF-Protection': '1' },
    data: { ...payload, items: [{ idVar: company.variant, cantidad: 6 }] },
  });
  expect(held.status()).toBe(201);
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Confirmar reserva', exact: true }).click();
  await expect(local).toBeVisible();
  const conflictUuid = (await local.getAttribute('data-operation-id'))!;
  await context.setOffline(false);
  await expect.poll(async () => (await localReservation(page, conflictUuid))?.estado).toBe('conflicto');
  expect(verifyRC().find(row => row.code === company.code)).toMatchObject({ stock: 1, reservations: 2 });
  await page.goto('/tienda/reservas');
  await expect(page.locator(`[data-operation-id="${conflictUuid}"]`)).toContainText('stock_insuficiente');
});

test('Sync reserva: pérdida de respuesta después del commit reintenta el mismo UUID sin doble retención', async ({page})=>{
  test.setTimeout(120_000);
  const [company]=prepareRC();await page.clock.install();await loginRC(page,company);
  await reservationForm(page,company,1);
  let lost=false;
  await page.route('**/api/sync/lote',async route=>{
    if(!lost){lost=true;const committed=await route.fetch();expect(committed.status()).toBe(200);await route.abort('failed');}
    else await route.continue();
  });
  await page.getByRole('button',{name:'Confirmar reserva',exact:true}).click();
  const local=page.locator('p.local-reservation');await expect(local).toBeVisible();
  const id=(await local.getAttribute('data-operation-id'))!;
  await expect.poll(async()=> (await localReservation(page,id))?.estado).toBe('reintento_pendiente');
  expect(verifyRC().find(row=>row.code===company.code)).toMatchObject({stock:6,reservations:1});
  await page.clock.fastForward(61000);
  await expect.poll(async()=> (await localReservation(page,id))?.estado,{timeout:20_000}).toBe('sincronizada');
  const accepted=await localReservation(page,id);expect(accepted?.nroReserva).toBeGreaterThan(0);
  expect(verifyRC().find(row=>row.code===company.code)).toMatchObject({stock:6,reservations:1});
});

test('Carrito CU12: agregar, modificar, retirar y cambiar de empresa sin inventario ni pago', async ({ page }) => {
  test.setTimeout(120_000);
  const companies = prepareRC(); const [a, b] = companies;
  await loginRC(page, a);
  await page.goto(`/tienda/prendas/${a.product}`);
  await page.getByRole('button', { name: 'Añadir al carrito', exact: true }).click();
  await expect(page.getByText('Prenda agregada al carrito.', { exact: false })).toBeVisible();
  await page.goto('/tienda/carrito');
  await expect(page.locator('article.cart-product')).toContainText('Prenda reservas carrito E2E');
  const quantity = page.getByRole('spinbutton', { name: /Cantidad de Prenda reservas carrito E2E/ });
  await quantity.fill('3'); await quantity.blur();
  await expect.poll(async () => (await (await page.request.get('/api/cliente/carrito')).json()).subtotal).toBe('333.00');
  const cart = await (await page.request.get('/api/cliente/carrito')).json();
  expect(cart.cantidadItems).toBe(3);
  expect(verifyRC().find(row => row.code === a.code)?.stock).toBe(7);
  expect((await page.request.post('/api/integraciones/stripe/webhook', { data: {} })).status()).toBe(503);
  await page.getByRole('button', { name: /Cancelar y retirar/ }).click();
  await page.getByRole('button', { name: 'Sí, cancelar carrito', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tu carrito está vacío' })).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await loginRC(page, b);
  await page.goto('/tienda/carrito');
  await expect(page.getByRole('heading', { name: 'Tu carrito está vacío' })).toBeVisible();
  expect((await page.request.get('/api/cliente/carrito')).status()).toBe(200);
  expect((await page.request.get(`/api/catalogo/productos/${a.product}`)).status()).toBe(404);
  expect(verifyRC().every(row => row.stock === 7)).toBe(true);
});

test('PWA catálogo: descarga explícita IndexedDB, cierre y reapertura offline con aislamiento', async ({ page, context }) => {
  test.setTimeout(120_000);
  const [a,b]=prepareRC();
  await loginRC(page,a);
  const name='Prenda reservas carrito E2E '+a.code;
  await page.goto(`/tienda/prendas/${a.product}`);
  await expect(page.getByRole('heading',{name,exact:true,level:1})).toBeVisible();
  await page.waitForFunction(()=>!!navigator.serviceWorker?.controller);
  await page.goto('/tienda');
  await page.getByRole('textbox',{name:'Buscar prendas, marcas o categorías'}).fill(name);
  await page.getByRole('button',{name:'Buscar',exact:true}).click();
  await page.getByRole('button',{name:'Descargar página visible (1 prendas)',exact:true}).click();
  await expect(page.getByText('Descarga completa.',{exact:false})).toBeVisible();
  await expect(page.locator('app-catalogo-offline-panel')).toContainText('Subconjunto descargado: 1 prendas');
  // Close the page, not only an Angular component: IndexedDB and SW must reopen.
  await context.setOffline(true);await page.close();
  const reopened=await context.newPage();
  await reopened.goto('/tienda');
  await expect(reopened.locator('app-catalogo-offline-panel')).toContainText('Consultando descarga sin conexión');
  await expect(reopened.locator('app-catalogo-offline-panel')).toContainText('pueden estar desactualizados');
  await expect(reopened.getByRole('link',{name:new RegExp(name)}).first()).toBeVisible();
  await reopened.locator(`a[href="/tienda/prendas/${a.product}"]`).first().click();
  await expect(reopened.getByRole('heading',{name,exact:true,level:1})).toBeVisible();
  await expect(reopened.locator('app-catalogo-offline-panel')).toContainText('1 prendas');
  await context.setOffline(false);
  await reopened.getByRole('button',{name:'Cerrar sesión',exact:true}).click();
  await expect(reopened).toHaveURL(/\/login$/);
  await loginRC(reopened,b);
  await expect(reopened.locator('app-catalogo-offline-panel')).not.toContainText('Subconjunto descargado:');
  expect((await reopened.request.get(`/api/catalogo/productos/${a.product}`)).status()).toBe(404);
});

test('CU25 dinámicos: cuatro reportes, exportación calculada, IA local y rechazo Básico', async ({ page }) => {
  test.setTimeout(180_000);
  const demo=credentials();
  const login=async(code:string)=>{
    const account=demo.empresas.find(e=>e.codigo===code)!.usuarios.admin;
    await page.goto('/admin/login');
    await page.getByLabel('Código de empresa').fill(code);
    await page.getByLabel('Correo electrónico').fill(account.correo);
    await page.getByLabel('Contraseña').fill(account.contrasena);
    await page.getByRole('button',{name:/Acceder al panel/}).click();
    await expect(page).toHaveURL('http://localhost:4200/admin');
  };
  await login('manaco');
  await page.goto('/admin/reportes/dinamicos');
  await page.getByLabel('Desde',{exact:true}).fill('2026-01-01');
  await page.getByLabel('Hasta',{exact:true}).fill('2026-12-31');
  await page.getByLabel('Límite',{exact:true}).fill('5');
  for(const tipo of ['ventas_sucursal','productos_vendidos','ventas_semana','existencias_bajas']){
    await page.getByLabel('Reporte',{exact:true}).selectOption(tipo);
    if(tipo==='existencias_bajas')await page.getByLabel('Disponible máximo').fill('100000');
    const response=page.waitForResponse(r=>r.url().endsWith('/api/admin/reportes/dinamicos/ejecutar')&&r.request().method()==='POST');
    await page.getByRole('button',{name:'Calcular reporte',exact:true}).click();
    expect((await response).status()).toBe(200);
    await expect(page.getByRole('region',{name:'Resultado calculado'})).toContainText('datos comerciales reales');
  }
  for(const format of ['PDF','Excel']){
    const download=page.waitForEvent('download');
    await page.getByRole('button',{name:`Exportar ${format} calculado`,exact:true}).click();
    const file=await download;expect(file.suggestedFilename()).toBe('fashionstore-reporte.'+(format==='PDF'?'pdf':'xlsx'));
    expect(await file.failure()).toBeNull();
  }
  await page.getByLabel('Solicitud escrita o reconocida').fill('Ventas por sucursal del 2026-10-01 al 2026-10-31');
  await page.getByRole('button',{name:'Interpretar texto confirmado',exact:true}).click();
  await expect(page.getByRole('button',{name:'Confirmar plan y calcular',exact:true})).toBeVisible({timeout:60_000});
  await page.getByRole('button',{name:'Confirmar plan y calcular',exact:true}).click();
  await expect(page.getByRole('region',{name:'Resultado calculado'})).toContainText('Ventas por sucursal y período');
  await page.getByRole('button',{name:'Consultar modelos y métricas sintéticas',exact:true}).click();
  await expect(page.locator('pre')).toContainText('synthetic');
  await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();
  await login('urbanwomen');await page.goto('/admin/reportes/dinamicos');
  const denied=await page.request.post('/api/admin/reportes/interpretar',{
    headers:{Origin:'http://localhost:4200','X-CSRF-Protection':'1'},data:{texto:'Ventas por sucursal del 2026-10-01 al 2026-10-31'}});
  expect(denied.status()).toBe(403);
  expect((await page.request.get('/api/admin/reportes/analitica')).status()).toBe(403);
});

test('Comercial CU19 CU20: proveedores y movimientos desde pantallas existentes', async ({page})=>{
  test.setTimeout(120_000);
  const [company]=prepareRC();const demo=credentials();const admin=demo.empresas.find(e=>e.codigo===company.code)!.usuarios.admin;
  await page.goto('/admin/login');await page.getByLabel('Código de empresa').fill(company.code);
  await page.getByLabel('Correo electrónico').fill(admin.correo);await page.getByLabel('Contraseña').fill(admin.contrasena);
  await page.getByRole('button',{name:/Acceder al panel/}).click();await expect(page).toHaveURL('http://localhost:4200/admin');
  await page.goto('/admin/proveedores');
  await page.getByRole('button',{name:'Crear proveedor',exact:true}).click();
  const name=company.product+'-supplier';
  await page.getByLabel('Nombre',{exact:true}).fill(name);
  await page.getByLabel('Correo',{exact:true}).fill('autonomo-test@example.com');
  await page.getByLabel('Dirección',{exact:true}).fill('Dirección de prueba');
  await page.getByLabel('Teléfono',{exact:true}).fill('70000000');
  await page.getByRole('button',{name:'Guardar',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Guardado correctamente.'})).toBeVisible();
  await page.getByLabel('Buscar por nombre',{exact:true}).fill(name);await page.getByRole('button',{name:'Buscar',exact:true}).click();
  const supplier=page.locator('tbody tr').filter({hasText:name});await expect(supplier).toHaveCount(1);
  await supplier.getByRole('button',{name:'Editar',exact:true}).click();
  await page.getByLabel('Dirección',{exact:true}).fill('Dirección actualizada');await page.getByRole('button',{name:'Guardar',exact:true}).click();
  await expect(supplier).toContainText('Dirección actualizada');
  await supplier.getByRole('button',{name:'Eliminar',exact:true}).click();
  await page.getByRole('button',{name:'Confirmar eliminación',exact:true}).click();await expect(supplier).toHaveCount(0);
  await page.goto('/admin/inventario');
  await page.getByLabel('Prenda o SKU').fill(company.variant);await page.getByRole('button',{name:'Aplicar filtros',exact:true}).click();
  const row=page.locator('tbody tr').filter({hasText:company.variant});await expect(row).toHaveCount(1);
  for(const tipo of ['entrada','salida']){
    await row.getByRole('button',{name:'Movimiento',exact:true}).click();
    await page.getByLabel('Tipo de movimiento').selectOption(tipo);
    await page.getByLabel('Cantidad de unidades').fill('2');await page.getByLabel('Motivo',{exact:true}).fill('Fixture autónomo E2E');
    await page.getByRole('button',{name:'Guardar movimiento',exact:true}).click();
    await expect(page.getByRole('status').filter({hasText:'Movimiento registrado'})).toBeVisible();
    expect(verifyRC().find(r=>r.code===company.code)?.stock).toBe(tipo==='entrada'?9:7);
  }
  await row.getByRole('button',{name:'Historial',exact:true}).click();
  await expect(page.getByRole('heading',{name:/Movimientos:/})).toBeVisible();
  await expect(page.locator('tr').filter({hasText:'Fixture autónomo E2E'})).toHaveCount(2);
  await page.goto('/admin/catalogo/productos');
  await page.getByLabel('Nombre o SKU',{exact:true}).fill(company.variant);await page.getByRole('button',{name:'Buscar',exact:true}).click();
  await page.locator('tbody tr').filter({hasText:'Prenda reservas carrito E2E '+company.code}).getByRole('button',{name:'Editar',exact:true}).click();
  await page.locator('.variant-list tbody tr').first().getByRole('button',{name:'Editar',exact:true}).click();
  await page.getByLabel('Precio (USD)',{exact:true}).fill('120.00');
  await page.getByRole('group',{name:'Colores',exact:true}).getByRole('checkbox').first().check();
  await page.getByRole('button',{name:'Aplicar variante',exact:true}).click();
  const edited=page.waitForResponse(r=>r.url().endsWith('/api/admin/catalogo/productos/'+company.product)&&r.request().method()==='PUT');
  await page.getByRole('button',{name:'Guardar prenda',exact:true}).click();expect((await edited).status()).toBe(200);
  const detail=await (await page.request.get('/api/admin/catalogo/productos/'+company.product)).json();
  expect(detail.variantes[0].idVariante).toBe(company.variant);expect(Number(detail.variantes[0].precio)).toBe(120);
  await page.goto('/admin/promociones');await page.getByRole('button',{name:'Crear promoción',exact:true}).click();
  const promotion=company.product+'-promotion';
  await page.getByLabel('Nombre',{exact:true}).fill(promotion);
  await page.getByLabel('Valor del descuento',{exact:true}).fill('15');
  const today=new Date();const end=new Date();end.setDate(today.getDate()+5);
  await page.getByLabel('Fecha de inicio',{exact:true}).fill(today.toISOString().slice(0,10));
  await page.getByLabel('Fecha de fin',{exact:true}).fill(end.toISOString().slice(0,10));
  await page.getByLabel('Descripción',{exact:true}).fill('Fixture promoción propia E2E');
  await page.getByRole('textbox',{name:'Buscar prendas',exact:true}).fill('Prenda reservas carrito E2E '+company.code);
  await page.getByRole('button',{name:'Buscar',exact:true}).click();
  await page.locator('button.product-card').filter({hasText:'Prenda reservas carrito E2E '+company.code}).click();
  const promoted=page.waitForResponse(r=>r.url().endsWith('/api/admin/promociones')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Guardar promoción',exact:true}).click();expect((await promoted).status()).toBe(201);
  const promoRow=page.locator('tbody tr').filter({hasText:promotion});await expect(promoRow).toContainText('15');
  page.once('dialog',dialog=>dialog.accept());
  await promoRow.getByRole('button',{name:'Desactivar',exact:true}).click();
  await expect(promoRow).toContainText('cancelada');
});

test('Compra sandbox CU13–CU15: timeout, reintento estable, stock e historial propio',async({page})=>{
  test.setTimeout(120_000);
  const [company,other]=prepareRC();await loginRC(page,company);
  const headers={Origin:'http://localhost:4200','X-CSRF-Protection':'1'};
  expect((await page.request.post('/api/cliente/carrito/items',{headers,data:{idVar:company.variant,cantidad:2}})).status()).toBe(201);
  await page.goto('/tienda/finalizar-compra');
  await page.getByLabel('Selecciona tu sucursal',{exact:true}).selectOption({label:company.branchName+' · '+company.city});
  await page.getByText('Opciones de simulación',{exact:true}).click();
  await page.getByLabel('Resultado simulado',{exact:true}).selectOption('timeout');
  const paymentResponse=page.waitForResponse(r=>r.url().endsWith('/api/cliente/pagos')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Pagar ahora',exact:true}).click();
  const payment=await (await paymentResponse).json();expect(payment.estado).toBe('pendiente');
  await expect(page.getByRole('heading',{name:'Pago pendiente',exact:true})).toBeVisible();
  expect(verifyRC().find(r=>r.code===company.code)?.stock).toBe(7);
  // Retry the SAME payment through the explicitly labeled academic UI.
  const retryResponse=page.waitForResponse(r=>r.url().endsWith(`/api/cliente/pagos/${payment.idPago}/procesar`));
  await page.getByRole('button',{name:'Reintentar pago simulado',exact:true}).click();
  const approved=await retryResponse;expect(approved.status()).toBe(200);
  expect((await approved.json()).idPago).toBe(payment.idPago);
  expect(verifyRC().find(r=>r.code===company.code)?.stock).toBe(5);
  const duplicate=await page.request.post(`/api/cliente/pagos/${payment.idPago}/procesar`,{headers,data:{escenario:'aprobado'}});
  expect(duplicate.status()).toBe(200);expect((await duplicate.json()).estado).toBe('aprobado');
  expect(verifyRC().find(r=>r.code===company.code)?.stock).toBe(5);
  await page.reload();await expect(page.getByRole('heading',{name:'Compra completada',exact:true})).toBeVisible();
  await page.getByRole('link',{name:'Ver mis compras',exact:true}).click();
  await expect(page.locator('article.purchase-card')).toHaveCount(1);
  await page.getByRole('link',{name:`Ver detalle de la compra ${payment.nroVenta}`,exact:true}).click();
  await expect(page.getByRole('table',{name:'Productos de la compra',exact:true})
    .getByRole('cell').filter({hasText:'Prenda reservas carrito E2E '+company.code})).toBeVisible();
  const frozen=await (await page.request.get(`/api/cliente/historial-compras/${payment.nroVenta}`)).json();
  expect(Number(frozen.total)).toBe(222);expect(Number(frozen.items[0].precioUnitario)).toBe(111);
  await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();
  await loginRC(page,other);
  expect((await page.request.get(`/api/cliente/historial-compras/${payment.nroVenta}`)).status()).toBe(404);
  expect((await (await page.request.get('/api/cliente/historial-compras')).json()).total).toBe(0);
});

test('CU10: cliente consulta catálogo, filtros y disponibilidad y cambia de empresa sin datos anteriores', async ({ page }) => {
  test.setTimeout(120_000);
  const demo = credentials();
  expect((await page.request.get('/api/catalogo/productos?empresa=manaco')).status()).toBe(401);
  let previousId: string | undefined;
  for (const code of ['manaco', 'urbanwomen']) {
    const company = demo.empresas.find(item => item.codigo === code)!;
    // Wait for LoginPage.afterNextRender -> restore before filling SSR markup.
    // Otherwise a cold start can discard input before Angular binds the form.
    const navigationStarted = Date.now();
    const restored = page.waitForResponse(response => response.url().endsWith('/api/auth/me')
      && response.request().timing().startTime >= navigationStarted);
    await page.goto('/login');
    expect((await restored).status()).toBe(401);
    await page.getByLabel('Empresa', { exact: true }).fill(code);
    await page.getByLabel('Correo electrónico').fill(company.usuarios.cliente.correo);
    await page.getByLabel('Contraseña', { exact: true }).fill(company.usuarios.cliente.contrasena);
    const loggedIn = page.waitForResponse(response => response.url().endsWith('/api/auth/login/cliente')
      && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Iniciar sesión', exact: false }).click();
    expect((await loggedIn).status()).toBe(200);
    await expect(page).toHaveURL(/\/tienda$/);
    await expect(page.getByRole('heading', { name: 'Catálogo', exact: true })).toBeVisible();
    const listed = await page.request.get('/api/catalogo/productos?limit=100');
    expect(listed.status()).toBe(200);
    const catalog = await listed.json();
    expect(catalog.total).toBeGreaterThan(0);
    const product = catalog.items.find((item: { totalVariantes: number }) => item.totalVariantes > 0);
    expect(product).toBeTruthy();
    if (previousId) {
      expect(catalog.items.some((item: { idProd: string }) => item.idProd === previousId)).toBe(false);
      expect((await page.request.get(`/api/catalogo/productos/${previousId}`)).status()).toBe(404);
      await expect(page.locator(`a[href="/tienda/prendas/${previousId}"]`)).toHaveCount(0);
    }
    await page.getByLabel('Buscar prendas, marcas o categorías', { exact: true }).fill(product.idProd);
    await page.getByRole('button', { name: 'Buscar', exact: true }).click();
    await expect(page.locator('p.results-count')).toHaveText('1 prendas encontradas.');
    const card = page.locator('article.product-card');
    await expect(card).toHaveCount(1);
    await expect(card).toContainText(product.descripcion);
    await card.getByRole('link', { name: /Ver detalle/ }).click();
    await expect(page.getByRole('heading', { name: product.descripcion, exact: true, level: 1 })).toBeVisible();
    const detailed = await page.request.get(`/api/catalogo/productos/${product.idProd}`);
    expect(detailed.status()).toBe(200);
    const detail = await detailed.json();
    expect(detail.variantes.length).toBeGreaterThan(0);
    await expect(page.getByRole('heading', { name: 'Disponibilidad por sucursal', exact: true })).toBeVisible();
    const selected = detail.variantes[0];
    for (const availability of detail.disponibilidad.filter((row: { idVariante: string }) => row.idVariante === selected.idVariante)) {
      await expect(page.locator('article.branch').filter({ hasText: availability.sucursal })).toContainText(availability.ciudad);
    }
    expect((await page.request.get(`/api/catalogo/variantes/${selected.idVariante}`)).status()).toBe(200);
    expect((await page.request.get('/api/catalogo/productos?empresa=otra')).status()).toBe(422);
    expect((await page.request.post('/api/integraciones/stripe/webhook', { data: {} })).status()).toBe(503);
    expect((await page.request.post('/api/cliente/pagos', {
      headers:{Origin:'http://localhost:4200','X-CSRF-Protection':'1'},data:{} })).status()).toBe(422);
    previousId = product.idProd;
    await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect((await page.request.get('/api/catalogo/productos')).status()).toBe(401);
  }
  // Read-only catalog scenario; keep real authentication audit, no cleanup SQL.
});

test('CU08: bitácora empresarial muestra el login comprobado y aísla dos empresas', async ({ page }) => {
  test.setTimeout(120_000);
  const demo = credentials();
  let previous: { id: string; actor: string } | undefined;
  for (const code of ['manaco', 'urbanwomen']) {
    await page.context().clearCookies();
    const company = demo.empresas.find(item => item.codigo === code)!;
    await page.goto('/admin/login');
    await page.getByLabel('Código de empresa').fill(code);
    await page.getByLabel('Correo electrónico').fill(company.usuarios.admin.correo);
    await page.getByLabel('Contraseña').fill(company.usuarios.admin.contrasena);
    const since = new Date().toISOString();
    const loginResponse = page.waitForResponse(response =>
      response.url().includes('/api/auth/login') && response.request().method() === 'POST');
    await page.getByRole('button', { name: /Acceder al panel/ }).click();
    const login = await loginResponse;
    expect(login.status()).toBe(200);
    const identity = await login.json();
    expect(identity.permisos).toContain('CU08');
    const actor = identity.usuario.idUsuario as string;
    await expect(page).toHaveURL('http://localhost:4200/admin');
    const params = new URLSearchParams({ accion: 'login_correcto', usuario_id: actor, desde: since });
    const listed = await page.request.get(`/api/admin/bitacora?${params}`);
    expect(listed.status()).toBe(200);
    const events = await listed.json();
    expect(events.total).toBe(1);
    const id = events.items[0].id as string;

    await page.goto('/admin/bitacora');
    await expect(page.getByRole('heading', { name: 'Consultar bitácora' })).toBeVisible();
    await page.getByLabel('Acción', { exact: true }).selectOption('login_correcto');
    await page.getByLabel('ID del usuario', { exact: true }).fill(actor);
    await page.getByLabel('Desde', { exact: true }).fill(since);
    await page.getByRole('button', { name: 'Aplicar filtros' }).click();
    await expect(page.getByRole('status')).toHaveText('1 registros');
    const row = page.getByRole('row').filter({ has: page.getByRole('link', { name: `Ver detalle del registro ${id}`, exact: true }) });
    await expect(row).toContainText('login_correcto');
    await expect(row).toContainText(actor);
    await page.getByRole('link', { name: `Ver detalle del registro ${id}`, exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Detalle de bitácora' })).toBeVisible();
    await expect(page.getByText('login_correcto', { exact: true })).toBeVisible();
    const detail = await page.request.get(`/api/admin/bitacora/${id}`);
    expect(detail.status()).toBe(200);
    expect((await detail.json()).detalles).toEqual({ resultado: 'exito' });
    expect(await detail.text()).not.toContain(company.usuarios.admin.contrasena);
    expect((await page.request.get('/api/saas/auditoria')).status()).toBe(403);
    if (previous) {
      expect((await page.request.get(`/api/admin/bitacora/${previous.id}`)).status()).toBe(404);
      await page.goto('/admin/bitacora');
      await page.getByLabel('ID del usuario', { exact: true }).fill(previous.actor);
      await page.getByRole('button', { name: 'Aplicar filtros' }).click();
      await expect(page.getByRole('status')).toHaveText('0 registros');
      await expect(page.getByText('No hay registros en esta página.')).toBeVisible();
    }
    previous = { id, actor };
  }
  // Only real logins were generated. Keep their audit history; no audit cleanup.
});

test('Chrome registra el Service Worker PWA en localhost y recorre SaaS con API/PostgreSQL reales', async ({ page }) => {
  test.setTimeout(120_000);
  const demo = credentials();
  saasSnapshot = execFileSync(python, [
    path.join(apiRoot, 'scripts', 'manage_saas_e2e.py'), 'snapshot', '--company', 'manaco',
  ], { cwd: apiRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  await page.goto('/saas/login');
  await expect(page.getByRole('heading', { name: 'Administración SaaS' })).toBeVisible();
  const sw = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return { scope: registration.scope, script: registration.active?.scriptURL ?? null };
  });
  expect(sw.scope).toContain('/');
  expect(sw.script).toBe(new URL('/fashionstore-sw.js', page.url()).href);

  await page.getByLabel('Correo electrónico').fill(demo.plataforma.correo);
  await page.getByLabel('Contraseña').fill(demo.plataforma.contrasena);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page).toHaveURL(/\/saas$/);
  await expect(page.getByRole('heading', { name: 'Administración SaaS' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Manaco/ })).toBeVisible();
  await page.getByRole('button', { name: /Manaco/ }).click();

  const name = page.getByLabel('Nombre visible');
  const originalName = await name.inputValue();
  const logo = page.getByLabel(/Logo \(ruta local/);
  const originalLogo = await logo.inputValue();
  await page.getByRole('button', { name: 'Guardar identidad' }).click();
  await expect(page.getByRole('status')).toContainText('Identidad visual actualizada');
  expect(await name.inputValue()).toBe(originalName);
  expect(await logo.inputValue()).toBe(originalLogo);

  await page.getByRole('button', { name: 'Planes y suscripciones' }).click();
  await expect(page.getByRole('heading', { name: 'Planes disponibles' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Profesional' })).toBeVisible();
  await page.getByRole('link', { name: 'Administrar versiones de planes' }).click();
  await expect(page.getByRole('heading', { name: 'Planes y funcionalidades' })).toBeVisible();
  await page.getByRole('button', { name: 'Volver a la plataforma' }).click();
  await expect(page).toHaveURL(/\/saas$/);

  await page.getByRole('button', { name: 'Empresas', exact: true }).click();
  await page.getByRole('button', { name: /Manaco/ }).click();
  await page.getByRole('button', { name: 'Aplicar plan y vigencia' }).click();
  await expect(page.getByRole('status')).toContainText('Plan y vigencia actualizados');

  await page.getByLabel(/Motivo \(10–300/).fill('Prueba E2E de lectura auditada de la empresa');
  await page.getByRole('button', { name: 'Consultar resumen' }).click();
  await expect(page.getByRole('status')).toContainText('Resumen de solo lectura generado');
  await expect(page.getByText(/sucursales · .* usuarios/)).toBeVisible();

  await page.getByRole('button', { name: 'Auditoría', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Auditoría de plataforma' })).toBeVisible();
  await expect(page.locator('ul.audit')).toContainText('empresa_identidad_actualizada');
  await expect(page.locator('ul.audit')).toContainText('empresa_plan_cambiado');
  await expect(page.locator('ul.audit')).toContainText('soporte_acceso_empresa');
});

test('una sesión de administrador empresarial no obtiene acceso a endpoints SaaS', async ({ page }) => {
  const demo = credentials();
  const company = demo.empresas.find(item => item.codigo === 'manaco')!;
  await page.goto('/admin/login');
  await page.getByLabel('Código de empresa').fill(company.codigo);
  await page.getByLabel('Correo electrónico').fill(company.usuarios.admin.correo);
  await page.getByLabel('Contraseña').fill(company.usuarios.admin.contrasena);
  await page.getByRole('button', { name: /Acceder al panel/ }).click();
  await expect(page).toHaveURL('http://localhost:4200/admin');
  const meResponse = await page.request.get('/api/auth/me');
  expect(meResponse.status()).toBe(200);
  expect((await meResponse.json()).plataforma).toBe(false);

  const denied = await page.request.get('/api/saas/empresas');
  expect(denied.status()).toBe(403);
  await page.goto('/saas');
  await expect(page).toHaveURL(/\/saas\/login/);
});

test('CU05: administrador crea y consulta un empleado en su empresa desde la pantalla web', async ({ page }) => {
  const demo = credentials();
  const company = demo.empresas.find(item => item.codigo === 'manaco')!;
  const employeeEmail = `e2e-cu05-${Date.now()}@example.com`;
  const apiRoot = path.resolve(__dirname, '../../LiveClothesShop-api');
  const python = path.join(apiRoot, '.venv', 'Scripts', 'python.exe');
  const cleanup = path.join(apiRoot, 'scripts', 'cleanup_cu05_e2e.py');
  try {
    await page.goto('/admin/login');
    await page.getByLabel('Código de empresa').fill(company.codigo);
    await page.getByLabel('Correo electrónico').fill(company.usuarios.admin.correo);
    await page.getByLabel('Contraseña').fill(company.usuarios.admin.contrasena);
    await page.getByRole('button', { name: /Acceder al panel/ }).click();
    await expect(page).toHaveURL('http://localhost:4200/admin');

    await page.goto('/admin/empleados/nuevo');
    await expect(page.getByRole('heading', { name: 'Crear empleado' })).toBeVisible();
    await page.locator('#ci').fill(`E2E-${Date.now()}`);
    await page.getByLabel('Nombres').fill('Empleado E2E');
    await page.getByLabel('Apellido paterno').fill('Prueba');
    await page.getByLabel('Apellido materno').fill('CU05');
    await page.getByLabel('Sexo').selectOption('F');
    await page.getByLabel('Correo electrónico').fill(employeeEmail);
    await page.getByLabel('Teléfono').fill('70000001');
    await page.getByLabel('Dirección').fill('Sucursal de prueba');
    await page.getByLabel('Fecha de nacimiento').fill('1998-02-03');
    await page.getByLabel('Cargo').fill('Cajero E2E');
    await page.getByLabel('Rol existente').selectOption({ index: 1 });
    await page.getByLabel('Sucursal', { exact: true }).selectOption({ index: 1 });
    await page.getByLabel('Contraseña inicial').fill('Prueba-E2E-CU05-2026!');
    await page.locator('form button[type="submit"]').click({ force: true });

    await expect(page).toHaveURL(/\/admin\/usuarios\/.+/);
    await expect(page.getByText(employeeEmail)).toBeVisible();
    await expect(page.getByText('Cajero E2E')).toBeVisible();
    await page.goto('/admin/usuarios');
    await page.getByLabel('Nombre, apellidos, correo o CI').fill(employeeEmail);
    await page.getByRole('button', { name: 'Aplicar filtros' }).click();
    const row = page.getByRole('row').filter({ hasText: employeeEmail });
    await expect(row).toBeVisible();
    await expect(row).toContainText('Empleado E2E');
  } finally {
    execFileSync(python, [cleanup, '--empresa', company.codigo, '--correo', employeeEmail], {
      cwd: apiRoot, stdio: 'ignore',
    });
  }
});

test('CU06: administrador gestiona rol y asigna funciones desde la interfaz web', async ({ page }) => {
  const demo = credentials();
  const company = demo.empresas.find(item => item.codigo === 'manaco')!;
  const roleId = `E2E6-${String(Date.now()).slice(-10)}`;
  const apiRoot = path.resolve(__dirname, '../../LiveClothesShop-api');
  const python = path.join(apiRoot, '.venv', 'Scripts', 'python.exe');
  const cleanup = path.join(apiRoot, 'scripts', 'cleanup_cu06_e2e.py');
  try {
    await page.goto('/admin/login');
    await page.getByLabel('Código de empresa').fill(company.codigo);
    await page.getByLabel('Correo electrónico').fill(company.usuarios.admin.correo);
    await page.getByLabel('Contraseña').fill(company.usuarios.admin.contrasena);
    await page.getByRole('button', { name: /Acceder al panel/ }).click();
    await expect(page).toHaveURL('http://localhost:4200/admin');

    await page.goto('/admin/roles/nuevo');
    await expect(page.getByRole('heading', { name: 'Crear rol' })).toBeVisible();
    await page.locator('#rol-nro').fill(roleId);
    await page.locator('#rol-descripcion').fill('Rol E2E CU06');
    await page.getByRole('button', { name: 'Guardar rol' }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/roles/${roleId}$`));

    const permission = page.getByLabel(/CU05/);
    await expect(permission).toBeVisible();
    await permission.check();
    const savePermissions = page.waitForResponse(response =>
      response.url().includes(`/api/admin/roles/${roleId}/permisos`) && response.request().method() === 'PUT');
    await page.getByRole('button', { name: 'Guardar permisos' }).click({ force: true });
    expect((await savePermissions).status()).toBe(200);
    await expect(page.getByText('Permisos guardados correctamente.')).toBeVisible();

    await page.goto(`/admin/roles/${roleId}/editar`);
    await page.locator('#rol-descripcion').fill('Rol E2E CU06 editado');
    await page.getByRole('button', { name: 'Guardar rol' }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/roles/${roleId}$`));
    await expect(page.getByText('Rol E2E CU06 editado')).toBeVisible();
    await expect(page.getByLabel(/CU05/)).toBeChecked();
  } finally {
    execFileSync(python, [cleanup, '--empresa', company.codigo, '--rol', roleId], {
      cwd: apiRoot, stdio: 'ignore',
    });
  }
});

test('CU07: administrador registra, consulta y desactiva un cliente desde la interfaz web', async ({ page }) => {
  const demo = credentials();
  const company = demo.empresas.find(item => item.codigo === 'manaco')!;
  const email = `e2e-cu07-${Date.now()}@example.com`;
  cu07Clients.push({ empresa: company.codigo, correo: email });

  await page.goto('/admin/login');
  await page.getByLabel('Código de empresa').fill(company.codigo);
  await page.getByLabel('Correo electrónico').fill(company.usuarios.admin.correo);
  await page.getByLabel('Contraseña').fill(company.usuarios.admin.contrasena);
  await page.getByRole('button', { name: /Acceder al panel/ }).click();
  await expect(page).toHaveURL('http://localhost:4200/admin');
  await page.goto('/admin/clientes');
  await expect(page.getByRole('heading', { name: 'Gestionar clientes' })).toBeVisible();

  await page.getByRole('button', { name: 'Registrar cliente' }).click();
  await page.locator('#nc-ci').fill(`E2E-${Date.now()}`);
  await page.locator('#nc-nombres').fill('Cliente E2E');
  await page.locator('#nc-pat').fill('Prueba');
  await page.locator('#nc-mat').fill('CU07');
  await page.locator('#nc-correo').fill(email);
  await page.locator('#nc-telefono').fill('70000002');
  await page.locator('#nc-direccion').fill('Dirección E2E');
  await page.locator('#nc-nac').fill('2000-01-01');
  await page.locator('#nc-pass').fill('Prueba-E2E-CU07-2026!');
  const created = page.waitForResponse(response =>
    response.url().includes('/api/admin/clientes') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Crear cliente' }).click();
  expect((await created).status()).toBe(201);
  await expect(page.getByRole('status')).toContainText('Cliente registrado');
  const identity = await page.request.get('/api/auth/me');
  expect(identity.status()).toBe(200);
  expect((await identity.json()).empresa).toBe(company.codigo);

  await page.getByLabel('Nombre, apellidos, correo o CI').fill(email);
  await page.getByRole('button', { name: 'Aplicar filtros' }).click();
  const row = page.getByRole('row').filter({ hasText: email });
  await expect(row).toBeVisible();
  await expect(row).toContainText('Cliente E2E');
  await row.getByRole('button', { name: 'Desactivar' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Cliente desactivado' })).toBeVisible();
  await expect(row).toContainText('Inactivo (sin acceso)');
});

test('CU23: administrador registra, inspecciona y rechaza una devolución con PostgreSQL real', async ({ page }) => {
  const demo = credentials();
  const company = demo.empresas.find(item => item.codigo === 'manaco')!;
  const fixture = prepareCU23();

  await page.goto('/admin/login');
  await page.getByLabel('Código de empresa').fill(company.codigo);
  await page.getByLabel('Correo electrónico').fill(company.usuarios.admin.correo);
  await page.getByLabel('Contraseña').fill(company.usuarios.admin.contrasena);
  await page.getByRole('button', { name: /Acceder al panel/ }).click();
  await expect(page).toHaveURL('http://localhost:4200/admin');
  await page.goto('/admin/devoluciones');

  await page.getByLabel('Número de venta del comprobante').fill(String(fixture.sale));
  const saleResponse = page.waitForResponse(response =>
    response.url().endsWith(`/api/admin/devoluciones/ventas/${fixture.sale}`));
  await page.getByRole('button', { name: 'Buscar venta' }).click();
  expect((await saleResponse).status()).toBe(200);
  await expect(page.getByRole('heading', { name: `Venta #${fixture.sale}` })).toBeVisible();
  await page.locator('#devolucion-cantidad-1').fill('1');
  await page.getByLabel('Motivo de devolución').fill('Verificación E2E CU23');
  const created = page.waitForResponse(response =>
    response.url().endsWith('/api/admin/devoluciones') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Registrar solicitud' }).click();
  expect((await created).status()).toBe(201);

  const row = page.getByRole('row').filter({ hasText: `Venta #${fixture.sale}` });
  await expect(row).toContainText('pendiente');
  await row.getByRole('combobox').selectOption('apta');
  const inspected = page.waitForResponse(response =>
    response.url().includes('/api/admin/devoluciones/') && response.url().endsWith('/decision'));
  await row.getByRole('button', { name: 'Guardar inspección' }).click();
  expect((await inspected).status()).toBe(200);
  const rejected = page.waitForResponse(response =>
    response.url().includes('/api/admin/devoluciones/') && response.url().endsWith('/decision'));
  await row.getByRole('button', { name: 'Rechazar' }).click();
  expect((await rejected).status()).toBe(200);
  await expect(row).toContainText('cancelada');
  expect(verifyCU23()).toEqual({ returnState: 'rechazada', inventory: [0, 0] });
});

test('CU24: venta de contado pendiente sobrevive a recarga, concilia una vez y rechaza stock insuficiente', async ({ page, context }) => {
  test.setTimeout(120_000);
  const demo = credentials();
  const cashier = demo.empresas.find(item => item.codigo === 'manaco')!.usuarios.cajero;
  const apiRoot = path.resolve(__dirname, '../../LiveClothesShop-api');
  const python = path.join(apiRoot, '.venv', 'Scripts', 'python.exe');
  const verifier = path.join(apiRoot, 'scripts', 'verify_offline_sale_e2e.py');
  const runVerifier = (...args: string[]) => JSON.parse(execFileSync(python, [verifier, ...args], {
    cwd: apiRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  })) as Record<string, unknown>;
  const fixture = runVerifier('fixture') as {
    branch: number; product_id: string; description: string; variant: string; price: string; stock: number;
  };

  await page.goto('/admin/login');
  await page.getByLabel('Código de empresa').fill('manaco');
  await page.getByLabel('Correo electrónico').fill(cashier.correo);
  await page.getByLabel('Contraseña').fill(cashier.contrasena);
  await page.getByRole('button', { name: /Acceder al panel/ }).click();
  await expect(page).toHaveURL('http://localhost:4200/admin');
  await page.goto('/admin/caja');
  await expect(page.getByRole('heading', { name: 'Punto de venta' })).toBeVisible();
  await page.waitForFunction(() => !!navigator.serviceWorker?.controller);
  // Prime the app shell and route chunks while online; the next reload is truly offline.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Punto de venta' })).toBeVisible();

  const selectProduct = async () => {
    await page.getByRole('button', { name: /Continuar sin registro/ }).click();
    await page.getByRole('button', { name: /Añadir prenda/ }).click();
    const search = page.getByRole('textbox', { name: 'Buscar prendas' });
    await search.fill(fixture.description);
    await page.getByRole('button', { name: 'Buscar', exact: true }).click();
    const productCard = page.locator('button.product-card').filter({ hasText: fixture.description }).first();
    await expect(productCard).toBeVisible();
    await productCard.click();
    const detail = await page.request.get(`/api/admin/caja/productos/${fixture.product_id}`);
    expect(detail.status()).toBe(200);
    const item = await detail.json() as { variantes: Array<{ idVariante: string; sku: string }> };
    const variant = item.variantes.find(row => row.idVariante === fixture.variant);
    expect(variant).toBeTruthy();
    await page.locator('button.product-card').filter({ hasText: variant!.sku }).click();
  };

  await selectProduct();
  await page.getByLabel('Efectivo recibido').fill(String(Number(fixture.price) * 100));
  // This is a normal single-unit sale; use the default quantity and sufficient cash.
  await page.locator('#caja-cantidad-0').fill('1');
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Guardar venta de contado pendiente' }).click();
  const queuedStatus = page.getByRole('status').filter({ hasText: 'Operación' });
  await expect(queuedStatus).toContainText('guardada');
  const firstUuid = (await queuedStatus.innerText()).match(/[0-9a-f]{8}-[0-9a-f-]{27}/i)?.[0];
  expect(firstUuid).toBeTruthy();
  offlineOperationIds.add(firstUuid!);
  const queuedBeforeReload = await page.evaluate(async (id) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('fashionstore-offline-v1');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return await new Promise<unknown>((resolve, reject) => {
      const request = db.transaction('operations').objectStore('operations').get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }, firstUuid!);
  expect(queuedBeforeReload).toBeTruthy();
  const beforeSync = runVerifier('snapshot', '--uuid', firstUuid!, '--variant', fixture.variant,
    '--branch', String(fixture.branch), '--stock-before', String(fixture.stock)) as Record<string, unknown>;
  expect(beforeSync.sync_state).toBeNull();
  expect(beforeSync.stock).toBe(fixture.stock);
  expect(beforeSync.sales).toBe(0);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Punto de venta' })).toBeVisible();
  await expect(page.locator('#offline-sales-title')).toBeVisible();
  await expect(page.locator('li').filter({ hasText: firstUuid! })).toContainText('pendiente');
  await context.setOffline(false);
  await expect(page.locator('li').filter({ hasText: firstUuid! })).toContainText('sincronizada', { timeout: 20_000 });

  const accepted = runVerifier('snapshot', '--uuid', firstUuid!, '--variant', fixture.variant,
    '--branch', String(fixture.branch), '--stock-before', String(fixture.stock)) as Record<string, unknown>;
  expect(accepted.sync_state).toBe('confirmada');
  expect(accepted.sales).toBe(1);
  expect(accepted.details).toBe(1);
  expect(accepted.approved_cash).toBe(1);
  expect(accepted.stock_movements).toBe(1);
  expect(accepted.audit).toBe(1);
  expect(accepted.stock).toBe(fixture.stock - 1);

  const persistedOperation = queuedBeforeReload as {
    id: string; tipo: string; version: number; fecha: string; sucursal: number;
    datos: Record<string, unknown>; dependeDe: string[];
  };
  const duplicateResponse = await page.evaluate(async operation => {
    const response = await fetch('/api/sync/lote', {
      method: 'POST', credentials: 'include', headers: {
        'content-type': 'application/json', 'X-CSRF-Protection': '1',
      },
      body: JSON.stringify({ dispositivo: 'fashionstore-pwa', origen: 'pwa', operaciones: [{
        id: operation.id, tipo: operation.tipo, version: operation.version,
        fecha: operation.fecha, sucursal: operation.sucursal,
        datos: operation.datos, dependeDe: operation.dependeDe,
      }] }),
    });
    return { status: response.status, body: await response.json() };
  }, persistedOperation);
  expect(duplicateResponse.status, JSON.stringify(duplicateResponse.body)).toBe(200);
  expect(duplicateResponse.body.resultados[0].idempotente).toBe(true);
  expect(duplicateResponse.body.resultados[0].nroVenta).toBe(accepted.sale_no);
  const afterReplay = runVerifier('snapshot', '--uuid', firstUuid!, '--variant', fixture.variant,
    '--branch', String(fixture.branch), '--stock-before', String(fixture.stock)) as Record<string, unknown>;
  expect(afterReplay.sales).toBe(1);
  expect(afterReplay.approved_cash).toBe(1);
  expect(afterReplay.stock_movements).toBe(1);
  expect(afterReplay.stock).toBe(fixture.stock - 1);

  // Submit a distinct offline-shaped operation that exceeds remaining stock;
  // this route is the same reconciliation endpoint used by the PWA queue.
  const conflictUuid = randomUUID();
  offlineOperationIds.add(conflictUuid);
  await page.evaluate(async ({ variant, price, branch, id }) => {
    const response = await fetch('/api/sync/lote', {
      method: 'POST', credentials: 'include', headers: {
        'content-type': 'application/json', 'X-CSRF-Protection': '1',
      },
      body: JSON.stringify({ dispositivo: 'fashionstore-pwa', origen: 'pwa', operaciones: [{
        id, tipo: 'venta', version: 1, fecha: new Date().toISOString(), sucursal: branch,
        datos: { lineas: [{ idVariante: variant, cantidad: 100, precio: Number(price) }], metodo: 'efectivo' },
        dependeDe: [],
      }] }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(payload));
    if (payload.resultados[0].codigo !== 'stock_insuficiente') throw new Error(JSON.stringify(payload));
    return id;
  }, { variant: fixture.variant, price: fixture.price, branch: fixture.branch, id: conflictUuid });
  const rejected = runVerifier('snapshot', '--uuid', conflictUuid, '--variant', fixture.variant,
    '--branch', String(fixture.branch), '--stock-before', String(fixture.stock - 1)) as Record<string, unknown>;
  expect(rejected.sync_state).toBe('conflicto');
  expect(rejected.sync_code).toBe('stock_insuficiente');
  expect(rejected.sales).toBe(0);
  expect(rejected.details).toBe(0);
  expect(rejected.approved_cash).toBe(0);
  expect(rejected.stock_movements).toBe(0);
  expect(rejected.stock).toBe(fixture.stock - 1);
});
