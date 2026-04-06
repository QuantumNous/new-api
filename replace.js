const fs = require('fs');
let content = fs.readFileSync('web/src/pages/CreativeCenter/index.jsx', 'utf8');

content = content.replace(/indigo-600/g, 'blue-600');
content = content.replace(/indigo-500/g, 'blue-500');
content = content.replace(/indigo-400/g, 'blue-400');
content = content.replace(/indigo-300/g, 'blue-300');
content = content.replace(/indigo-200/g, 'blue-200');
content = content.replace(/indigo-100/g, 'blue-100');
content = content.replace(/indigo-50/g, 'blue-50');
content = content.replace(/purple-600/g, 'sky-500');
content = content.replace(/purple-500/g, 'sky-400');
content = content.replace(/99,102,241/g, '59,130,246'); // indigo-500 to blue-500

fs.writeFileSync('web/src/pages/CreativeCenter/index.jsx', content, 'utf8');
console.log('Done replacing colors.');
