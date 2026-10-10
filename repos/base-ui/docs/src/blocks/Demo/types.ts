export interface DemoFile {
  /**
   * Absolute path to the file.
   */
  path: string;
  /**
   * Base name of the file.
   */
  name: string;
  /**
   * Content of the file.
   */
  content: string;
  /**
   * Type of the file.
   */
  type: string;
}

export interface DemoVariant {
  /**
   * Variant identifier.
   */
  name: string;
  /**
   * Language of the entry point file.
   */
  language: 'ts' | 'js';
  /**
   * Runnable demo component.
   */
  component: React.ComponentType;
  /**
   * Files the demo consists of.
   */
  files: DemoFile[];
}
