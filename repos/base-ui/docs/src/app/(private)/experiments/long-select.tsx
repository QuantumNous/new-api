'use client';
import * as React from 'react';
import { Select } from '@base-ui/react/select';
import styles from './long-select.module.css';

export default function ExampleSelect() {
  return (
    <div>
      Scroll down
      <div style={{ width: 1, height: 2000, background: 'black' }} />
      <h2>With Select.List (new)</h2>
      <ul>
        <li>Scroll arrows rendered inside Select.Popup (handles animations)</li>
        <li>
          Scrollbar invisible when in fallback mode as well (alignItemWithTrigger deactivated)
        </li>
      </ul>
      <Select.Root>
        <Select.Trigger className={styles.Select}>
          <Select.Value>
            {(value) => countries.find((country) => country.code === value)?.name}
          </Select.Value>
          <Select.Icon className={styles.SelectIcon}>
            <ChevronUpDownIcon />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner className={styles.Positioner} sideOffset={8}>
            <Select.Popup className={styles.Popup}>
              <Select.ScrollUpArrow className={styles.ScrollArrow} />
              <Select.Arrow className={styles.Arrow}>
                <ArrowSvg />
              </Select.Arrow>
              <Select.List className={styles.List}>
                <div aria-hidden style={{ height: 75 }}>
                  Start
                </div>
                {countries.map((country) => (
                  <Select.Item key={country.code} className={styles.Item} value={country.code}>
                    <Select.ItemIndicator className={styles.ItemIndicator}>
                      <CheckIcon className={styles.ItemIndicatorIcon} />
                    </Select.ItemIndicator>
                    <Select.ItemText className={styles.ItemText}>{country.name}</Select.ItemText>
                  </Select.Item>
                ))}
                <div aria-hidden style={{ height: 75 }}>
                  End
                </div>
              </Select.List>
              <Select.ScrollDownArrow className={styles.ScrollArrow} />
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
      <br />
      <h2>Without Select.List (old)</h2>
      <ul>
        <li>Scroll arrows rendered inside Select.Positioner</li>
        <li>Scrollbar visible when in fallback mode (alignItemWithTrigger deactivated)</li>
      </ul>
      <Select.Root>
        <Select.Trigger className={styles.Select}>
          <Select.Value>
            {(value) => countries.find((country) => country.code === value)?.name}
          </Select.Value>
          <Select.Icon className={styles.SelectIcon}>
            <ChevronUpDownIcon />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner className={styles.Positioner} sideOffset={8}>
            <Select.ScrollUpArrow className={styles.ScrollArrow} data-old />
            <Select.Popup className={styles.Popup} data-old>
              <div aria-hidden style={{ height: 75 }}>
                Start
              </div>
              <Select.Arrow className={styles.Arrow}>
                <ArrowSvg />
              </Select.Arrow>
              {countries.map((country) => (
                <Select.Item key={country.code} className={styles.Item} value={country.code}>
                  <Select.ItemIndicator className={styles.ItemIndicator}>
                    <CheckIcon className={styles.ItemIndicatorIcon} />
                  </Select.ItemIndicator>
                  <Select.ItemText className={styles.ItemText}>{country.name}</Select.ItemText>
                </Select.Item>
              ))}
              <div aria-hidden style={{ height: 75 }}>
                End
              </div>
            </Select.Popup>
            <Select.ScrollDownArrow className={styles.ScrollArrow} data-old />
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
      <div style={{ width: 1, height: 2000, background: 'black' }} />
    </div>
  );
}

function ArrowSvg(props: React.ComponentProps<'svg'>) {
  return (
    <svg width="20" height="10" viewBox="0 0 20 10" fill="none" {...props}>
      <path
        d="M9.66437 2.60207L4.80758 6.97318C4.07308 7.63423 3.11989 8 2.13172 8H0V10H20V8H18.5349C17.5468 8 16.5936 7.63423 15.8591 6.97318L11.0023 2.60207C10.622 2.2598 10.0447 2.25979 9.66437 2.60207Z"
        className={styles.ArrowFill}
      />
      <path
        d="M8.99542 1.85876C9.75604 1.17425 10.9106 1.17422 11.6713 1.85878L16.5281 6.22989C17.0789 6.72568 17.7938 7.00001 18.5349 7.00001L15.89 7L11.0023 2.60207C10.622 2.2598 10.0447 2.2598 9.66436 2.60207L4.77734 7L2.13171 7.00001C2.87284 7.00001 3.58774 6.72568 4.13861 6.22989L8.99542 1.85876Z"
        className={styles.ArrowOuterStroke}
      />
      <path
        d="M10.3333 3.34539L5.47654 7.71648C4.55842 8.54279 3.36693 9 2.13172 9H0V8H2.13172C3.11989 8 4.07308 7.63423 4.80758 6.97318L9.66437 2.60207C10.0447 2.25979 10.622 2.2598 11.0023 2.60207L15.8591 6.97318C16.5936 7.63423 17.5468 8 18.5349 8H20V9H18.5349C17.2998 9 16.1083 8.54278 15.1901 7.71648L10.3333 3.34539Z"
        className={styles.ArrowInnerStroke}
      />
    </svg>
  );
}

function ChevronUpDownIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      width="8"
      height="12"
      viewBox="0 0 8 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      {...props}
    >
      <path d="M0.5 4.5L4 1.5L7.5 4.5" />
      <path d="M0.5 7.5L4 10.5L7.5 7.5" />
    </svg>
  );
}

function CheckIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg fill="currentColor" width="10" height="10" viewBox="0 0 10 10" {...props}>
      <path d="M9.1603 1.12218C9.50684 1.34873 9.60427 1.81354 9.37792 2.16038L5.13603 8.66012C5.01614 8.8438 4.82192 8.96576 4.60451 8.99384C4.3871 9.02194 4.1683 8.95335 4.00574 8.80615L1.24664 6.30769C0.939709 6.02975 0.916013 5.55541 1.19372 5.24822C1.47142 4.94102 1.94536 4.91731 2.2523 5.19524L4.36085 7.10461L8.12299 1.33999C8.34934 0.993152 8.81376 0.895638 9.1603 1.12218Z" />
    </svg>
  );
}

interface Country {
  code: string;
  name: string;
  continent: string;
}

export const countries: Country[] = [
  { code: 'af', name: 'Afghanistan', continent: 'Asia' },
  { code: 'al', name: 'Albania', continent: 'Europe' },
  { code: 'dz', name: 'Algeria', continent: 'Africa' },
  { code: 'as', name: 'American Samoa', continent: 'Oceania' },
  { code: 'ad', name: 'Andorra', continent: 'Europe' },
  { code: 'ao', name: 'Angola', continent: 'Africa' },
  { code: 'ai', name: 'Anguilla', continent: 'North America' },
  { code: 'aq', name: 'Antarctica', continent: 'Antarctica' },
  { code: 'ag', name: 'Antigua and Barbuda', continent: 'North America' },
  { code: 'ar', name: 'Argentina', continent: 'South America' },
  { code: 'am', name: 'Armenia', continent: 'Asia' },
  { code: 'aw', name: 'Aruba', continent: 'North America' },
  { code: 'au', name: 'Australia', continent: 'Oceania' },
  { code: 'at', name: 'Austria', continent: 'Europe' },
  { code: 'az', name: 'Azerbaijan', continent: 'Asia' },
  { code: 'bs', name: 'Bahamas', continent: 'North America' },
  { code: 'bh', name: 'Bahrain', continent: 'Asia' },
  { code: 'bd', name: 'Bangladesh', continent: 'Asia' },
  { code: 'bb', name: 'Barbados', continent: 'North America' },
  { code: 'by', name: 'Belarus', continent: 'Europe' },
  { code: 'be', name: 'Belgium', continent: 'Europe' },
  { code: 'bz', name: 'Belize', continent: 'North America' },
  { code: 'bj', name: 'Benin', continent: 'Africa' },
  { code: 'bm', name: 'Bermuda', continent: 'North America' },
  { code: 'bt', name: 'Bhutan', continent: 'Asia' },
  { code: 'bo', name: 'Bolivia', continent: 'South America' },
  { code: 'ba', name: 'Bosnia and Herzegovina', continent: 'Europe' },
  { code: 'bw', name: 'Botswana', continent: 'Africa' },
  { code: 'br', name: 'Brazil', continent: 'South America' },
  { code: 'io', name: 'British Indian Ocean Territory', continent: 'Asia' },
  { code: 'vg', name: 'British Virgin Islands', continent: 'North America' },
  { code: 'bn', name: 'Brunei', continent: 'Asia' },
  { code: 'bg', name: 'Bulgaria', continent: 'Europe' },
  { code: 'bf', name: 'Burkina Faso', continent: 'Africa' },
  { code: 'bi', name: 'Burundi', continent: 'Africa' },
  { code: 'cv', name: 'Cabo Verde', continent: 'Africa' },
  { code: 'kh', name: 'Cambodia', continent: 'Asia' },
  { code: 'cm', name: 'Cameroon', continent: 'Africa' },
  { code: 'ca', name: 'Canada', continent: 'North America' },
  { code: 'ky', name: 'Cayman Islands', continent: 'North America' },
  { code: 'cf', name: 'Central African Republic', continent: 'Africa' },
  { code: 'td', name: 'Chad', continent: 'Africa' },
  { code: 'cl', name: 'Chile', continent: 'South America' },
  { code: 'cn', name: 'China', continent: 'Asia' },
  { code: 'co', name: 'Colombia', continent: 'South America' },
  { code: 'km', name: 'Comoros', continent: 'Africa' },
  { code: 'cg', name: 'Congo', continent: 'Africa' },
  { code: 'cd', name: 'Congo (DRC)', continent: 'Africa' },
  { code: 'ck', name: 'Cook Islands', continent: 'Oceania' },
  { code: 'cr', name: 'Costa Rica', continent: 'North America' },
  { code: 'ci', name: 'Côte d’Ivoire', continent: 'Africa' },
  { code: 'hr', name: 'Croatia', continent: 'Europe' },
  { code: 'cu', name: 'Cuba', continent: 'North America' },
  { code: 'cw', name: 'Curaçao', continent: 'North America' },
  { code: 'cy', name: 'Cyprus', continent: 'Asia' },
  { code: 'cz', name: 'Czechia', continent: 'Europe' },
  { code: 'dk', name: 'Denmark', continent: 'Europe' },
  { code: 'dj', name: 'Djibouti', continent: 'Africa' },
  { code: 'dm', name: 'Dominica', continent: 'North America' },
  { code: 'do', name: 'Dominican Republic', continent: 'North America' },
  { code: 'ec', name: 'Ecuador', continent: 'South America' },
  { code: 'eg', name: 'Egypt', continent: 'Africa' },
  { code: 'sv', name: 'El Salvador', continent: 'North America' },
  { code: 'gq', name: 'Equatorial Guinea', continent: 'Africa' },
  { code: 'er', name: 'Eritrea', continent: 'Africa' },
  { code: 'ee', name: 'Estonia', continent: 'Europe' },
  { code: 'sz', name: 'Eswatini', continent: 'Africa' },
  { code: 'et', name: 'Ethiopia', continent: 'Africa' },
  { code: 'fj', name: 'Fiji', continent: 'Oceania' },
  { code: 'fi', name: 'Finland', continent: 'Europe' },
  { code: 'fr', name: 'France', continent: 'Europe' },
  { code: 'gf', name: 'French Guiana', continent: 'South America' },
  { code: 'pf', name: 'French Polynesia', continent: 'Oceania' },
  { code: 'ga', name: 'Gabon', continent: 'Africa' },
  { code: 'gm', name: 'Gambia', continent: 'Africa' },
  { code: 'ge', name: 'Georgia', continent: 'Asia' },
  { code: 'de', name: 'Germany', continent: 'Europe' },
  { code: 'gh', name: 'Ghana', continent: 'Africa' },
  { code: 'gi', name: 'Gibraltar', continent: 'Europe' },
  { code: 'gr', name: 'Greece', continent: 'Europe' },
  { code: 'gl', name: 'Greenland', continent: 'North America' },
  { code: 'gd', name: 'Grenada', continent: 'North America' },
  { code: 'gp', name: 'Guadeloupe', continent: 'North America' },
  { code: 'gu', name: 'Guam', continent: 'Oceania' },
  { code: 'gt', name: 'Guatemala', continent: 'North America' },
  { code: 'gn', name: 'Guinea', continent: 'Africa' },
  { code: 'gw', name: 'Guinea-Bissau', continent: 'Africa' },
  { code: 'gy', name: 'Guyana', continent: 'South America' },
  { code: 'ht', name: 'Haiti', continent: 'North America' },
  { code: 'hn', name: 'Honduras', continent: 'North America' },
  { code: 'hk', name: 'Hong Kong', continent: 'Asia' },
  { code: 'hu', name: 'Hungary', continent: 'Europe' },
  { code: 'is', name: 'Iceland', continent: 'Europe' },
  { code: 'in', name: 'India', continent: 'Asia' },
  { code: 'id', name: 'Indonesia', continent: 'Asia' },
  { code: 'ir', name: 'Iran', continent: 'Asia' },
  { code: 'iq', name: 'Iraq', continent: 'Asia' },
  { code: 'ie', name: 'Ireland', continent: 'Europe' },
  { code: 'il', name: 'Israel', continent: 'Asia' },
  { code: 'it', name: 'Italy', continent: 'Europe' },
  { code: 'jm', name: 'Jamaica', continent: 'North America' },
  { code: 'jp', name: 'Japan', continent: 'Asia' },
  { code: 'jo', name: 'Jordan', continent: 'Asia' },
  { code: 'kz', name: 'Kazakhstan', continent: 'Asia' },
  { code: 'ke', name: 'Kenya', continent: 'Africa' },
  { code: 'ki', name: 'Kiribati', continent: 'Oceania' },
  { code: 'kp', name: 'North Korea', continent: 'Asia' },
  { code: 'kr', name: 'South Korea', continent: 'Asia' },
  { code: 'kw', name: 'Kuwait', continent: 'Asia' },
  { code: 'kg', name: 'Kyrgyzstan', continent: 'Asia' },
  { code: 'la', name: 'Laos', continent: 'Asia' },
  { code: 'lv', name: 'Latvia', continent: 'Europe' },
  { code: 'lb', name: 'Lebanon', continent: 'Asia' },
  { code: 'ls', name: 'Lesotho', continent: 'Africa' },
  { code: 'lr', name: 'Liberia', continent: 'Africa' },
  { code: 'ly', name: 'Libya', continent: 'Africa' },
  { code: 'li', name: 'Liechtenstein', continent: 'Europe' },
  { code: 'lt', name: 'Lithuania', continent: 'Europe' },
  { code: 'lu', name: 'Luxembourg', continent: 'Europe' },
  { code: 'mo', name: 'Macau', continent: 'Asia' },
  { code: 'mg', name: 'Madagascar', continent: 'Africa' },
  { code: 'mw', name: 'Malawi', continent: 'Africa' },
  { code: 'my', name: 'Malaysia', continent: 'Asia' },
  { code: 'mv', name: 'Maldives', continent: 'Asia' },
  { code: 'ml', name: 'Mali', continent: 'Africa' },
  { code: 'mt', name: 'Malta', continent: 'Europe' },
  { code: 'mh', name: 'Marshall Islands', continent: 'Oceania' },
  { code: 'mq', name: 'Martinique', continent: 'North America' },
  { code: 'mr', name: 'Mauritania', continent: 'Africa' },
  { code: 'mu', name: 'Mauritius', continent: 'Africa' },
  { code: 'yt', name: 'Mayotte', continent: 'Africa' },
  { code: 'mx', name: 'Mexico', continent: 'North America' },
  { code: 'fm', name: 'Micronesia', continent: 'Oceania' },
  { code: 'md', name: 'Moldova', continent: 'Europe' },
  { code: 'mc', name: 'Monaco', continent: 'Europe' },
  { code: 'mn', name: 'Mongolia', continent: 'Asia' },
  { code: 'me', name: 'Montenegro', continent: 'Europe' },
  { code: 'ms', name: 'Montserrat', continent: 'North America' },
  { code: 'ma', name: 'Morocco', continent: 'Africa' },
  { code: 'mz', name: 'Mozambique', continent: 'Africa' },
  { code: 'mm', name: 'Myanmar', continent: 'Asia' },
  { code: 'na', name: 'Namibia', continent: 'Africa' },
  { code: 'nr', name: 'Nauru', continent: 'Oceania' },
  { code: 'np', name: 'Nepal', continent: 'Asia' },
  { code: 'nl', name: 'Netherlands', continent: 'Europe' },
  { code: 'nc', name: 'New Caledonia', continent: 'Oceania' },
  { code: 'nz', name: 'New Zealand', continent: 'Oceania' },
  { code: 'ni', name: 'Nicaragua', continent: 'North America' },
  { code: 'ne', name: 'Niger', continent: 'Africa' },
  { code: 'ng', name: 'Nigeria', continent: 'Africa' },
  { code: 'nu', name: 'Niue', continent: 'Oceania' },
  { code: 'mk', name: 'North Macedonia', continent: 'Europe' },
  { code: 'no', name: 'Norway', continent: 'Europe' },
  { code: 'om', name: 'Oman', continent: 'Asia' },
  { code: 'pk', name: 'Pakistan', continent: 'Asia' },
  { code: 'pw', name: 'Palau', continent: 'Oceania' },
  { code: 'ps', name: 'Palestine', continent: 'Asia' },
  { code: 'pa', name: 'Panama', continent: 'North America' },
  { code: 'pg', name: 'Papua New Guinea', continent: 'Oceania' },
  { code: 'py', name: 'Paraguay', continent: 'South America' },
  { code: 'pe', name: 'Peru', continent: 'South America' },
  { code: 'ph', name: 'Philippines', continent: 'Asia' },
  { code: 'pl', name: 'Poland', continent: 'Europe' },
  { code: 'pt', name: 'Portugal', continent: 'Europe' },
  { code: 'pr', name: 'Puerto Rico', continent: 'North America' },
  { code: 'qa', name: 'Qatar', continent: 'Asia' },
  { code: 're', name: 'Réunion', continent: 'Africa' },
  { code: 'ro', name: 'Romania', continent: 'Europe' },
  { code: 'ru', name: 'Russia', continent: 'Europe' },
  { code: 'rw', name: 'Rwanda', continent: 'Africa' },
  { code: 'ws', name: 'Samoa', continent: 'Oceania' },
  { code: 'sm', name: 'San Marino', continent: 'Europe' },
  { code: 'st', name: 'São Tomé and Príncipe', continent: 'Africa' },
  { code: 'sa', name: 'Saudi Arabia', continent: 'Asia' },
  { code: 'sn', name: 'Senegal', continent: 'Africa' },
  { code: 'rs', name: 'Serbia', continent: 'Europe' },
  { code: 'sc', name: 'Seychelles', continent: 'Africa' },
  { code: 'sl', name: 'Sierra Leone', continent: 'Africa' },
  { code: 'sg', name: 'Singapore', continent: 'Asia' },
  { code: 'sx', name: 'Sint Maarten', continent: 'North America' },
  { code: 'sk', name: 'Slovakia', continent: 'Europe' },
  { code: 'si', name: 'Slovenia', continent: 'Europe' },
  { code: 'sb', name: 'Solomon Islands', continent: 'Oceania' },
  { code: 'so', name: 'Somalia', continent: 'Africa' },
  { code: 'za', name: 'South Africa', continent: 'Africa' },
  { code: 'ss', name: 'South Sudan', continent: 'Africa' },
  { code: 'es', name: 'Spain', continent: 'Europe' },
  { code: 'lk', name: 'Sri Lanka', continent: 'Asia' },
  { code: 'sd', name: 'Sudan', continent: 'Africa' },
  { code: 'sr', name: 'Suriname', continent: 'South America' },
  { code: 'se', name: 'Sweden', continent: 'Europe' },
  { code: 'ch', name: 'Switzerland', continent: 'Europe' },
  { code: 'sy', name: 'Syria', continent: 'Asia' },
  { code: 'tw', name: 'Taiwan', continent: 'Asia' },
  { code: 'tj', name: 'Tajikistan', continent: 'Asia' },
  { code: 'tz', name: 'Tanzania', continent: 'Africa' },
  { code: 'th', name: 'Thailand', continent: 'Asia' },
  { code: 'tl', name: 'Timor-Leste', continent: 'Asia' },
  { code: 'tg', name: 'Togo', continent: 'Africa' },
  { code: 'tk', name: 'Tokelau', continent: 'Oceania' },
  { code: 'to', name: 'Tonga', continent: 'Oceania' },
  { code: 'tt', name: 'Trinidad and Tobago', continent: 'North America' },
  { code: 'tn', name: 'Tunisia', continent: 'Africa' },
  { code: 'tr', name: 'Turkey', continent: 'Asia' },
  { code: 'tm', name: 'Turkmenistan', continent: 'Asia' },
  { code: 'tc', name: 'Turks and Caicos Islands', continent: 'North America' },
  { code: 'tv', name: 'Tuvalu', continent: 'Oceania' },
  { code: 'ug', name: 'Uganda', continent: 'Africa' },
  { code: 'ua', name: 'Ukraine', continent: 'Europe' },
  { code: 'ae', name: 'United Arab Emirates', continent: 'Asia' },
  { code: 'gb', name: 'United Kingdom', continent: 'Europe' },
  { code: 'us', name: 'United States', continent: 'North America' },
  { code: 'uy', name: 'Uruguay', continent: 'South America' },
  { code: 'uz', name: 'Uzbekistan', continent: 'Asia' },
  { code: 'vu', name: 'Vanuatu', continent: 'Oceania' },
  { code: 'va', name: 'Vatican City', continent: 'Europe' },
  { code: 've', name: 'Venezuela', continent: 'South America' },
  { code: 'vn', name: 'Vietnam', continent: 'Asia' },
  { code: 'wf', name: 'Wallis and Futuna', continent: 'Oceania' },
  { code: 'eh', name: 'Western Sahara', continent: 'Africa' },
  { code: 'ye', name: 'Yemen', continent: 'Asia' },
  { code: 'zm', name: 'Zambia', continent: 'Africa' },
  { code: 'zw', name: 'Zimbabwe', continent: 'Africa' },
];
