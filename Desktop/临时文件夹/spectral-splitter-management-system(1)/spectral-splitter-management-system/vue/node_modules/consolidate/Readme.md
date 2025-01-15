# Consolidate.js

  Template engine consolidation library.

## Installation

    $ npm install consolidate

## Supported template engines

  - [atpl](https://github.com/soywiz/atpl.js)
  - [bracket](https://github.com/danlevan/bracket-template)
  - [doT.js](https://github.com/olado/doT) [(website)](http://olado.github.io/doT/)
  - [dust (unmaintained)](https://github.com/akdubya/dustjs) [(website)](http://akdubya.github.com/dustjs/)
  - [dustjs-linkedin (maintained fork of dust)](https://github.com/linkedin/dustjs) [(website)](http://linkedin.github.io/dustjs/)
  - [eco](https://github.com/sstephenson/eco)
  - [ect](https://github.com/baryshev/ect) [(website)](http://ectjs.com/)
  - [ejs](https://github.com/mde/ejs) [(website)](http://ejs.co/)
  - [haml](https://github.com/visionmedia/haml.js)
  - [haml-coffee](https://github.com/9elements/haml-coffee)
  - [hamlet](https://github.com/gregwebs/hamlet.js)
  - [handlebars](https://github.com/wycats/handlebars.js/) [(website)](http://handlebarsjs.com/)
  - [hogan](https://github.com/twitter/hogan.js) [(website)](http://twitter.github.com/hogan.js/)
  - [htmling](https://github.com/codemix/htmling)
  - [jade](https://github.com/visionmedia/jade) [(website)](http://jade-lang.com/)
  - [jazz](https://github.com/shinetech/jazz)
  - [jqtpl](https://github.com/kof/jqtpl)
  - [JUST](https://github.com/baryshev/just)
  - [liquor](https://github.com/chjj/liquor)
  - [lodash](https://github.com/bestiejs/lodash) [(website)](http://lodash.com/)
  - [marko](https://github.com/marko-js/marko) [(website)](http://markojs.com)
  - [mote](https://github.com/satchmorun/mote) [(website)](http://satchmorun.github.io/mote/)
  - [mustache](https://github.com/janl/mustache.js)
  - [nunjucks](https://github.com/mozilla/nunjucks) [(website)](https://mozilla.github.io/nunjucks)
  - [plates](https://github.com/flatiron/plates)
  - [pug (formerly jade)](https://github.com/pugjs/pug) [(website)](http://jade-lang.com/)
  - [QEJS](https://github.com/jepso/QEJS)
  - [ractive](https://github.com/Rich-Harris/Ractive)
  - [react](https://github.com/facebook/react)
  - [slm](https://github.com/slm-lang/slm)
  - [swig (unmaintained)](https://github.com/paularmstrong/swig)
  - [swig (maintained fork)](https://github.com/node-swig/swig-templates)
  - [teacup](https://github.com/goodeggs/teacup)
  - [templayed](http://archan937.github.com/templayed.js/)
  - [twig](https://github.com/justjohn/twig.js)
  - [liquid](https://github.com/leizongmin/tinyliquid) [(website)](http://liquidmarkup.org/)
  - [toffee](https://github.com/malgorithms/toffee)
  - [underscore](https://github.com/documentcloud/underscore) [(website)](http://underscorejs.org/#template)
  - [vash](https://github.com/kirbysayshi/vash)
  - [walrus](https://github.com/jeremyruppel/walrus) [(website)](http://documentup.com/jeremyruppel/walrus/)
  - [whiskers](https://github.com/gsf/whiskers.js)

__NOTE__: you must still install the engines you wish to use, add them to your package.json dependencies.

## API

  All templates supported by this library may be rendered using the signature `(path[, locals], callback)` as shown below, which happens to be the signature that Express 3.x supports so any of these engines may be used within Express.

__NOTE__: All this example code uses cons.swig for the swig template engine. Replace swig with whatever templating you are using. For example, use cons.hogan for hogan.js, cons.jade for jade, etc. `console.log(cons)` for the full list of identifiers.

```js
var cons = require('consolidate');
cons.swig('views/page.html', { user: 'tobi' }, function(err, html){
  if (err) throw err;
  console.log(html);
});
```

  Or without options / local variables:

```js
var cons = require('consolidate');
cons.swig('views/page.html', function(err, html){
  if (err) throw err;
  console.log(html);
});
```

  To dynamically pass the engine, simply use the subscript operator and a variable:

```js
var cons = require('consolidate')
  , name = 'swig';

cons[name]('views/page.html', { user: 'tobi' }, function(err, html){
  if (err) throw err;
  console.log(html);
});
```

### Promises

  Additionally, all templates optionally return a promise if no callback function is provided. The promise represents the eventual result of the template function which will either resolve to a string, compiled from the template, or be rejected. Promises expose a `then` method which registers callbacks to receive the promise’s eventual value and a `catch` method which the reason why the promise could not be fulfilled. Promises allow more synchronous-like code structure and solve issues like race conditions.

```js
var cons = require('consolidate');

cons.swig('views/page.html', { user: 'tobi' })
  .then(function (html) {
    console.log(html);
  })
  .catch(function (err) {
    throw err;
  });
```

## Caching

 To enable caching simply pass `{ cache: true }`. Engines _may_ use this option to cache things reading the file contents, compiled `Function`s etc. Engines which do _not_ support this may simply ignore it. All engines that consolidate.js implements I/O for will cache the file contents, ideal for production environments.
 When using consolidate directly: `cons.swig('views/page.html', { user: 'tobi', cache:true }, callback);`
 Using Express 3 or higher: `app.locals.cache = true` or set NODE_ENV to 'production' and Express will do this for you.

## Express 3.x example

```js
var express = require('express')
  , cons = require('consolidate')
  , app = express();

// assign the swig engine to .html files
app.engine('html', cons.swig);

// set .html as the default extension
app.set('view engine', 'html');
app.set('views', __dirname + '/views');

var users = [];
users.push({ name: 'tobi' });
users.push({ name: 'loki' });
users.push({ name: 'jane' });

app.get('/', function(req, res){
  res.render('index', {
    title: 'Consolidate.js'
  });
});

app.get('/users', function(req, res){
  res.render('users', {
    title: 'Users',
    users: users
  });
});

app.listen(3000);
console.log('Express server listening on port 3000');
```

## Template Engine Instances

Template engines are exposed via the `cons.requires` object, but they are not instantiated until you've called the `cons[engine].render()` method. You can instantiate them manually beforehand if you want to add filters, globals, mixins, or other engine features.

```js
var cons = require('consolidate'),
  nunjucks = require('nunjucks');

// add nunjucks to requires so filters can be
// added and the same instance will be used inside the render method
cons.requires.nunjucks = nunjucks.configure();

cons.requires.nunjucks.addFilter('foo', function () {
  return 'bar';
});
```

## Notes

* If you're using Nunjucks, please take a look at the `exports.nunjucks.render` function in `lib.consolidate.js`.  You can pass your own engine/environment via `options.nunjucksEnv`, or if you want to support Express you can pass `options.settings.views`, or if you have another use case, pass `options.nunjucks` (see the code for more insight).
* You can pass **partials** with `options.partials`
* For using **template inheritance** with nunjucks, you can pass a loader
  with `options.loader`.
* To use **filters** with tinyliquid, use `options.filters` and specify an array of properties, each of which is a named filter function. A filter function takes a string as a parameter and returns a modified version of it.
* To use **custom tags** with tinyliquid, use `options.customTags` to specify an array of tag functions that follow the tinyliquid [custom tag](https://github.com/leizongmin/tinyliquid/wiki/Custom-Tag) definition.
* The default directory used with the **include** tag with tinyliquid is the current working directory. To override this, use `options.includeDir`.
* `React` To render content into a html base template (eg. `index.html` of your React app), pass the path of the template with `options.base`.

## Running tests

  Install dev deps:

    $ npm install -d

  Run the tests:

    $ make test

## License

(The MIT License)

Copyright (c) 2011-2016 TJ Holowaychuk &lt;tj@vision-media.ca&gt;

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
