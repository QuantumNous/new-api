import type { RsbuildPlugin } from '../src';
import { sortPluginsByDependencies } from '../src/pluginManager';

describe('sort plugins by dependency order', () => {
  it('should sort plugins with dependencies correctly', () => {
    const cases = [
      { name: '1' },
      { name: '2', pre: [], post: [] },
      { name: '3', pre: ['1'], post: ['2'] },
      { name: '4', pre: [], post: [] },
      { name: '5', pre: ['6'], post: ['3'] },
      { name: '6', pre: [], post: [] },
    ] as RsbuildPlugin[];

    const result = sortPluginsByDependencies(
      cases.map((c) => ({
        instance: c,
        environment: '',
      })),
    );
    expect(result).toEqual(
      [
        {
          name: '1',
        },
        {
          name: '4',
          post: [],
          pre: [],
        },
        {
          name: '6',
          post: [],
          pre: [],
        },
        {
          name: '5',
          post: ['3'],
          pre: ['6'],
        },
        {
          name: '3',
          post: ['2'],
          pre: ['1'],
        },
        {
          name: '2',
          post: [],
          pre: [],
        },
      ].map((p) => ({
        environment: '',
        instance: p,
      })),
    );
  });

  it('should keep the order consistent', () => {
    const cases = [
      { name: '1' },
      { name: '2', pre: ['3'] },
      { name: '3' },
      { name: '4' },
    ] as RsbuildPlugin[];

    const result = sortPluginsByDependencies(
      cases.map((c) => ({
        instance: c,
        environment: '',
      })),
    );
    expect(result).toEqual(
      [{ name: '1' }, { name: '3' }, { name: '2', pre: ['3'] }, { name: '4' }].map((p) => ({
        environment: '',
        instance: p,
      })),
    );
  });

  it('should allow some invalid plugins', () => {
    const cases = [
      { name: '1' },
      { name: '2', pre: [undefined], post: [] },
      { name: '3', pre: ['1'], post: ['2', undefined] },
      { name: undefined },
    ] as RsbuildPlugin[];

    const result = sortPluginsByDependencies(
      cases.map((c) => ({
        instance: c,
        environment: '',
      })),
    );
    expect(result).toEqual(
      [
        {
          name: '1',
        },
        {
          name: '3',
          post: ['2', undefined],
          pre: ['1'],
        },
        {
          name: '2',
          post: [],
          pre: [undefined],
        },
        {
          name: undefined,
        },
      ].map((p) => ({
        environment: '',
        instance: p,
      })),
    );
  });

  it('should throw an error when plugins have a dependency cycle', () => {
    const cases = [
      { name: '1', pre: [], post: [] },
      { name: '2', pre: [], post: ['5'] },
      { name: '3', pre: ['1'], post: ['2'] },
      { name: '4', pre: [], post: [] },
      { name: '5', pre: ['6'], post: ['3'] },
      { name: '6', pre: [], post: [] },
    ] as RsbuildPlugin[];

    expect(() => {
      sortPluginsByDependencies(
        cases.map((c) => ({
          instance: c,
          environment: '',
        })),
      );
    }).toThrow(/Plugins dependencies has loop: 2,3,5/);
  });

  it('should handle multiple plugins with same name in different environments', () => {
    const cases = [
      {
        instance: { name: 'plugin-b', pre: ['plugin-a'] },
        environment: 'web',
      },
      {
        instance: { name: 'plugin-c', pre: ['plugin-a'] },
        environment: 'node',
      },
      {
        instance: { name: 'plugin-a' },
        environment: 'web',
      },
      {
        instance: { name: 'plugin-a' },
        environment: 'node',
      },
    ];

    const result = sortPluginsByDependencies(cases as any[]);

    expect(result).toEqual([
      {
        instance: { name: 'plugin-a' },
        environment: 'web',
      },
      {
        instance: { name: 'plugin-a' },
        environment: 'node',
      },
      {
        instance: { name: 'plugin-b', pre: ['plugin-a'] },
        environment: 'web',
      },
      {
        instance: { name: 'plugin-c', pre: ['plugin-a'] },
        environment: 'node',
      },
    ]);
  });
});
