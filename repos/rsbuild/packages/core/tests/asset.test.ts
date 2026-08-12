import { matchRules } from '@scripts/test-helper';
import { createRsbuild } from '../src';
import { FONT_EXTENSIONS } from '../src/constants';
import { getRegExpForExts } from '../src/plugins/asset';

describe('getRegExpForExts', () => {
  it('should return the correct RegExp for extensions', () => {
    expect(getRegExpForExts(['woff'])).toEqual(/\.woff$/i);

    expect(getRegExpForExts(FONT_EXTENSIONS)).toEqual(/\.(?:woff|woff2|eot|ttf|otf|ttc)$/i);
  });
});

describe('plugin-asset', () => {
  test('should add image rules correctly', async () => {
    const rsbuild = await createRsbuild();

    const config = (await rsbuild.initConfigs())[0];
    expect(matchRules(config, 'a.png')).toMatchSnapshot();
  });

  test('should allow using distPath.image to modify dist path', async () => {
    const rsbuild = await createRsbuild({
      config: {
        output: {
          distPath: {
            image: 'foo',
          },
        },
      },
    });

    const config = (await rsbuild.initConfigs())[0];
    expect(matchRules(config, 'a.png')).toMatchSnapshot();
  });

  test('should add image rules correctly', async () => {
    const rsbuild = await createRsbuild({
      config: {
        output: {
          distPath: {
            image: '',
          },
        },
      },
    });

    const config = (await rsbuild.initConfigs())[0];
    expect(matchRules(config, 'a.png')).toMatchSnapshot();
  });

  test('should allow using filename.image to modify filename', async () => {
    const rsbuild = await createRsbuild({
      config: {
        output: {
          filename: {
            image: 'foo[ext]',
          },
        },
      },
    });

    const config = (await rsbuild.initConfigs())[0];
    expect(matchRules(config, 'a.png')).toMatchSnapshot();
  });
});
