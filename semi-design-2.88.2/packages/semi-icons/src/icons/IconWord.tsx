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
                d="M12.6.67a1 1 0 0 1 .6.29l4.17 4.17a1 1 0 0 1 .3.7V17.5c0 1.01-.82 1.83-1.84 1.83H4.17a1.83 1.83 0 0 1-1.84-1.83v-15c0-1.01.82-1.83 1.84-1.83h8.43Zm.95 6.69a1 1 0 0 0-1.2.76l-.64 3.05-.81-1.62a1 1 0 0 0-1.72-.12l-.07.12-.81 1.62-.65-3.05a1 1 0 0 0-1.96.42l1.25 5.84a1 1 0 0 0 1.87.23l1.2-2.37 1.18 2.37a1 1 0 0 0 1.87-.23l1.25-5.84a1 1 0 0 0-.76-1.18Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'word');
export default IconComponent;
