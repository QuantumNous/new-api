const ns1 = {
  title: 'Welcome!',
  description: {
    part1: 'This is just a basic example of how to use i18next with typescript',
    part2: '😉',
  },
  inter: 'interpolated {{val}}',
  interUnescaped: 'interpolated and unescaped {{- val}}',
  some: 'ctx',
  some_me: 'ctx2',
  some_1234: 'ctx3',
  pl_one: 'sing',
  pl_other: '{{count}} plur',
  lastChanged: 'Last changed {{- date}}',
} as const;

export default ns1;
