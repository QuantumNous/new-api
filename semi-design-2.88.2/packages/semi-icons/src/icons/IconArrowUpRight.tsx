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
                d="M5 4.5C5 3.67 5.67 3 6.5 3h13c.83 0 1.5.67 1.5 1.5v13a1.5 1.5 0 0 1-3 0V8.12L4.56 21.56a1.5 1.5 0 1 1-2.12-2.12L15.88 6H6.5A1.5 1.5 0 0 1 5 4.5Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'arrow_up_right');
export default IconComponent;
