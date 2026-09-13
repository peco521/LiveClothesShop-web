import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

// Local rendering only. Does not start FastAPI or connect to a database.
const probe = createServer();
await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
const child = spawn(process.execPath, ['dist/LiveClothesShop-web/server/server.mjs'], {
  env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'ignore', 'pipe'],
});
let diagnostics = '';
child.stderr.on('data', data => { diagnostics += String(data); });
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (child.exitCode !== null) throw new Error(`SSR terminó prematuramente: ${diagnostics}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/login`);
      if (response.ok) { ready = true; break; }
    } catch { /* Wait for the local server to bind. */ }
    await delay(250);
  }
  assert.ok(ready, 'El servidor SSR no inició');
  for (const [path, title] of [
    ['/login', 'Qué bueno verte de nuevo'],
    ['/registro', 'Crea tu cuenta'],
    ['/acceso', 'Tu espacio LiveClothesShop'],
  ]) {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      headers: { Cookie: 'liveclothes_session=synthetic-ssr-marker' },
    });
    assert.equal(response.status, 200, path);
    const html = await response.text();
    const heading = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1];
    assert.equal(heading, title, `SSR debe renderizar el h1 de ${path}`);
    assert.ok(!html.includes('synthetic-ssr-marker'), 'No serializar cookies');
    if (path === '/acceso') {
      assert.ok(html.includes('Verificando tu sesión'));
      assert.ok(!html.includes('Has iniciado sesión correctamente'));
    }
    console.log(`${path}: HTTP 200, SSR verificado, sin datos privados`);
  }
  for (const path of ['/admin/usuarios', '/admin/empleados/nuevo', '/admin/empleados/synthetic-user/editar', '/admin/usuarios/synthetic-user',
    '/admin/roles', '/admin/roles/nuevo', '/admin/roles/synthetic-role/editar', '/admin/roles/synthetic-role',
    '/admin/clientes', '/admin/clientes/synthetic-client', '/admin/clientes/synthetic-client/editar',
    '/admin/bitacora', '/admin/bitacora/9007199254740993',
    '/admin/ciudades', '/admin/ciudades/nuevo', '/admin/ciudades/0', '/admin/ciudades/-32768/editar',
    '/admin/sucursales', '/admin/sucursales/nuevo', '/admin/sucursales/0', '/admin/sucursales/1/editar']) {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      headers: { Cookie: 'liveclothes_session=synthetic-cu05-marker' },
    });
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.ok(!html.includes('synthetic-cu05-marker'), 'No serializar cookies CU05');
    assert.ok(!/<h1\b/i.test(html), 'Administración debe entregar shell cliente, sin render privado SSR');
    assert.ok(!html.includes('app-empleado-formulario'), 'No renderizar formulario privado en servidor');
    assert.ok(!html.includes('app-rol-formulario') && !html.includes('app-permisos-selector'), 'No renderizar CU06 privado en servidor');
    assert.ok(!html.includes('app-cliente-formulario'), 'No renderizar CU07 privado en servidor');
    assert.ok(!html.includes('app-bitacora-filtros') && !html.includes('app-bitacora-datos'), 'No renderizar CU08 privado en servidor');
    assert.ok(!html.includes('app-organizacion-formulario'), 'No renderizar CU09 privado en servidor');
    console.log(`${path}: HTTP 200, shell cliente sin datos privados`);
  }
  assert.ok(!diagnostics.includes('Falling back to client side rendering'), diagnostics);
  if (diagnostics.trim()) console.log(diagnostics.trim());
} finally {
  child.kill();
}
