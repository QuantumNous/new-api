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
                d="m21.21 15.05.26.14c.51.28.68.9.38 1.39-.1.15-.23.27-.38.36l-8.92 4.92c-.34.19-.76.19-1.1 0l-8.92-4.92a.98.98 0 0 1-.38-1.39c.1-.15.23-.27.38-.36l.26-.14 8.66 4.78c.32.17.72.18 1.05.02l.05-.02 8.66-4.78Zm0-4.07.26.14c.51.29.68.91.38 1.4-.1.14-.23.27-.38.36l-8.92 4.92c-.34.18-.76.18-1.1 0l-8.92-4.92a.98.98 0 0 1-.38-1.4c.1-.14.23-.27.38-.36l.26-.14 8.66 4.78c.32.18.72.19 1.05.03l.05-.03 8.66-4.78Zm-8.66-8.84 8.92 4.92c.51.28.68.9.38 1.39-.1.15-.23.27-.38.36l-8.92 4.92c-.34.19-.76.19-1.1 0L2.53 8.81a.98.98 0 0 1-.38-1.39c.1-.15.23-.27.38-.36l8.92-4.92c.34-.19.76-.19 1.1 0Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'layers');
export default IconComponent;
