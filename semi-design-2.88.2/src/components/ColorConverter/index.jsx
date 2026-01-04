import React, { useState } from 'react';
import { Input } from '@douyinfe/semi-ui';
import chroma from 'chroma-js';
import { palette, cssVars } from '../palette';
import { ColorBlock } from '../FullPalette';
import styles from './index.module.scss';
const getClosestColors = (color, palette, isRGB) => {
    const scores = [];
    for (let name in palette.light) {
        if (palette.light[name].includes('linear-gradient')) {
            continue;
        }
        const targetColor = isRGB ? palette.light[name]
            : `rgb(${palette.light[name]})`;
        const distance = chroma.distance(color, targetColor);

        scores.push({ distance, name });
    }

    const sorted = scores.sort((a, b) => a.distance - b.distance);

    const result = [];
    let min = sorted[0].distance;
    for (let i = 0; i < sorted.length; i++) {
        console.log(sorted[i], min);
        if (sorted[i].distance === min) {
            result.push({
                name: sorted[i].name,
                value: palette.light[sorted[i].name],
                distance: sorted[i].distance
            });
        } else {
            break;
        }
    }

    return result;
};
export default props => {
    const [inputColor, setInputColor] = useState('');
    const [results, setResults] = useState([]);

    const onInputChange = value => {
        setInputColor(value);
    };

    const convert = e => {

        const isValidColor = chroma.valid(inputColor);

        if (inputColor.trim().length === 0) {
            setResults([]);
            return;
        }

        if (!isValidColor) {
            return;
        }

        const paletteResult = getClosestColors(inputColor, palette, false);
        const cssVarsResult = getClosestColors(inputColor, cssVars, true);
        setResults([...cssVarsResult, ...paletteResult].sort((a, b) => a.distance - b.distance));
    };

    const renderResults = results => results.map(item => (<ColorBlock key={item.name} colorKey={item.name} colorVar={item.value} />));

    return (
        <div className={styles['color-converter']}>
            <Input
                value={inputColor}
                onChange={onInputChange}
                onKeyUp={convert}
                placeholder="输入颜色值"
                style={{ maxWidth: 300, marginBottom: 16 }}
                prefix="search"
            />
            <div className={styles['color-results']}>
                {results.length
                    ? renderResults(results) : ''}
            </div>
        </div>
    );
};
