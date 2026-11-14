const say = (...args: string[]): void => {
  console.log('args', ...args);
};

say('hello', 'world');
