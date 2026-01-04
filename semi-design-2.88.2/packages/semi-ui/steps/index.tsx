import React, { Component } from 'react';
import PropTypes from 'prop-types';
import '@douyinfe/semi-foundation/steps/steps.scss';
import Step from './step';
import FillSteps, { FillStepsProps } from './fillSteps';
import BasicSteps, { BasicStepsProps } from './basicSteps';
import NavSteps, { NavStepsProps } from './navSteps';
import Context from './context';

export type { Status, Size, BasicStepProps } from './basicStep';
export type { Direction, BasicStepsProps } from './basicSteps';
export type { FillStepProps } from './fillStep';
export type { FillStepsProps } from './fillSteps';
export type { NavStepProps } from './navStep';
export type { NavStepsProps } from './navSteps';
export type { StepProps } from './step';

export interface FillStepsAllProps extends FillStepsProps {
    type?: 'fill'
}
export interface BasicStepsAllProps extends BasicStepsProps {
    type?: 'basic'
}
export interface NavStepsAllProps extends NavStepsProps {
    type?: 'nav'
}
export type StepsProps = FillStepsAllProps | BasicStepsAllProps | NavStepsAllProps;

class Steps extends Component<StepsProps> {
    static Step = Step;

    static propTypes = {
        onChange: PropTypes.func,
        type: PropTypes.oneOf(['fill', 'basic', 'nav']),
        size: PropTypes.oneOf(['small', 'default'])
    };

    static defaultProps = {
        type: 'fill',
        size: 'default'
    };

    renderComponent() {
        const { type, ...restProps } = this.props;
        switch (type) {
            case 'fill':
                return <FillSteps {...restProps} />;
            case 'basic':
                return <BasicSteps {...restProps} />;
            case 'nav':
                return <NavSteps {...restProps} />;
            default:
                return null;
        }
    }

    render() {
        const { type } = this.props;
        return (
            <Context.Provider value={{ type }}>
                {this.renderComponent()}
            </Context.Provider>
        );
    }
}

export default Steps;
