// @ts-nocheck
import { IDGenerator } from 'ai';
import { type IDGenerator as GeneratorType, someFunction, otherFunction } from 'ai';

// Variable declarations with type annotations
const generator1: IDGenerator = createGenerator();
let generator2: IDGenerator;
var generator3: IDGenerator = null;

// Function declarations with IDGenerator parameters
function processGenerator(gen: IDGenerator): void {
  console.log(gen);
}

// Arrow functions with IDGenerator parameters
const handleGenerator = (gen: IDGenerator): IDGenerator => {
  return gen;
};

// Function return types
function createCustomGenerator(): IDGenerator {
  return {} as IDGenerator;
}

// Type aliases and interfaces
type MyGenerator = IDGenerator;
interface GeneratorConfig {
  generator: IDGenerator;
}

// Class properties
class GeneratorService {
  private generator: IDGenerator;
  
  constructor(gen: IDGenerator) {
    this.generator = gen;
  }
  
  getGenerator(): IDGenerator {
    return this.generator;
  }
}

// Generic types
type GeneratorArray = Array<IDGenerator>;
type GeneratorMap = Map<string, IDGenerator>;

// Object type annotations
const config: {
  primary: IDGenerator;
  secondary?: IDGenerator;
} = {
  primary: generator1,
  secondary: generator2
};

// Should NOT be transformed - different package
import { IDGenerator as OtherGenerator } from 'other-package';
const otherGen: OtherGenerator = null;