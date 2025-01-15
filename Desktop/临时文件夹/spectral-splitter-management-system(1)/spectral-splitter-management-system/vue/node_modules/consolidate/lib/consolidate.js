'use strict';
/*
 * Engines which do not support caching of their file contents
 * should use the `read()` function defined in consolidate.js
 * On top of this, when an engine compiles to a `Function`,
 * these functions should either be cached within consolidate.js
 * or the engine itself via `options.cache`. This will allow
 * users and frameworks to pass `options.cache = true` for
 * `NODE_ENV=production`, however edit the file(s) without
 * re-loading the application in development.
 */

/**
 * Module dependencies.
 */

var fs = require('fs');
var path = require('path');
var Promise = require('bluebird');

var join = path.join;
var resolve = path.resolve;
var extname = path.extname;
var dirname = path.dirname;
var isAbsolute = path.isAbsolute;

var readCache = {};

/**
 * Require cache.
 */

var cacheStore = {};

/**
 * Require cache.
 */

var requires = {};

/**
 * Clear the cache.
 *
 * @api public
 */

exports.clearCache = function() {
  readCache = {};
  cacheStore = {};
};

/**
 * Conditionally cache `compiled` template based
 * on the `options` filename and `.cache` boolean.
 *
 * @param {Object} options
 * @param {Function} compiled
 * @return {Function}
 * @api private
 */

function cache(options, compiled) {
  // cachable
  if (compiled && options.filename && options.cache) {
    delete readCache[options.filename];
    cacheStore[options.filename] = compiled;
    return compiled;
  }

  // check cache
  if (options.filename && options.cache) {
    return cacheStore[options.filename];
  }

  return compiled;
}

/**
 * Read `path` with `options` with
 * callback `(err, str)`. When `options.cache`
 * is true the template string will be cached.
 *
 * @param {String} options
 * @param {Function} cb
 * @api private
 */

function read(path, options, cb) {
  var str = readCache[path];
  var cached = options.cache && str && typeof str === 'string';

  // cached (only if cached is a string and not a compiled template function)
  if (cached) return cb(null, str);

  // read
  fs.readFile(path, 'utf8', function(err, str) {
    if (err) return cb(err);
    // remove extraneous utf8 BOM marker
    str = str.replace(/^\uFEFF/, '');
    if (options.cache) readCache[path] = str;
    cb(null, str);
  });
}

/**
 * Read `path` with `options` with
 * callback `(err, str)`. When `options.cache`
 * is true the partial string will be cached.
 *
 * @param {String} options
 * @param {Function} fn
 * @api private
 */

function readPartials(path, options, cb) {
  if (!options.partials) return cb();
  var partials = options.partials;
  var keys = Object.keys(partials);

  function next(index) {
    if (index === keys.length) return cb(null);
    var key = keys[index];
    var partialPath = partials[key];

    if (partialPath === undefined || partialPath === null || partialPath === false) {
      return next(++index);
    }

    var file;
    if (isAbsolute(partialPath)) {
      if (extname(partialPath) !== '') {
        file = partialPath;
      } else {
        file = join(partialPath + extname(path));
      }
    } else {
      file = join(dirname(path), partialPath + extname(path));
    }

    read(file, options, function(err, str) {
      if (err) return cb(err);
      options.partials[key] = str;
      next(++index);
    });
  }

  next(0);
}

/**
 * promisify
 */
function promisify(cb, fn) {
  return new Promise(function(resolve, reject) {
    cb = cb || function(err, html) {
      if (err) {
        return reject(err);
      }
      resolve(html);
    };
    fn(cb);
  });
}

/**
 * fromStringRenderer
 */

function fromStringRenderer(name) {
  return function(path, options, cb) {
    options.filename = path;

    return promisify(cb, function(cb) {
      readPartials(path, options, function(err) {
        if (err) return cb(err);
        if (cache(options)) {
          exports[name].render('', options, cb);
        } else {
          read(path, options, function(err, str) {
            if (err) return cb(err);
            exports[name].render(str, options, cb);
          });
        }
      });
    });
  };
}

/**
 * velocity support.
 */

exports.velocityjs = fromStringRenderer('velocityjs');

/**
 * velocity string support.
 */

exports.velocityjs.render = function(str, options, cb) {
  return promisify(cb, function(cb) {
    var engine = requires.velocityjs || (requires.velocityjs = require('velocityjs'));
    try {
      options.locals = options;
      cb(null, engine.render(str, options).trimLeft());
    } catch (err) {
      cb(err);
    }
  });
};

/**
 * Liquid support.
 */

exports.liquid = fromStringRenderer('liquid');

/**
 * Liquid string support.
 */

