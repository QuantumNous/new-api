import React, { useContext } from 'react';
import BasicStep from './basicStep';
import FillStep from './fillStep';
import NavStep from './navStep';
import Context from './context';

export type Status = 'wait' | 'process' | 'finish' | 'error' | 'warning';

export interface StepProps {
    description?: React.ReactNode;
    icon?: React.ReactNode;
    status?: Status;
    title?: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
    onClick?: React.MouseEventHandler<HTMLDivElement>
}

const Step = (props: StepProps) => {
    const { type } = useContext(Context);
    const renderStep = () => {
        switch (type) {
            case 'fill':
                return <FillStep {...props} />;
            case 'basic':
                return <BasicStep {...props} />;
            case 'nav':
                return <NavStep {...props} />;
            default:
                return null;
        }
    };

    return renderStep();
};

export default Step;
