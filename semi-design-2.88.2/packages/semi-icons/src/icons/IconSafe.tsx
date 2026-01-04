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
                d="m2.72 3.72 8.72-2.64c.37-.1.77-.1 1.15 0l8.7 2.64c.42.12.7.5.7.93.03 2.65-.03 11.79-2 14.36-1.97 2.57-6.36 3.68-7.63 3.95a1.6 1.6 0 0 1-.7 0c-1.24-.28-5.5-1.39-7.62-3.95C1.9 16.44 1.96 7.27 2.02 4.64c0-.43.3-.8.7-.92Zm4.3 9.26 3.24 3.26a1 1 0 0 0 1.46-.05l5.42-6.25a1.4 1.4 0 0 0-.06-1.91 1.38 1.38 0 0 0-2.05.1l-4.01 4.85-2-2.01a1.4 1.4 0 0 0-2 0 1.43 1.43 0 0 0 0 2Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'safe');
export default IconComponent;