/**
 * Note that in order to get filters and custom tags we've had to push
 * all user-defined locals down into @locals. However, just to make things
 * backwards-compatible, any property of `options` that is left after
 * processing and removing `locals`, `meta`, `filters`, `customTags` and
 * `includeDir` will also become a local.
 */

function _renderTinyliquid(engine, str, options, cb) {
  var context = engine.newContext();
  var k;

  /**
   * Note that there's a bug in the library that doesn't allow us to pass
   * the locals to newContext(), hence looping through the keys:
   */

  if (options.locals) {
    for (k in options.locals) {
      context.setLocals(k, options.locals[k]);
    }
    delete options.locals;
  }

  if (options.meta) {
    context.setLocals('page', options.meta);
    delete options.meta;
  }

  /**
   * Add any defined filters:
   */

  if (options.filters) {
    for (k in options.filters) {
      context.setFilter(k, options.filters[k]);
    }
    delete options.filters;
  }

  /**
   * Set up a callback for the include directory:
   */

  var includeDir = options.includeDir || process.cwd();

  context.onInclude(function(name, callback) {
    var extname = path.extname(name) ? '' : '.liquid';
    var filename = path.resolve(includeDir, name + extname);

    fs.readFile(filename, {encoding: 'utf8'}, function(err, data) {
      if (err) return callback(err);
      callback(null, engine.parse(data));
    });
  });
  delete options.includeDir;

  /**
   * The custom tag functions need to have their results pushed back
   * through the parser, so set up a shim before calling the provided
   * callback:
   */

  var compileOptions = {
    customTags: {}
  };

  if (options.customTags) {
    var tagFunctions = options.customTags;

    for (k in options.customTags) {
      /*Tell jshint there's no problem with having this function in the loop */
      /*jshint -W083 */
      compileOptions.customTags[k] = function(context, name, body) {
        var tpl = tagFunctions[name](body.trim());
        context.astStack.push(engine.parse(tpl));
      };
      /*jshint +W083 */
    }
    delete options.customTags;
  }

  /**
   * Now anything left in `options` becomes a local:
   */

  for (k in options) {
    context.setLocals(k, options[k]);
  }

  /**
   * Finally, execute the template:
   */

  var tmpl = cache(context) || cache(context, engine.compile(str, compileOptions));
  tmpl(context, cb);
}

exports.liquid.render = function(str, options, cb) {
  return promisify(cb, function(cb) {
    var engine = requires.liquid;
    var Liquid;

    try {
      // set up tinyliquid engine
      engine = requires.liquid = require('tinyliquid');

      // use tinyliquid engine
      _renderTinyliquid(engine, str, options, cb);

      return;

    } catch (err) {

      // set up liquid-node engine
      try {
        Liquid = requires.liquid = require('liquid-node');
        engine = new Liquid.Engine();
      } catch (err) {
        throw err;
      }

    }

    // use liquid-node engine
    try {
      var locals = options.locals || {};

      if (options.meta) {
        locals.pages = options.meta;
        delete options.meta;
      }

      /**
       * Add any defined filters:
       */

      if (options.filters) {
        engine.registerFilters(options.filters);
        delete options.filters;
      }

      /**
       * Set up a callback for the include directory:
       */

      var includeDir = options.includeDir || process.cwd();
      engine.fileSystem = new Liquid.LocalFileSystem(includeDir, 'liquid');
      delete options.includeDir;

      /**
       * The custom tag functions need to have their results pushed back
       * through the parser, so set up a shim before calling the provided
       * callback:
       */

      if (options.customTags) {
        var tagFunctions = options.customTags;

        for (k in options.customTags) {
          engine.registerTag(k, tagFunctions[k]);
        }
        delete options.customTags;
      }

      /**
       * Now anything left in `options` becomes a local:
       */

      for (var k in options) {
        locals[k] = options[k];
      }

      /**
       * Finally, execute the template:
       */

      return engine
        .parseAndRender(str, locals)
        .nodeify(function(err, result) {
          if (err) {
            throw new Error(err);
          } else {
            return cb(null, result);
          }
        });

    } catch (err) {
      cb(err);
    }
  });
};

/**
 * Jade support.
 */

exports.jade = function(path, options, cb) {
  return promisify(cb, function(cb) {
    var engine = requires.jade;
    if (!engine) {
      try {
        engine = requires.jade = require('jade');
      } catch (err) {
        try {
          engine = requires.jade = require('then-jade');
        } catch (otherError) {
          throw err;
        }
      }
    }

    try {
      var tmpl = cache(options) || cache(options, engine.compileFile(path, options));
      cb(null, tmpl(options));
    } catch (err) {
      cb(err);
    }
  });
};

