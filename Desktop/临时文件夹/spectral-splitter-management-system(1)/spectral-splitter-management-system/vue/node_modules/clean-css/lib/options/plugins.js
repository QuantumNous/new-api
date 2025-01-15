function pluginsFrom(plugins) {
  var flatPlugins = {
    level1Value: [],
    level1Property: [],
    level2Block: []
  };

  plugins = plugins || [];

  flatPlugins.level1Value = plugins
    .map(function(plugin) { return plugin.level1 && plugin.level1.value; })
    .filter(function(plugin) { return plugin != null; });

  flatPlugins.level1Property = plugins
    .map(function(plugin) { return plugin.level1 && plugin.level1.property; })
    .filter(function(plugin) { return plugin != null; });

  flatPlugins.level2Block = plugins
    .map(function(plugin) { return plugin.level2 && plugin.level2.block; })
    .filter(function(plugin) { return plugin != null; });

  return flatPlugins;
}

module.exports = pluginsFrom;
