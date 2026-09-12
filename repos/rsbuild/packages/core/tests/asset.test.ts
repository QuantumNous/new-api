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
    const rules = matchRules(config, 'a.png');
    expect(rules).toMatchSnapshot();
    expect(matchRules(config, 'a.jxl')).toEqual(rules);
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

  test('should add media rules correctly', async () => {
    const rsbuild = await createRsbuild();

    const config = (await rsbuild.initConfigs())[0];
    const rules = matchRules(config, 'a.mp4');
    expect(rules).toMatchSnapshot();
    expect(matchRules(config, 'a.vtt')).toEqual(rules);
  });

  test('should add other asset rules correctly', async () => {
    const rsbuild = await createRsbuild();

    const config = (await rsbuild.initConfigs())[0];
    const rules = matchRules(config, 'a.webmanifest');
    expect(rules).toMatchSnapshot();
    expect(matchRules(config, 'a.pdf')).toEqual(rules);
    expect(matchRules(config, 'a.txt')).toEqual(rules);
  });
});