/**
 * Jade string support.
 */

exports.jade.render = function(str, options, cb) {
  return promisify(cb, function(cb) {
    var engine = requires.jade;
    if (!engine) {
      try {
        engine = requires.jade = require('jade');
      } catch (err) {
        try {
          engine = requires.jade = require('then-jade');
        } catch (otherError) {
          throw err;
        }
      }
    }

    try {
      var tmpl = cache(options) || cache(options, engine.compile(str, options));
      cb(null, tmpl(options));
    } catch (err) {
      cb(err);
    }
  });
};

/**
 * Dust support.
 */

exports.dust = fromStringRenderer('dust');

/**
 * Dust string support.
 */

exports.dust.render = function(str, options, cb) {
  return promisify(cb, function(cb) {
    var engine = requires.dust;
    if (!engine) {
      try {
        engine = requires.dust = require('dust');
      } catch (err) {
        try {
          engine = requires.dust = require('dustjs-helpers');
        } catch (err) {
          engine = requires.dust = require('dustjs-linkedin');
        }
      }
    }

    var ext = 'dust';
    var views = '.';

    if (options) {
      if (options.ext) ext = options.ext;
      if (options.views) views = options.views;
      if (options.settings && options.settings.views) views = options.settings.views;
    }
    if (!options || (options && !options.cache)) engine.cache = {};

    engine.onLoad = function(path, callback) {
      if (extname(path) === '') path += '.' + ext;
      if (path[0] !== '/') path = views + '/' + path;
      read(path, options, callback);
    };

    try {
      var templateName;
      if (options.filename) {
        templateName = options.filename.replace(new RegExp('^' + views + '/'), '').replace(new RegExp('\\.' + ext), '');
      }

      var tmpl = cache(options) || cache(options, engine.compileFn(str, templateName));
      tmpl(options, cb);
    } catch (err) {
      cb(err);
    }
  });
};

/**
 * Swig support.
 */

exports.swig = fromStringRenderer('swig');

/**
 * Swig string support.
 */

exports.swig.render = function(str, options, cb) {
  return promisify(cb, function(cb) {
    var engine = requires.swig;
    if (!engine) {
      try {
        engine = requires.swig = require('swig');
      } catch (err) {
        try {
          engine = requires.swig = require('swig-templates');
        } catch (otherError) {
          throw err;
        }
      }
    }

    try {
      if (options.cache === true) options.cache = 'memory';
      engine.setDefaults({ cache: options.cache });
      var tmpl = cache(options) || cache(options, engine.compile(str, options));
      cb(null, tmpl(options));
    } catch (err) {
      cb(err);
    }
  });
};

/**
 * Atpl support.
 */

exports.atpl = fromStringRenderer('atpl');

/**
 * Atpl string support.
 */

exports.atpl.render = function(str, options, cb) {
  return promisify(cb, function(cb) {
    var engine = requires.atpl || (requires.atpl = require('atpl'));
    try {
      var tmpl = cache(options) || cache(options, engine.compile(str, options));
      cb(null, tmpl(options));
    } catch (err) {
      cb(err);
    }
  });
};

/**
 * Liquor support,
 */

exports.liquor = fromStringRenderer('liquor');

/**
 * Liquor string support.
 */

exports.liquor.render = function(str, options, cb) {
  return promisify(cb, function(cb) {
    var engine = requires.liquor || (requires.liquor = require('liquor'));
    try {
      var tmpl = cache(options) || cache(options, engine.compile(str, options));
      cb(null, tmpl(options));
    } catch (err) {
      cb(err);
    }
  });
};

/**
 * Twig support.
 */

exports.twig = fromStringRenderer('twig');

/**
 * Twig string support.
 */

exports.twig.render = function(str, options, cb) {
  return promisify(cb, function(cb) {
    var engine = requires.twig || (requires.twig = require('twig').twig);
    var templateData = {
      data: str
    };
    try {
      var tmpl = cache(templateData) || cache(templateData, engine(templateData));
      cb(null, tmpl.render(options));
    } catch (err) {
      cb(err);
    }
  });
};

/**
 * EJS support.
 */

exports.ejs = fromStringRenderer('ejs');

/**
 * EJS string support.
 */

exports.ejs.render = function(str, options, cb) {
  return promisify(cb, function(cb) {
    var engine = requires.ejs || (requires.ejs = require('ejs'));
    try {
      var tmpl = cache(options) || cache(options, engine.compile(str, options));
      cb(null, tmpl(options));
    } catch (err) {
      cb(err);
    }
  });
};

/**
 * Eco support.
 */

