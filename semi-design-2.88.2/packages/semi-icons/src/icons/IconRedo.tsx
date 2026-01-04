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
                d="M14.44 2.44a1.5 1.5 0 0 0 0 2.12L16.88 7H9.25C5.16 7 2 10.58 2 14.5S5.16 22 9.25 22h3.25a1.5 1.5 0 0 0 0-3H9.25C6.98 19 5 16.93 5 14.5S6.98 10 9.25 10h7.63l-2.44 2.44a1.5 1.5 0 0 0 2.12 2.12l5-5a1.5 1.5 0 0 0 0-2.12l-5-5a1.5 1.5 0 0 0-2.12 0Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'redo');
export default IconComponent;
