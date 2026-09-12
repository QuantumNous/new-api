export async function calculateWorkflow(a: number, b: number) {
  'use workflow';

  const sum = await add(a, b);
  const product = await multiply(a, b);
  const combined = await add(sum, product);

  return { sum, product, combined };
}

async function add(a: number, b: number): Promise<number> {
  'use step';
  return a + b;
}

async function multiply(a: number, b: number): Promise<number> {
  'use step';
  return a * b;
}