exports.eco = fromStringRenderer('eco');

/**
 * Eco string support.
 */

exports.eco.render = function(str, options, cb) {
  return promisify(cb, function(cb) {
    var engine = requires.eco || (requires.eco = require('eco'));
    try {
      cb(null, engine.render(str, options));
    } catch (err) {
      cb(err);
    }
  });
};

/**
 * Jazz support.
 */

exports.jazz = fromStringRenderer('jazz');

/**
 * Jazz string support.
 */

exports.jazz.render = function(str, options, cb) {
  return promisify(cb, function(cb) {
    var engine = requires.jazz || (requires.jazz = require('jazz'));
    try {
      var tmpl = cache(options) || cache(options, engine.compile(str, options));
      tmpl.eval(options, function(str) {
        cb(null, str);
      });
    } catch (err) {
      cb(err);
    }
  });
};

/**
 * JQTPL support.
 */

exports.jqtpl = fromStringRenderer('jqtpl');

/**
 * JQTPL string support.
 */

exports.jqtpl.render = function(str, options, cb) {
  return promisify(cb, function(cb) {
    var engine = requires.jqtpl || (requires.jqtpl = require('jqtpl'));
    try {
      engine.template(str, str);
      cb(null, engine.tmpl(str, options));
    } catch (err) {
      cb(err);
    }
  });
};

/**
 * Haml support.
 */

exports.haml = fromStringRenderer('haml');

/**
 * Haml string support.
 */

exports.haml.render = function(str, options, cb) {
  return promisify(cb, function(cb) {
    var engine = requires.haml || (requires.haml = require('hamljs'));
    try {
      options.locals = options;
      cb(null, engine.render(str, options).trimLeft());
    } catch (err) {
      cb(err);
    }
  });
};

/**
 * Hamlet support.
 */

exports.hamlet = fromStringRenderer('hamlet');

/**
 * Hamlet string support.
 */

exports.hamlet.render = function(str, options, cb) {
  return promisify(cb, function(cb) {
    var engine = requires.hamlet || (requires.hamlet = require('hamlet'));
    try {
      options.locals = options;
      cb(null, engine.render(str, options).trimLeft());
    } catch (err) {
      cb(err);
    }
  });
};

/**
 * Whiskers support.
 */

exports.whiskers = function(path, options, cb) {
  return promisify(cb, function(cb) {
    var engine = requires.whiskers || (requires.whiskers = require('whiskers'));
    engine.__express(path, options, cb);
  });
};

/**
 * Whiskers string support.
 */

exports.whiskers.render = function(str, options, cb) {
  return promisify(cb, function(cb) {
    var engine = requires.whiskers || (requires.whiskers = require('whiskers'));
    try {
      cb(null, engine.render(str, options));
    } catch (err) {
      cb(err);
    }
  });
};

/**
 * Coffee-HAML support.
 */

exports['haml-coffee'] = fromStringRenderer('haml-coffee');

/**
 * Coffee-HAML string support.
 */

exports['haml-coffee'].render = function(str, options, cb) {
  return promisify(cb, function(cb) {
    var engine = requires['haml-coffee'] || (requires['haml-coffee'] = require('haml-coffee'));
    try {
      var tmpl = cache(options) || cache(options, engine.compile(str, options));
      cb(null, tmpl(options));
    } catch (err) {
      cb(err);
    }
  });
};

/**
 * Hogan support.
 */

exports.hogan = fromStringRenderer('hogan');

/**
 * Hogan string support.
 */

exports.hogan.render = function(str, options, cb) {
  return promisify(cb, function(cb) {
    var engine = requires.hogan || (requires.hogan = require('hogan.js'));
    try {
      var tmpl = cache(options) || cache(options, engine.compile(str, options));
      cb(null, tmpl.render(options, options.partials));
    } catch (err) {
      cb(err);
    }
  });
};

/**
 * templayed.js support.
 */

exports.templayed = fromStringRenderer('templayed');

/**
 * templayed.js string support.
 */

exports.templayed.render = function(str, options, cb) {
  return promisify(cb, function(cb) {
    var engine = requires.templayed || (requires.templayed = require('templayed'));
    try {
      var tmpl = cache(options) || cache(options, engine(str));
      cb(null, tmpl(options));
    } catch (err) {
      cb(err);
    }
  });
};

/**
 * Handlebars support.
 */

exports.handlebars = fromStringRenderer('handlebars');

/**
 * Handlebars string support.
 */

