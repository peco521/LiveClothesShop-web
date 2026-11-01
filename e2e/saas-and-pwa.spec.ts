import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

type DemoCredentials = {
  plataforma: { correo: string; contrasena: string };
  empresas: Array<{ codigo: string; usuarios: Record<string, { correo: string; contrasena: string }> }>;
};

function credentials(): DemoCredentials {
  const file = process.env.FASHIONSTORE_DEMO_CREDENTIALS
    || path.resolve(__dirname, '../../LiveClothesShop-api/.local/demo_credentials.json');
  return JSON.parse(readFileSync(file, 'utf8')) as DemoCredentials;
}

test('Chrome registra el Service Worker PWA en localhost y recorre SaaS con API/PostgreSQL reales', async ({ page }) => {
  const demo = credentials();
  await page.goto('/saas/login');
  await expect(page.getByRole('heading', { name: 'Administración de plataforma' })).toBeVisible();
  await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistration('/'))?.active?.state === 'activated');
  const sw = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration('/');
    return { scope: registration?.scope, script: registration?.active?.scriptURL };
  });
  expect(sw.scope).toContain('/');
  expect(sw.script).toContain('/fashionstore-sw.js');

  await page.getByLabel('Correo').fill(demo.plataforma.correo);
  await page.getByLabel('Contraseña').fill(demo.plataforma.contrasena);
  await page.getByRole('button', { name: 'Iniciar sesión SaaS' }).click();
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
  expect(denied.status()).toBe(401);
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

test('CU24: venta de contado pendiente sobrevive a recarga, concilia una vez y rechaza stock insuficiente', async ({ page, context }) => {
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
  const conflictUuid = await page.evaluate(async ({ variant, price, branch }) => {
    const id = crypto.randomUUID();
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
  }, { variant: fixture.variant, price: fixture.price, branch: fixture.branch });
  const rejected = runVerifier('snapshot', '--uuid', conflictUuid!, '--variant', fixture.variant,
    '--branch', String(fixture.branch), '--stock-before', String(fixture.stock - 1)) as Record<string, unknown>;
  expect(rejected.sync_state).toBe('conflicto');
  expect(rejected.sync_code).toBe('stock_insuficiente');
  expect(rejected.sales).toBe(0);
  expect(rejected.details).toBe(0);
  expect(rejected.approved_cash).toBe(0);
  expect(rejected.stock_movements).toBe(0);
  expect(rejected.stock).toBe(fixture.stock - 1);
});
