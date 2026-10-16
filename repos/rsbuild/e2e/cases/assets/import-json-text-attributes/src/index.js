import dataText from './data.json' with { type: 'text' };
import data from './data.json' with { type: 'json' };

window.jsonText = dataText;
window.jsonValue = data.name;
