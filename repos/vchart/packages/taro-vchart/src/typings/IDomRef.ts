export interface IDomRef {
  id: string;
  width: number;
  height: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
  x: number;
  y: number;

  requestAnimationFrame?: any;
  cancelAnimationFrame?: any;
  getBoundingClientRect?: () => { height: number; width: number };
}
