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
            <path
                d="M3.1 16.31c.45 0 .7-.23.88-.83L4.46 14H7.5l.5 1.47c.16.59.43.83.9.83.48 0 .8-.3.8-.75 0-.18-.04-.39-.13-.66L7.4 8.64c-.27-.81-.65-1.14-1.37-1.14-.73 0-1.11.34-1.39 1.14L2.45 14.9c-.1.33-.15.52-.15.7 0 .42.32.71.8.71Zm1.74-3.58 1.1-3.5h.1l1.09 3.5H4.84Z"
                fill="#4CC3FA"
            />
            <path
                d="M10.93 15.14c0 .73.38 1.1 1.14 1.1h2.47c1.83 0 3.01-.96 3.01-2.45 0-1.18-.76-2-1.93-2.11v-.08a1.84 1.84 0 0 0 1.49-1.9c0-1.3-1-2.13-2.57-2.13h-2.47c-.76 0-1.14.37-1.14 1.1v6.47Zm1.7-3.96V8.86h1.52c.8 0 1.27.43 1.27 1.13 0 .76-.5 1.19-1.66 1.19h-1.13Zm0 3.77v-2.58h1.63c1 0 1.55.5 1.55 1.32 0 .82-.56 1.26-1.9 1.26h-1.28Z"
                fill="#AAB2BF"
            />
            <rect x={19} y={6} width={2} height={12} rx={1} fill="#324350" />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'autocomplete');
export default IconComponent;
