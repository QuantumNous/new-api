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
            <rect x={1} y={4} width={22} height={16} rx={2} fill="#DDE3E8" />
            <path
                d="M4.1 16.4c.45 0 .7-.23.88-.83l.48-1.47H8.5l.5 1.47c.16.6.43.84.9.84.48 0 .8-.3.8-.75 0-.18-.04-.4-.13-.66L8.4 8.74c-.27-.82-.65-1.15-1.37-1.15-.73 0-1.11.34-1.39 1.15L3.45 15c-.1.32-.15.52-.15.69 0 .43.32.72.8.72Zm1.74-3.57 1.1-3.5h.1l1.09 3.5H5.84Z"
                fill="#AAB2BF"
            />
            <path
                d="M20.12 9.88a1 1 0 0 0-1.41 0l-.71.7-.7-.7a1 1 0 1 0-1.42 1.41l.7.71-.7.7a1 1 0 0 0 1.41 1.42l.71-.7.7.7a1 1 0 0 0 1.42-1.41l-.7-.71.7-.7a1 1 0 0 0 0-1.42Z"
                fill="#324350"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'tag-input');
export default IconComponent;
