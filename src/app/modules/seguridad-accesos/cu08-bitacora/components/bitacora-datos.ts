import { Component, input } from '@angular/core';
import { BitacoraDetalle } from '../models/bitacora.models';

@Component({ selector: 'app-bitacora-datos', template: `<dl>
  <dt>ID del evento</dt><dd>{{ registro().id }}</dd>
  <dt>Fecha (UTC)</dt><dd><time [attr.datetime]="registro().fecha">{{ registro().fecha }}</time></dd>
  <dt>Acción</dt><dd>{{ registro().accion ?? 'Acción no reconocida' }}</dd>
  <dt>ID del actor</dt><dd>{{ registro().usuario_id ?? 'Sin identificación registrada' }}</dd>
  <dt>IP</dt><dd>{{ registro().ip ?? 'Sin dirección válida registrada' }}</dd>
  <dt>Resultado</dt><dd>{{ registro().detalles?.resultado ?? 'Sin resultado disponible' }}</dd>
  </dl><p>Solo se muestra el resultado validado. Otros detalles se omiten por privacidad.</p>`,
  styles: `dl { display: grid; grid-template-columns: minmax(100px, 1fr) 2fr; gap: 12px; } dt { font-weight: 600; } dd { margin: 0; overflow-wrap: anywhere; }`,
})
export class BitacoraDatos { readonly registro = input.required<BitacoraDetalle>(); }