exports.handlebars.render = function(str, options, cb) {
  return promisify(cb, function(cb) {
    var engine = requires.handlebars || (requires.handlebars = require('handlebars'));
    try {
      for (var partial in options.partials) {
        engine.registerPartial(partial, options.partials[partial]);
      }
      for (var helper in options.helpers) {
        engine.registerHelper(helper, options.helpers[helper]);
      }
      var tmpl = cache(options) || cache(options, engine.compile(str, options));
      cb(null, tmpl(options));
    } catch (err) {
      cb(err);
    }
  });
};

/**
 * Underscore support.
 */

exports.underscore = fromStringRenderer('underscore');

/**
 * Underscore string support.
 */

exports.underscore.render = function(str, options, cb) {
  return promisify(cb, function(cb) {
    var engine = requires.underscore || (requires.underscore = require('underscore'));
    try {
      for (var partial in options.partials) {
        options.partials[partial] = engine.template(options.partials[partial]);
      }
      var tmpl = cache(options) || cache(options, engine.template(str, null, options));
      cb(null, tmpl(options).replace(/\n$/, ''));
    } catch (err) {
      cb(err);
    }
  });
};

/**
 * Lodash support.
 */

exports.lodash = fromStringRenderer('lodash');

/**
 * Lodash string support.
 */

exports.lodash.render = function(str, options, cb) {
  return promisify(cb, function(cb) {
    var engine = requires.lodash || (requires.lodash = require('lodash'));
    try {
      var tmpl = cache(options) || cache(options, engine.template(str, options));
      cb(null, tmpl(options).replace(/\n$/, ''));
    } catch (err) {
      cb(err);
    }
  });
};

/**
 * Pug support. (formerly Jade)
 */

exports.pug = function(path, options, cb) {
  return promisify(cb, function(cb) {
    var engine = requires.pug;
    if (!engine) {
      try {
        engine = requires.pug = require('pug');
      } catch (err) {
        try {
          engine = requires.pug = require('then-pug');
        } catch (otherError) {
          throw err;
        }
      }
    }

    try {
      var tmpl = cache(options) || cache(options, engine.compileFile(path, options));
      cb(null, tmpl(options));
    } catch (err) {
      cb(err);
    }
  });
};

/**
 * Pug string support.
 */

exports.pug.render = function(str, options, cb) {
  return promisify(cb, function(cb) {
    var engine = requires.pug;
    if (!engine) {
      try {
        engine = requires.pug = require('pug');
      } catch (err) {
        try {
          engine = requires.pug = require('then-pug');
        } catch (otherError) {
          throw err;
        }
      }
    }

    try {
      var tmpl = cache(options) || cache(options, engine.compile(str, options));
      cb(null, tmpl(options));
    } catch (err) {
      cb(err);
    }
  });
};

/**
 * QEJS support.
 */

exports.qejs = fromStringRenderer('qejs');

/**
 * QEJS string support.
 */

exports.qejs.render = function(str, options, cb) {
  return promisify(cb, function(cb) {
    try {
      var engine = requires.qejs || (requires.qejs = require('qejs'));
      engine.render(str, options).then(function(result) {
        cb(null, result);
      }, function(err) {
        cb(err);
      }).done();
    } catch (err) {
      cb(err);
    }
  });
};

/**
 * Walrus support.
 */

exports.walrus = fromStringRenderer('walrus');

/**
 * Walrus string support.
 */

exports.walrus.render = function(str, options, cb) {
  return promisify(cb, function(cb) {
    var engine = requires.walrus || (requires.walrus = require('walrus'));
    try {
      var tmpl = cache(options) || cache(options, engine.parse(str));
      cb(null, tmpl.compile(options));
    } catch (err) {
      cb(err);
    }
  });
};

/**
 * Mustache support.
 */

exports.mustache = fromStringRenderer('mustache');

/**
 * Mustache string support.
 */

exports.mustache.render = function(str, options, cb) {
  return promisify(cb, function(cb) {
    var engine = requires.mustache || (requires.mustache = require('mustache'));
    try {
      cb(null, engine.to_html(str, options, options.partials));
    } catch (err) {
      cb(err);
    }
  });
};

/**
 * Just support.
 */

exports.just = function(path, options, cb) {
  return promisify(cb, function(cb) {
    var engine = requires.just;
    if (!engine) {
      var JUST = require('just');
      engine = requires.just = new JUST();
    }
    engine.configure({ useCache: options.cache });
    engine.render(path, options, cb);
  });
};

/**
 * Just string support.
 */

exports.just.render = function(str, options, cb) {
  return promisify(cb, function(cb) {
    var JUST = require('just');
    var engine = new JUST({ root: { page: str }});
    engine.render('page', options, cb);
  });
};

/**
 * ECT support.
 */

