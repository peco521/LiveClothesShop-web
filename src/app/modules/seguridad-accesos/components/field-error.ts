import { Component, input } from '@angular/core';
import { AbstractControl } from '@angular/forms';

@Component({
  selector: 'app-field-error',
  template: `
    @if (control().touched && control().invalid) {
      <small class="field-error" [id]="errorId()">
        @if (control().hasError('required')) { Este campo es obligatorio. }
        @else if (control().hasError('email')) { Introduce un correo válido. }
        @else if (control().hasError('minlength')) { Usa al menos {{ control().getError('minlength').requiredLength }} caracteres. }
        @else if (control().hasError('maxlength')) { Has superado la longitud permitida. }
        @else if (control().hasError('date')) { Introduce una fecha válida que no sea futura. }
        @else { Revisa este dato. }
      </small>
    }
  `,
})
export class FieldError {
  readonly control = input.required<AbstractControl>();
  readonly errorId = input.required<string>();
}
