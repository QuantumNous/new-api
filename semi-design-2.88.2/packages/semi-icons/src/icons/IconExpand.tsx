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
                d="M10 2a1.5 1.5 0 0 1 0 3H7.12l3.94 3.94a1.5 1.5 0 0 1-2.12 2.12L5 7.12V10a1.5 1.5 0 0 1-3 0V3.5C2 2.67 2.67 2 3.5 2H10Z"
                fill="currentColor"
            />
            <path
                d="M19 14a1.5 1.5 0 0 1 3 0v6.5c0 .83-.67 1.5-1.5 1.5H14a1.5 1.5 0 0 1 0-3h2.88l-3.94-3.94a1.5 1.5 0 0 1 2.12-2.12L19 16.88V14Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'expand');
export default IconComponent;
