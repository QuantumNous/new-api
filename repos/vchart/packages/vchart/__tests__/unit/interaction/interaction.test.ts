import { Interaction } from '../../../src/interaction/interaction';

describe('Interaction', () => {
  it('clears previous states when the next stated graphics are empty', () => {
    const interaction = new Interaction();
    const previousGraphic = {
      currentStates: ['dimension_hover'],
      setStates(states?: string[] | null) {
        this.currentStates = states ?? [];
      }
    };
    const reverseGraphic = {
      currentStates: ['dimension_hover_reverse'],
      setStates(states?: string[] | null) {
        this.currentStates = states ?? [];
      }
    };
    const mark = {
      id: 1,
      getGraphics: () => [previousGraphic, reverseGraphic],
      hasAnimationByState: () => false
    };
    const trigger = {
      getMarks: () => [mark],
      getMarkIdByState: () => ({
        dimension_hover: [1],
        dimension_hover_reverse: [1]
      })
    };

    interaction.setStatedGraphics(trigger as any, [previousGraphic as any]);

    const nextGraphics = interaction.updateStates(
      trigger as any,
      [],
      [previousGraphic as any],
      'dimension_hover',
      'dimension_hover_reverse'
    );

    expect(nextGraphics).toEqual([]);
    expect(previousGraphic.currentStates).toEqual([]);
    expect(reverseGraphic.currentStates).toEqual([]);
  });

  it('updates states for progressive graphics whose parent has no mark', () => {
    const interaction = new Interaction();
    const stateOptions: unknown[] = [];
    const previousGraphic = {
      context: {
        markId: 1
      },
      currentStates: ['dimension_hover'],
      parent: {},
      setStates(states?: string[] | null, options?: unknown) {
        this.currentStates = states ?? [];
        stateOptions.push(options);
      }
    };
    const nextGraphic = {
      context: {
        markId: 1
      },
      currentStates: ['dimension_hover_reverse'],
      parent: {},
      setStates(states?: string[] | null, options?: unknown) {
        this.currentStates = states ?? [];
        stateOptions.push(options);
      }
    };
    const hasAnimationByState = jest.fn(() => true);
    const mark = {
      id: 1,
      getGraphics: () => [previousGraphic, nextGraphic],
      hasAnimationByState
    };
    const trigger = {
      getMarks: () => [mark],
      getMarkIdByState: () => ({
        dimension_hover: [1],
        dimension_hover_reverse: [1]
      })
    };

    const nextGraphics = interaction.updateStates(
      trigger as any,
      [nextGraphic as any],
      [previousGraphic as any],
      'dimension_hover',
      'dimension_hover_reverse'
    );

    expect(nextGraphics).toEqual([nextGraphic]);
    expect(hasAnimationByState).toHaveBeenCalledWith('state');
    expect(stateOptions).toContainEqual({ animate: true, animateSameStatePatchChange: true });
    expect(previousGraphic.currentStates).toEqual(['dimension_hover_reverse']);
    expect(nextGraphic.currentStates).toEqual(['dimension_hover']);
  });
});
