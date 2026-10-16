// @ts-nocheck
import { IdGenerator } from 'ai';
import { type IdGenerator as GeneratorType, someFunction, otherFunction } from 'ai';

// Variable declarations with type annotations
const generator1: IdGenerator = createGenerator();
let generator2: IdGenerator;
var generator3: IdGenerator = null;

// Function declarations with IDGenerator parameters
function processGenerator(gen: IdGenerator): void {
  console.log(gen);
}

// Arrow functions with IDGenerator parameters
const handleGenerator = (gen: IdGenerator): IdGenerator => {
  return gen;
};

// Function return types
function createCustomGenerator(): IdGenerator {
  return {} as IdGenerator;
}

// Type aliases and interfaces
type MyGenerator = IdGenerator;
interface GeneratorConfig {
  generator: IdGenerator;
}

// Class properties
class GeneratorService {
  private generator: IdGenerator;
  
  constructor(gen: IdGenerator) {
    this.generator = gen;
  }
  
  getGenerator(): IdGenerator {
    return this.generator;
  }
}

// Generic types
type GeneratorArray = Array<IdGenerator>;
type GeneratorMap = Map<string, IdGenerator>;

// Object type annotations
const config: {
  primary: IdGenerator;
  secondary?: IdGenerator;
} = {
  primary: generator1,
  secondary: generator2
};

// Should NOT be transformed - different package
import { IDGenerator as OtherGenerator } from 'other-package';
const otherGen: OtherGenerator = null;