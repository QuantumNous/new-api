import type { StateValue } from '../compile/mark';
import type { IMarkGraphic } from '../mark/interface';
import type { IInteraction } from './interface/common';
import type { ITrigger } from './interface/trigger';
import { addGraphicState, removeGraphicState } from '../util/graphic-state';

export class Interaction implements IInteraction {
  private _stateGraphicsByTrigger: Map<ITrigger, IMarkGraphic[]> = new Map();

  private _disableTriggerEvent: boolean = false;

  setDisableActiveEffect(disable: boolean) {
    this._disableTriggerEvent = disable;
  }

  private _triggerMapByState: Map<StateValue, ITrigger[]> = new Map();
  addTrigger(trigger: ITrigger) {
    if (trigger) {
      const startState = trigger.getStartState();
      const resetState = trigger.getResetState();

      [startState, resetState].forEach(state => {
        if (state) {
          const stateTrigger = this._triggerMapByState.get(state);

          if (stateTrigger) {
            !stateTrigger.includes(trigger) && stateTrigger.push(trigger);
          } else {
            this._triggerMapByState.set(state, [trigger]);
          }
        }
      });
    }
  }

  setStatedGraphics(trigger: ITrigger, graphics: IMarkGraphic[]) {
    this._stateGraphicsByTrigger.set(trigger, graphics);
  }

  getStatedGraphics(trigger: ITrigger) {
    return this._stateGraphicsByTrigger.get(trigger);
  }

  updateStates(
    trigger: ITrigger,
    newStatedGraphics: IMarkGraphic[],
    prevStatedGraphics?: IMarkGraphic[],
    state?: string,
    reverseState?: string
  ) {
    if (this._disableTriggerEvent) {
      return [];
    }

    if (!newStatedGraphics || !newStatedGraphics.length) {
      return [];
    }
    if (state && reverseState) {
      if (prevStatedGraphics && prevStatedGraphics.length) {
        // toggle
        this.toggleReverseStateOfGraphics(trigger, newStatedGraphics, prevStatedGraphics, reverseState);
        this.toggleStateOfGraphics(trigger, newStatedGraphics, prevStatedGraphics, state);
      } else {
        // update all the elements
        this.addBothStateOfGraphics(trigger, newStatedGraphics, state, reverseState);
      }
    } else if (state) {
      if (prevStatedGraphics && prevStatedGraphics.length) {
        this.toggleStateOfGraphics(trigger, newStatedGraphics, prevStatedGraphics, state);
      } else {
        this.addStateOfGraphics(trigger, newStatedGraphics, state);
      }
    }

    return newStatedGraphics;
  }

  protected toggleReverseStateOfGraphics(
    trigger: ITrigger,
    newStatedGraphics: IMarkGraphic[],
    prevStatedGraphics: IMarkGraphic[],
    reverseState: string
  ) {
    const markIdByState = trigger.getMarkIdByState();

    prevStatedGraphics.forEach(g => {
      const hasReverse =
        reverseState && markIdByState[reverseState] && markIdByState[reverseState].includes(g.context.markId);

      if (hasReverse) {
        const m = g.parent?.mark;
        const hasAnimation = (m as any).hasAnimationByState && (m as any).hasAnimationByState('state');
        addGraphicState(g, reverseState, true, hasAnimation);
      }
    });

    newStatedGraphics.forEach(g => {
      const hasReverse =
        reverseState && markIdByState[reverseState] && markIdByState[reverseState].includes(g.context.markId);

      if (hasReverse) {
        const m = g.parent?.mark;
        const hasAnimation = (m as any).hasAnimationByState && (m as any).hasAnimationByState('state');
        removeGraphicState(g, reverseState, hasAnimation);
      }
    });
  }

  protected toggleStateOfGraphics(
    trigger: ITrigger,
    newStatedGraphics: IMarkGraphic[],
    prevStatedGraphics: IMarkGraphic[],
    state: string
  ) {
    const markIdByState = trigger.getMarkIdByState();

    prevStatedGraphics.forEach(g => {
      const hasState = state && markIdByState[state] && markIdByState[state].includes(g.context.markId);

      if (hasState) {
        const m = g.parent?.mark;
        const hasAnimation = (m as any).hasAnimationByState && (m as any).hasAnimationByState('state');
        removeGraphicState(g, state, hasAnimation);
      }
    });

    newStatedGraphics.forEach(g => {
      const hasState = state && markIdByState[state] && markIdByState[state].includes(g.context.markId);
      if (hasState) {
        const m = g.parent?.mark;
        const hasAnimation = (m as any).hasAnimationByState && (m as any).hasAnimationByState('state');
        addGraphicState(g, state, true, hasAnimation);
      }
    });
  }

