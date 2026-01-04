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
            <circle cx={12} cy={4} r={3} fill="#4CC3FA" />
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M2 9.5C2 8.67 2.67 8 3.5 8h17a1.5 1.5 0 0 1 0 3H16v10.5a1.5 1.5 0 0 1-3 0V17a1 1 0 1 0-2 0v4.5a1.5 1.5 0 0 1-3 0V11H3.5A1.5 1.5 0 0 1 2 9.5Z"
                fill="#6A6F7F"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'accessibility');
export default IconComponent;
