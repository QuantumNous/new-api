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
                d="M11.44 1.08c.37-.1.77-.1 1.15 0l8.7 2.64c.42.12.7.5.7.93.03 2.65-.03 11.8-2 14.36-1.97 2.57-6.36 3.68-7.63 3.95a1.6 1.6 0 0 1-.7 0c-1.24-.28-5.5-1.39-7.62-3.95C1.9 16.44 1.96 7.27 2.02 4.64c.01-.43.3-.8.7-.92l8.72-2.64ZM4.01 5.42c-.02 1.47 0 3.88.19 6.26.12 1.42.3 2.79.56 3.92.28 1.2.6 1.87.82 2.14A9.01 9.01 0 0 0 8.96 20c1.27.54 2.47.85 3.06.99.6-.14 1.83-.45 3.12-.99a8.15 8.15 0 0 0 3.26-2.2c.22-.28.52-.97.79-2.18.25-1.14.44-2.51.56-3.94.21-2.38.25-4.78.25-6.26L12 3l-8 2.42Zm11.02 2.7a1.38 1.38 0 0 1 2.05-.1c.52.53.55 1.36.06 1.92l-5.42 6.25a1 1 0 0 1-1.45.05l-3.24-3.26a1.43 1.43 0 0 1 0-2.02 1.4 1.4 0 0 1 2 0l1.99 2.02 4.01-4.86Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'safe_stroked');
export default IconComponent;
