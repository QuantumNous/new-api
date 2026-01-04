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
            <path d="M19 2H5a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V5a3 3 0 0 0-3-3Z" fill="#4CC3FA" />
            <path
                d="M4.05 16.85h5.98v-1.32h-3.8v-.06l1.5-1.53c1.7-1.63 2.17-2.42 2.17-3.4C9.9 9.06 8.71 8 6.96 8 5.23 8 4 9.07 4 10.73h1.5c0-.89.57-1.45 1.44-1.45.83 0 1.44.51 1.44 1.33 0 .73-.44 1.25-1.3 2.12L4.05 15.7v1.15Z"
                fill="white"
            />
            <path d="M12 16.94c.5 0 .92-.42.93-.94a.95.95 0 0 0-.94-.93.93.93 0 1 0 0 1.87Z" fill="white" />
            <path
                d="M16.91 17.01c2.1 0 3.36-1.65 3.36-4.52 0-2.85-1.26-4.49-3.36-4.49-2.1 0-3.36 1.64-3.36 4.5 0 2.85 1.26 4.51 3.36 4.51Zm0-1.33c-1.09 0-1.77-1.1-1.76-3.19 0-2.08.68-3.17 1.76-3.17 1.09 0 1.76 1.1 1.77 3.17 0 2.1-.68 3.19-1.77 3.19Z"
                fill="white"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'version-two');
export default IconComponent;
