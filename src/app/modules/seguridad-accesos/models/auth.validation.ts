import { AbstractControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';

export const notBlank: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
  typeof control.value === 'string' && control.value.trim().length === 0 ? { required: true } : null;

export const normalizedEmail: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = typeof control.value === 'string' ? control.value.trim() : '';
  return Validators.email({ value } as AbstractControl);
};

export const pastDate: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  if (!control.value) return null;
  const value = String(control.value);
  const date = new Date(`${value}T00:00:00`);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const [year, month, day] = value.split('-').map(Number);
  return !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime()) || date > today
    || date.getFullYear() !== year || date.getMonth() + 1 !== month || date.getDate() !== day
    ? { date: true } : null;
};
