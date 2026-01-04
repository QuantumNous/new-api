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
                d="M12 3a1 1 0 0 0-1.62-.78L4.65 7H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h2.65l5.73 4.78A1 1 0 0 0 12 21V3Zm2.06 4.94a1.5 1.5 0 0 1 2.12 0L18 9.76l1.82-1.82a1.5 1.5 0 1 1 2.12 2.12l-1.82 1.82 1.94 1.94a1.5 1.5 0 0 1-2.12 2.12L18 14l-1.94 1.94a1.5 1.5 0 0 1-2.12-2.12l1.94-1.94-1.82-1.82a1.5 1.5 0 0 1 0-2.12Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'mute');
export default IconComponent;
