import { normalizeShortcutInput } from '../src/server/cliShortcuts';

test('should normalize shortcut input', () => {
  expect(normalizeShortcutInput('h')).toBe('h');
  expect(normalizeShortcutInput(' H ')).toBe('h');
  expect(normalizeShortcutInput('\to\t')).toBe('o');
  expect(normalizeShortcutInput('  Q')).toBe('q');
});