exports.ect = function(path, options, cb) {
  return promisify(cb, function(cb) {
    var engine = requires.ect;
    if (!engine) {
      var ECT = require('ect');
      engine = requires.ect = new ECT(options);
    }
    engine.configure({ cache: options.cache });
    engine.render(path, options, cb);
  });
};

/**
 * ECT string support.
 */

exports.ect.render = function(str, options, cb) {
  return promisify(cb, function(cb) {
    var ECT = require('ect');
    var engine = new ECT({ root: { page: str }});
    engine.render('page', options, cb);
  });
};

/**
 * mote support.
 */

exports.mote = fromStringRenderer('mote');

/**
 * mote string support.
 */

exports.mote.render = function(str, options, cb) {
  return promisify(cb, function(cb) {
    var engine = requires.mote || (requires.mote = require('mote'));
    try {
      var tmpl = cache(options) || cache(options, engine.compile(str));
      cb(null, tmpl(options));
    } catch (err) {
      cb(err);
    }
  });
};

/**
 * Toffee support.
 */

exports.toffee = function(path, options, cb) {
  return promisify(cb, function(cb) {
    var toffee = requires.toffee || (requires.toffee = require('toffee'));
    toffee.__consolidate_engine_render(path, options, cb);
  });
};

/**
 * Toffee string support.
 */

exports.toffee.render = function(str, options, cb) {
  return promisify(cb, function(cb) {
    var engine = requires.toffee || (requires.toffee = require('toffee'));
    try {
      engine.str_render(str, options, cb);
    } catch (err) {
      cb(err);
    }
  });
};

/**
 * doT support.
 */

exports.dot = fromStringRenderer('dot');

/**
 * doT string support.
 */

exports.dot.render = function(str, options, cb) {
  return promisify(cb, function(cb) {
    var engine = requires.dot || (requires.dot = require('dot'));
    var extend = (requires.extend || (requires.extend = require('util')._extend));
    try {
      var settings = {};
      settings = extend(settings, engine.templateSettings);
      settings = extend(settings, options ? options.dot : {});
      var tmpl = cache(options) || cache(options, engine.template(str, settings, options));
      cb(null, tmpl(options));
    } catch (err) {
      cb(err);
    }
  });
};

/**
 * bracket support.
 */

exports.bracket = fromStringRenderer('bracket');

/**
 * bracket string support.
 */

exports.bracket.render = function(str, options, cb) {
  return promisify(cb, function(cb) {
    var engine = requires.bracket || (requires.bracket = require('bracket-template'));
    try {
      var tmpl = cache(options) || cache(options, engine.default.compile(str, options));
      cb(null, tmpl(options));
    } catch (err) {
      cb(err);
    }
  });
};

/**
 * Ractive support.
 */

exports.ractive = fromStringRenderer('ractive');

/**
 * Ractive string support.
 */

exports.ractive.render = function(str, options, cb) {
  return promisify(cb, function(cb) {
    var Engine = requires.ractive || (requires.ractive = require('ractive'));

    var template = cache(options) || cache(options, Engine.parse(str));
    options.template = template;

    if (options.data === null || options.data === undefined) {
      var extend = (requires.extend || (requires.extend = require('util')._extend));

      // Shallow clone the options object
      options.data = extend({}, options);

      // Remove consolidate-specific properties from the clone
      var i;
      var length;
      var properties = ['template', 'filename', 'cache', 'partials'];
      for (i = 0, length = properties.length; i < length; i++) {
        var property = properties[i];
        delete options.data[property];
      }
    }

    try {
      cb(null, new Engine(options).toHTML());
    } catch (err) {
      cb(err);
    }
  });
};

/**
 * Nunjucks support.
 */

exports.nunjucks = fromStringRenderer('nunjucks');

/**
 * Nunjucks string support.
 */

exports.nunjucks.render = function(str, options, cb) {
  return promisify(cb, function(cb) {

    try {

      var engine = options.nunjucksEnv || requires.nunjucks || (requires.nunjucks = require('nunjucks'));

      var env = engine;

      // deprecated fallback support for express
      // <https://github.com/tj/consolidate.js/pull/152>
      // <https://github.com/tj/consolidate.js/pull/224>
      if (options.settings && options.settings.views) {
        env = engine.configure(options.settings.views);
      } else if (options.nunjucks && options.nunjucks.configure) {
        env = engine.configure.apply(engine, options.nunjucks.configure);
      }

      //
      // because `renderString` does not initiate loaders
      // we must manually create a loader for it based off
      // either `options.settings.views` or `options.nunjucks` or `options.nunjucks.root`
      //
      // <https://github.com/mozilla/nunjucks/issues/730>
      // <https://github.com/crocodilejs/node-email-templates/issues/182>
      //

      // so instead we simply check if we passed a custom loader
      // otherwise we create a simple file based loader
      if (options.loader) {
        env = new engine.Environment(options.loader);
      } else if (options.settings && options.settings.views) {
        env = new engine.Environment(
          new engine.FileSystemLoader(options.settings.views)
        );
      } else if (options.nunjucks && options.nunjucks.loader) {
        if (typeof options.nunjucks.loader === 'string') {
          env = new engine.Environment(new engine.FileSystemLoader(options.nunjucks.loader));
        } else {
          env = new engine.Environment(
            new engine.FileSystemLoader(
              options.nunjucks.loader[0],
              options.nunjucks.loader[1]
            )
          );
        }
      }

      env.renderString(str, options, cb);
    } catch (err) {
      throw cb(err);
    }
  });
};

