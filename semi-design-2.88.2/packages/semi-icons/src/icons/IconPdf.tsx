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
                d="M12.6.67a1 1 0 0 1 .6.29l4.17 4.17a1 1 0 0 1 .3.7V17.5c0 1.01-.82 1.83-1.84 1.83H4.17a1.83 1.83 0 0 1-1.84-1.83v-15c0-1.01.82-1.83 1.84-1.83h8.43ZM7.5 6.5a1 1 0 0 0-.17.02H7.3l-.05.01-.04.01a1 1 0 0 0-.31.16l-.04.03a1 1 0 0 0-.36.77v6.67a1 1 0 0 0 2 0v-2.34h4a1 1 0 0 0 1-1V7.5a1 1 0 0 0-1-1h-5Zm4 3.33h-3V8.5h3v1.33Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'pdf');
export default IconComponent;
