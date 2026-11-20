import { defaultThemeName, getTheme, registerTheme, removeTheme, themeExist, themes } from './builtin';
import type { ITheme } from './interface';
import { InstanceManager } from '../core/instance-manager';
import type { IVChart } from '../core/interface';

export class ThemeManager {
  /** 主题字典 */
  static readonly themes = themes;

  private static _currentThemeName: string = defaultThemeName; // 设置缺省为默认主题

  /**
   * 注册主题
   * @param name 主题名称
   * @param theme 主题配置
   * @returns
   */
  static registerTheme(name: string, theme: Partial<ITheme>) {
    registerTheme(name, theme);
  }

  /**
   * 获取主题
   * @param name 主题名称
   * @returns
   */
  static getTheme(name: string, transformed: boolean = false) {
    return getTheme(name);
  }

  /**
   * 移除主题
   * @param name 主题名称
   * @returns 是否移除成功
   */
  static removeTheme(name: string): boolean {
    return removeTheme(name);
  }

  /**
   * 判断主题是否存在
   * @param name 主题名称
   * @returns 是否存在
   */
  static themeExist(name: any) {
    return themeExist(name);
  }

  /** 获取图表默认主题（非用户配置） */
  static getDefaultTheme(): ITheme {
    return ThemeManager.themes.get(defaultThemeName);
  }

  /** 设置当前主题（所有实例生效） */
  static setCurrentTheme(name: string) {
    if (!ThemeManager.themeExist(name)) {
      return;
    }
    ThemeManager._currentThemeName = name;
    InstanceManager.forEach((instance: IVChart) => instance?.setCurrentTheme(name));
  }

  /** 获取当前主题（只能获取用户通过`setCurrentTheme`方法设置过的主题，默认值为默认主题） */
  static getCurrentTheme(transformed: boolean = false): ITheme {
    return ThemeManager.getTheme(ThemeManager._currentThemeName, transformed);
  }

  /** 获取当前主题名称（只能获取用户通过`setCurrentTheme`方法设置过的主题，默认值为默认主题） */
  static getCurrentThemeName(): string {
    return ThemeManager._currentThemeName;
  }
}