/**
 * HTMLing support.
 */

exports.htmling = fromStringRenderer('htmling');

/**
 * HTMLing string support.
 */

exports.htmling.render = function(str, options, cb) {
  return promisify(cb, function(cb) {
    var engine = requires.htmling || (requires.htmling = require('htmling'));
    try {
      var tmpl = cache(options) || cache(options, engine.string(str));
      cb(null, tmpl.render(options));
    } catch (err) {
      cb(err);
    }
  });
};

/**
 *  Rendering function
 */
function requireReact(module, filename) {
  var babel = requires.babel || (requires.babel = require('babel-core'));

  var compiled = babel.transformFileSync(filename, { presets: [ 'react' ] }).code;

  return module._compile(compiled, filename);
}

exports.requireReact = requireReact;

/**
 *  Converting a string into a node module.
 */
function requireReactString(src, filename) {
  var babel = requires.babel || (requires.babel = require('babel-core'));

  if (!filename) filename = '';
  var m = new module.constructor();
  filename = filename || '';

  // Compile Using React
  var compiled = babel.transform(src, { presets: [ 'react' ] }).code;

  // Compile as a module
  m.paths = module.paths;
  m._compile(compiled, filename);

  return m.exports;
}

/**
 * A naive helper to replace {{tags}} with options.tags content
 */
function reactBaseTmpl(data, options) {

  var exp;
  var regex;

  // Iterates through the keys in file object
  // and interpolate / replace {{key}} with it's value
  for (var k in options) {
    if (options.hasOwnProperty(k)) {
      exp = '{{' + k + '}}';
      regex = new RegExp(exp, 'g');
      if (data.match(regex)) {
        data = data.replace(regex, options[k]);
      }
    }
  }

  return data;
}

/**
* Plates Support.
*/

exports.plates = fromStringRenderer('plates');

/**
* Plates string support.
*/

exports.plates.render = function(str, options, cb) {
  return promisify(cb, function(cb) {
    var engine = requires.plates || (requires.plates = require('plates'));
    var map = options.map || undefined;
    try {
      var tmpl = engine.bind(str, options, map);
      cb(null, tmpl);
    } catch (err) {
      cb(err);
    }
  });
};

/**
 *  The main render parser for React bsaed templates
 */
function reactRenderer(type) {

  if (require.extensions) {

    // Ensure JSX is transformed on require
    if (!require.extensions['.jsx']) {
      require.extensions['.jsx'] = requireReact;
    }

    // Supporting .react extension as well as test cases
    // Using .react extension is not recommended.
    if (!require.extensions['.react']) {
      require.extensions['.react'] = requireReact;
    }

  }

  // Return rendering fx
  return function(str, options, cb) {
    return promisify(cb, function(cb) {
      // React Import
      var ReactDOM = requires.ReactDOM || (requires.ReactDOM = require('react-dom/server'));
      var react = requires.react || (requires.react = require('react'));

      // Assign HTML Base
      var base = options.base;
      delete options.base;

      var enableCache = options.cache;
      delete options.cache;

      var isNonStatic = options.isNonStatic;
      delete options.isNonStatic;

      // Start Conversion
      try {

        var Code;
        var Factory;

        var baseStr;
        var content;
        var parsed;

        if (!cache(options)) {
          // Parsing
          if (type === 'path') {
            var path = resolve(str);
            delete require.cache[path];
            Code = require(path);
          } else {
            Code = requireReactString(str);
          }
          Factory = cache(options, react.createFactory(Code));

        } else {
          Factory = cache(options);
        }

        parsed = new Factory(options);
        content = (isNonStatic) ? ReactDOM.renderToString(parsed) : ReactDOM.renderToStaticMarkup(parsed);

        if (base) {
          baseStr = readCache[str] || fs.readFileSync(resolve(base), 'utf8');

          if (enableCache) {
            readCache[str] = baseStr;
          }

          options.content = content;
          content = reactBaseTmpl(baseStr, options);
        }

        cb(null, content);

      } catch (err) {
        cb(err);
      }
    });
  };
}

