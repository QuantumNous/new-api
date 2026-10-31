import type { FieldElement } from '../types';

export default (element: FieldElement): element is HTMLInputElement =>
  element.type === 'file';
