const iconMap = {};

const req = require.context('@svgr/webpack?dimensions=true&icon=true!.', false, /.svg$/);
req.keys().forEach(id => {
    const x = req(id).default;
    const svgName = id.replace('./', '').replace('.svg', '');
    iconMap[svgName] = x;
});

export default iconMap;