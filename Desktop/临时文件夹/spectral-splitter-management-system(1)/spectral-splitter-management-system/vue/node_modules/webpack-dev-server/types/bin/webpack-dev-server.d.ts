#!/usr/bin/env node
export type CliOption = {
  /**
   * display name
   */
  name: string;
  /**
   * npm package name
   */
  package: string;
  /**
   * name of the executable file
   */
  binName: string;
  /**
   * currently installed?
   */
  installed: boolean;
  /**
   * homepage
   */
  url: string;
  /**
   * preprocessor
   */
  preprocess: Function;
};
