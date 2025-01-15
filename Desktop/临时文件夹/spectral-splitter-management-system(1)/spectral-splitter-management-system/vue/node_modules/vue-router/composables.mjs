/*!
  * vue-router v3.6.5
  * (c) 2022 Evan You
  * @license MIT
  */
import { getCurrentInstance, effectScope, shallowReactive, onUnmounted, computed, unref } from 'vue';

// dev only warn if no current instance

function throwNoCurrentInstance (method) {
  if (!getCurrentInstance()) {
    throw new Error(
      ("[vue-router]: Missing current instance. " + method + "() must be called inside <script setup> or setup().")
    )
  }
}

function useRouter () {
  if (process.env.NODE_ENV !== 'production') {
    throwNoCurrentInstance('useRouter');
  }

  return getCurrentInstance().proxy.$root.$router
}

function useRoute () {
  if (process.env.NODE_ENV !== 'production') {
    throwNoCurrentInstance('useRoute');
  }

  var root = getCurrentInstance().proxy.$root;
  if (!root._$route) {
    var route = effectScope(true).run(function () { return shallowReactive(Object.assign({}, root.$router.currentRoute)); }
    );
    root._$route = route;

    root.$router.afterEach(function (to) {
      Object.assign(route, to);
    });
  }

  return root._$route
}

function onBeforeRouteUpdate (guard) {
  if (process.env.NODE_ENV !== 'production') {
    throwNoCurrentInstance('onBeforeRouteUpdate');
  }

  return useFilteredGuard(guard, isUpdateNavigation)
}
function isUpdateNavigation (to, from, depth) {
  var toMatched = to.matched;
  var fromMatched = from.matched;
  return (
    toMatched.length >= depth &&
    toMatched
      .slice(0, depth + 1)
      .every(function (record, i) { return record === fromMatched[i]; })
  )
}

function isLeaveNavigation (to, from, depth) {
  var toMatched = to.matched;
  var fromMatched = from.matched;
  return toMatched.length < depth || toMatched[depth] !== fromMatched[depth]
}

function onBeforeRouteLeave (guard) {
  if (process.env.NODE_ENV !== 'production') {
    throwNoCurrentInstance('onBeforeRouteLeave');
  }

  return useFilteredGuard(guard, isLeaveNavigation)
}

var noop = function () {};
function useFilteredGuard (guard, fn) {
  var instance = getCurrentInstance();
  var router = useRouter();

  var target = instance.proxy;
  // find the nearest RouterView to know the depth
  while (
    target &&
    target.$vnode &&
    target.$vnode.data &&
    target.$vnode.data.routerViewDepth == null
  ) {
    target = target.$parent;
  }

  var depth =
    target && target.$vnode && target.$vnode.data
      ? target.$vnode.data.routerViewDepth
      : null;

  if (depth != null) {
    var removeGuard = router.beforeEach(function (to, from, next) {
      return fn(to, from, depth) ? guard(to, from, next) : next()
    });

    onUnmounted(removeGuard);
    return removeGuard
  }

  return noop
}

/*  */

function guardEvent (e) {
  // don't redirect with control keys
  if (e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) { return }
  // don't redirect when preventDefault called
  if (e.defaultPrevented) { return }
  // don't redirect on right click
  if (e.button !== undefined && e.button !== 0) { return }
  // don't redirect if `target="_blank"`
  if (e.currentTarget && e.currentTarget.getAttribute) {
    var target = e.currentTarget.getAttribute('target');
    if (/\b_blank\b/i.test(target)) { return }
  }
  // this may be a Weex event which doesn't have this method
  if (e.preventDefault) {
    e.preventDefault();
  }
  return true
}

function includesParams (outer, inner) {
  var loop = function ( key ) {
    var innerValue = inner[key];
    var outerValue = outer[key];
    if (typeof innerValue === 'string') {
      if (innerValue !== outerValue) { return { v: false } }
    } else {
      if (
        !Array.isArray(outerValue) ||
        outerValue.length !== innerValue.length ||
        innerValue.some(function (value, i) { return value !== outerValue[i]; })
      ) {
        return { v: false }
      }
    }
  };

  for (var key in inner) {
    var returned = loop( key );

    if ( returned ) return returned.v;
  }

  return true
}

// helpers from vue router 4

function isSameRouteLocationParamsValue (a, b) {
  return Array.isArray(a)
    ? isEquivalentArray(a, b)
    : Array.isArray(b)
      ? isEquivalentArray(b, a)
      : a === b
}

function isEquivalentArray (a, b) {
  return Array.isArray(b)
    ? a.length === b.length && a.every(function (value, i) { return value === b[i]; })
    : a.length === 1 && a[0] === b
}

function isSameRouteLocationParams (a, b) {
  if (Object.keys(a).length !== Object.keys(b).length) { return false }

  for (var key in a) {
    if (!isSameRouteLocationParamsValue(a[key], b[key])) { return false }
  }

  return true
}

function useLink (props) {
  if (process.env.NODE_ENV !== 'production') {
    throwNoCurrentInstance('useLink');
  }

  var router = useRouter();
  var currentRoute = useRoute();

  var resolvedRoute = computed(function () { return router.resolve(unref(props.to), currentRoute); });

  var activeRecordIndex = computed(function () {
    var route = resolvedRoute.value.route;
    var matched = route.matched;
    var length = matched.length;
    var routeMatched = matched[length - 1];
    var currentMatched = currentRoute.matched;
    if (!routeMatched || !currentMatched.length) { return -1 }
    var index = currentMatched.indexOf(routeMatched);
    if (index > -1) { return index }
    // possible parent record
    var parentRecord = currentMatched[currentMatched.length - 2];

    return (
      // we are dealing with nested routes
      length > 1 &&
        // if the parent and matched route have the same path, this link is
        // referring to the empty child. Or we currently are on a different
        // child of the same parent
        parentRecord && parentRecord === routeMatched.parent
    )
  });

  var isActive = computed(
    function () { return activeRecordIndex.value > -1 &&
      includesParams(currentRoute.params, resolvedRoute.value.route.params); }
  );
  var isExactActive = computed(
    function () { return activeRecordIndex.value > -1 &&
      activeRecordIndex.value === currentRoute.matched.length - 1 &&
      isSameRouteLocationParams(currentRoute.params, resolvedRoute.value.route.params); }
  );

  var navigate = function (e) {
    var href = resolvedRoute.value.route;
    if (guardEvent(e)) {
      return props.replace
        ? router.replace(href)
        : router.push(href)
    }
    return Promise.resolve()
  };

  return {
    href: computed(function () { return resolvedRoute.value.href; }),
    route: computed(function () { return resolvedRoute.value.route; }),
    isExactActive: isExactActive,
    isActive: isActive,
    navigate: navigate
  }
}

export { isSameRouteLocationParams, onBeforeRouteLeave, onBeforeRouteUpdate, useLink, useRoute, useRouter };
