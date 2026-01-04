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
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="m10.23 2.4-8.7 16.67A2 2 0 0 0 3.3 22h17.4a2 2 0 0 0 1.77-2.93L13.77 2.4a2 2 0 0 0-3.54 0ZM13.14 14a1.15 1.15 0 0 1-2.28 0l-.58-4.03a1.73 1.73 0 1 1 3.44 0l-.58 4.03Zm.36 4.49a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'alert_triangle');
export default IconComponent;
