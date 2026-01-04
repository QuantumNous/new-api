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
                d="M12 16c1.98 0 3.75-1.66 4.71-4.14.6-.25 1.18-1 1.44-1.97.34-1.27.27-2.4-.65-2.76C17.4 2.71 15.66 1 12 1S6.6 2.71 6.5 7.13c-.93.35-1 1.49-.65 2.76.26.98.83 1.72 1.44 1.97C8.26 14.34 10.02 16 12 16Z"
                fill="currentColor"
            />
            <path
                d="M19.6 22c1.24 0 2.12-1.15 1.27-2.05C19.2 18.2 15.85 17 12 17c-3.85 0-7.2 1.2-8.87 2.95-.85.9.03 2.05 1.27 2.05h15.2Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'user');
export default IconComponent;