  protected addBothStateOfGraphics(
    trigger: ITrigger,
    statedGraphics: IMarkGraphic[],
    state: string,
    reverseState: string
  ) {
    const marks = trigger.getMarks();
    const markIdByState = trigger.getMarkIdByState();

    marks.forEach(m => {
      const hasReverse = reverseState && markIdByState[reverseState] && markIdByState[reverseState].includes(m.id);
      const hasState = state && markIdByState[state] && markIdByState[state].includes(m.id);

      if (!hasReverse && !hasState) {
        return;
      }

      const hasAnimation = (m as any).hasAnimationByState && (m as any).hasAnimationByState('state');
      m.getGraphics()?.forEach(g => {
        const isStated = statedGraphics && statedGraphics.includes(g);
        if (isStated) {
          if (hasState) {
            addGraphicState(g, state, true, hasAnimation);
          }
        } else {
          if (hasReverse) {
            addGraphicState(g, reverseState, true, hasAnimation);
          }
        }
      });
    });
  }

  protected addStateOfGraphics(trigger: ITrigger, statedGraphics: IMarkGraphic[], state: string) {
    const marks = trigger.getMarks();
    const markIdByState = trigger.getMarkIdByState();

    marks.forEach(mark => {
      const hasState = state && markIdByState[state] && markIdByState[state].includes(mark.id);

      if (!hasState) {
        return;
      }

      const hasAnimation = (mark as any).hasAnimationByState && (mark as any).hasAnimationByState('state');

      mark.getGraphics()?.forEach(g => {
        const isStated = statedGraphics && statedGraphics.includes(g);

        if (isStated) {
          if (hasState) {
            addGraphicState(g, state, true, hasAnimation);
          }
        }
      });
    });
  }

  clearAllStatesOfTrigger(trigger: ITrigger, state?: string, reverseState?: string) {
    if (this._disableTriggerEvent) {
      return;
    }

    const statedGraphics = this.getStatedGraphics(trigger);

    if (!statedGraphics || !statedGraphics.length) {
      return;
    }
    const marks = trigger.getMarks();
    const markIdByState = trigger.getMarkIdByState();

    marks.forEach(mark => {
      if (mark) {
        const graphics = mark.getGraphics();
        const hasAnimation = (mark as any).hasAnimationByState && (mark as any).hasAnimationByState('state');
        if (graphics && graphics.length) {
          if (reverseState && markIdByState[reverseState] && markIdByState[reverseState].includes(mark.id)) {
            graphics.forEach(g => {
              removeGraphicState(g, reverseState, hasAnimation);
            });
          }

          if (state && markIdByState[state] && markIdByState[state].includes(mark.id)) {
            graphics.forEach(g => {
              if (statedGraphics.includes(g)) {
                removeGraphicState(g, state, hasAnimation);
              }
            });
          }
        }
      }
    });
  }

  clearAllStates() {
    if (this._disableTriggerEvent) {
      return;
    }

    this._triggerMapByState.forEach((triggers, state) => {
      triggers.forEach(trigger => {
        this.clearAllStatesOfTrigger(trigger, state, trigger.getResetState());
      });
    });
  }

  clearByState(stateValue: string) {
    if (this._disableTriggerEvent) {
      return;
    }

    const triggers = this._triggerMapByState.get(stateValue);

    if (triggers && triggers.length) {
      triggers.forEach(t => {
        this.clearAllStatesOfTrigger(t, stateValue, t.getResetState());

        // 更新缓存
        this.setStatedGraphics(t, []);
      });
    }
  }

  updateStateOfGraphics(stateValue: string, markGraphics: IMarkGraphic[]) {
    if (this._disableTriggerEvent) {
      return;
    }
    const triggers = this._triggerMapByState.get(stateValue);

    if (triggers && triggers.length) {
      triggers.forEach(t => {
        const newStatedGraphics = markGraphics.filter(mg => {
          return t.getMarks().some(m => {
            const graphics = m && m.getGraphics();

            return graphics && graphics.includes(mg);
          });
        });

        this.updateStates(t, newStatedGraphics, this.getStatedGraphics(t), t.getStartState(), t.getResetState());

        this.setStatedGraphics(t, newStatedGraphics);
      });
    }
  }
}
