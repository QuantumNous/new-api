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
            <rect x={1} y={4} width={22} height={16} rx={3} fill="#DDE3E8" />
            <path d="M15 4h5a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3h-5V4Z" fill="#4CC3FA" />
            <path d="m19 7.5 2 3h-4l2-3Z" fill="white" />
            <path d="m19 16.5-2-3h4l-2 3Z" fill="white" />
            <path
                d="M8.36 15.78c-.97 0-1.65-.6-1.65-1.43s.68-1.43 1.65-1.43c.96 0 1.65.6 1.65 1.43s-.7 1.43-1.65 1.43Zm0-4.05c-.8 0-1.37-.53-1.37-1.25s.57-1.24 1.37-1.24c.8 0 1.37.52 1.37 1.24 0 .73-.57 1.25-1.37 1.25ZM8.34 17c2 0 3.37-1.03 3.37-2.55 0-1.06-.73-1.93-1.82-2.15v-.1c.93-.28 1.48-1 1.48-1.92C11.37 8.95 10.13 8 8.36 8c-1.77 0-3.01.95-3.01 2.3 0 .91.54 1.63 1.47 1.91v.1A2.18 2.18 0 0 0 5 14.47C5 15.99 6.34 17 8.34 17Z"
                fill="#324350"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'input-number');
export default IconComponent;
