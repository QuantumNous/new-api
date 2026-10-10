import type { IActorConfig } from '../interface';

export interface IDomActorConfig extends IActorConfig {
  defaultStyle?: Partial<CSSStyleDeclaration>;
  domId?: string;
}

export interface IDomImgActorConfig extends IDomActorConfig {
  src?: string;
}

export interface IDomVideoActorConfig extends IDomActorConfig {
  src?: string;
  autoplay?: boolean;
  controls?: boolean;
  muted?: boolean;
}
