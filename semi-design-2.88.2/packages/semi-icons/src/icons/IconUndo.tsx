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
                d="M9.56 2.44a1.5 1.5 0 0 1 0 2.12L7.12 7h7.63C18.84 7 22 10.58 22 14.5S18.84 22 14.75 22H11.5a1.5 1.5 0 0 1 0-3h3.25c2.27 0 4.25-2.07 4.25-4.5S17.02 10 14.75 10H7.12l2.44 2.44a1.5 1.5 0 0 1-2.12 2.12l-5-5a1.5 1.5 0 0 1 0-2.12l5-5a1.5 1.5 0 0 1 2.12 0Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'undo');
export default IconComponent;
