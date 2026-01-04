import * as React from 'react';
import { convertIcon } from '../components/Icon';
function SvgComponent(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            width="1em"
            height="1em"
            focusable={false}
            aria-hidden={true}
            {...props}
        >
            <path
                d="M12.6.67a1 1 0 0 1 .6.29l4.17 4.17a1 1 0 0 1 .3.7V17.5c0 1.01-.82 1.83-1.84 1.83H4.17a1.83 1.83 0 0 1-1.84-1.83v-15c0-1.01.82-1.83 1.84-1.83h8.43ZM7.92 6.5a1 1 0 0 0-1 1v6.67a1 1 0 0 0 1 1h4.16a1 1 0 0 0 0-2H8.92v-1.34h3.16a1 1 0 0 0 0-2H8.92V8.5h3.16a1 1 0 0 0 0-2H7.92Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'excel');
export default IconComponent;
