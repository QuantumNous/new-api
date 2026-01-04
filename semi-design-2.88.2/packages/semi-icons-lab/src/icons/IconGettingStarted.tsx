import * as React from 'react';
import { convertIcon } from '../components/Icon';
function SvgComponent(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            width="1em"
            height="1em"
            focusable={false}
            aria-hidden={true}
            {...props}
        >
            <circle cx={12} cy={12} r={11} fill="#4CC3FA" />
            <path
                d="M16.9 11.33c.37.38.37.96 0 1.34a22.88 22.88 0 0 1-6.71 4.39 1.01 1.01 0 0 1-1.42-.83 33.04 33.04 0 0 1 0-8.46c.1-.69.77-1.1 1.41-.82a22.89 22.89 0 0 1 6.72 4.38Z"
                fill="white"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'getting-started');
export default IconComponent;
