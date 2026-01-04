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
                d="M20.6 2.13 1.54 8.5a1 1 0 0 0-.4 1.65l3.82 3.82a1 1 0 0 0 1.2.16l8.2-4.74c.17-.1.37.1.26.27l-4.74 8.19a1 1 0 0 0 .16 1.2l3.82 3.82a1 1 0 0 0 1.65-.4L21.87 3.4a1 1 0 0 0-1.27-1.27Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'send');
export default IconComponent;
