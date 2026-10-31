import { fromFileUrl, dirname, join } from 'Path';

const folder = dirname(fromFileUrl(import.meta.url));

const root = join(folder, '..', '..'),
  source = join(root, 'docs');

const sponsors = join(source, 'Sponsors.yaml'),
  template = join(source, 'Template.md'),
  helpers = join(source, 'Helpers.yaml'),
  readme = join(root, 'README.md');

export default { template, helpers, sponsors, readme };