/**
 * React JS Support
 */
exports.react = reactRenderer('path');

/**
 * React JS string support.
 */
exports.react.render = reactRenderer('string');

/**
 * ARC-templates support.
 */

exports['arc-templates'] = fromStringRenderer('arc-templates');

/**
 * ARC-templates string support.
 */

exports['arc-templates'].render = function(str, options, cb) {
  var readFileWithOptions = Promise.promisify(read);
  var consolidateFileSystem = {};
  consolidateFileSystem.readFile = function(path) {
    return readFileWithOptions(path, options);
  };

  return promisify(cb, function(cb) {
    try {
      var engine = requires['arc-templates'];
      if (!engine) {
        var Engine = require('arc-templates/dist/es5');
        engine = requires['arc-templates'] = new Engine({ filesystem: consolidateFileSystem });
      }

      var compiler = cache(options) || cache(options, engine.compileString(str, options.filename));
      compiler.then(function(func) { return func(options); })
        .then(function(result) { cb(null, result.content); })
        .catch(cb);
    } catch (err) {
      cb(err);
    }
  });
};

/**
 * Vash support
 */
exports.vash = fromStringRenderer('vash');

/**
 * Vash string support
 */
exports.vash.render = function(str, options, cb) {
  return promisify(cb, function(cb) {
    var engine = requires.vash || (requires.vash = require('vash'));

    try {
      // helper system : https://github.com/kirbysayshi/vash#helper-system
      if (options.helpers) {
        for (var key in options.helpers) {
          if (!options.helpers.hasOwnProperty(key) || typeof options.helpers[key] !== 'function') {
            continue;
          }
          engine.helpers[key] = options.helpers[key];
        }
      }

      var tmpl = cache(options) || cache(options, engine.compile(str, options));
      tmpl(options, function sealLayout(err, ctx) {
        if (err) cb(err);
        ctx.finishLayout();
        cb(null, ctx.toString().replace(/\n$/, ''));
      });
    } catch (err) {
      cb(err);
    }
  });
};

/**
 * Slm support.
 */

exports.slm = fromStringRenderer('slm');

/**
 * Slm string support.
 */

exports.slm.render = function(str, options, cb) {
  return promisify(cb, function(cb) {
    var engine = requires.slm || (requires.slm = require('slm'));

    try {
      var tmpl = cache(options) || cache(options, engine.compile(str, options));
      cb(null, tmpl(options));
    } catch (err) {
      cb(err);
    }
  });
};

/**
 * Marko support.
 */

exports.marko = function(path, options, cb) {
  return promisify(cb, function(cb) {
    var engine = requires.marko || (requires.marko = require('marko'));
    options.writeToDisk = !!options.cache;

    try {
      var tmpl = cache(options) || cache(options, engine.load(path, options));
      tmpl.renderToString(options, cb);
    } catch (err) {
      cb(err);
    }
  });
};

/**
 * Marko string support.
 */

exports.marko.render = function(str, options, cb) {
  return promisify(cb, function(cb) {
    var engine = requires.marko || (requires.marko = require('marko'));
    options.writeToDisk = !!options.cache;
    options.filename = options.filename || 'string.marko';

    try {
      var tmpl = cache(options) || cache(options, engine.load(options.filename, str, options));
      tmpl.renderToString(options, cb);
    } catch (err) {
      cb(err);
    }
  });
};

/**
 * Teacup support.
 */
exports.teacup = function(path, options, cb) {
  return promisify(cb, function(cb) {
    var engine = requires.teacup || (requires.teacup = require('teacup/lib/express'));
    require.extensions['.teacup'] = require.extensions['.coffee'];
    if (path[0] !== '/') {
      path = join(process.cwd(), path);
    }
    if (!options.cache) {
      var callback = cb;
      cb = function() {
        delete require.cache[path];
        callback.apply(this, arguments);
      };
    }
    engine.renderFile(path, options, cb);
  });
};

/**
 * Teacup string support.
 */
exports.teacup.render = function(str, options, cb) {
  var coffee = require('coffee-script');
  var vm = require('vm');
  var sandbox = {
    module: {exports: {}},
    require: require
  };
  return promisify(cb, function(cb) {
    vm.runInNewContext(coffee.compile(str), sandbox);
    var tmpl = sandbox.module.exports;
    cb(null, tmpl(options));
  });
};

/**
 * expose the instance of the engine
 */
exports.requires = requires;
