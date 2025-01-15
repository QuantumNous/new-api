
/*
* Licensed to the Apache Software Foundation (ASF) under one
* or more contributor license agreements.  See the NOTICE file
* distributed with this work for additional information
* regarding copyright ownership.  The ASF licenses this file
* to you under the Apache License, Version 2.0 (the
* "License"); you may not use this file except in compliance
* with the License.  You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing,
* software distributed under the License is distributed on an
* "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
* KIND, either express or implied.  See the License for the
* specific language governing permissions and limitations
* under the License.
*/


/**
 * AUTO-GENERATED FILE. DO NOT MODIFY.
 */

/*
* Licensed to the Apache Software Foundation (ASF) under one
* or more contributor license agreements.  See the NOTICE file
* distributed with this work for additional information
* regarding copyright ownership.  The ASF licenses this file
* to you under the Apache License, Version 2.0 (the
* "License"); you may not use this file except in compliance
* with the License.  You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing,
* software distributed under the License is distributed on an
* "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
* KIND, either express or implied.  See the License for the
* specific language governing permissions and limitations
* under the License.
*/
// Universal transitions that can animate between any shapes(series) and any properties in any amounts.
import { SERIES_UNIVERSAL_TRANSITION_PROP } from '../model/Series.js';
import { createHashMap, each, map, filter, isArray, extend } from 'zrender/lib/core/util.js';
import { applyMorphAnimation, getPathList } from './morphTransitionHelper.js';
import Path from 'zrender/lib/graphic/Path.js';
import { initProps } from '../util/graphic.js';
import DataDiffer from '../data/DataDiffer.js';
import { makeInner, normalizeToArray } from '../util/model.js';
import { warn } from '../util/log.js';
import { getAnimationConfig, getOldStyle } from './basicTrasition.js';
import Displayable from 'zrender/lib/graphic/Displayable.js';
var DATA_COUNT_THRESHOLD = 1e4;
;
var getUniversalTransitionGlobalStore = makeInner();

function getGroupIdDimension(data) {
  var dimensions = data.dimensions;

  for (var i = 0; i < dimensions.length; i++) {
    var dimInfo = data.getDimensionInfo(dimensions[i]);

    if (dimInfo && dimInfo.otherDims.itemGroupId === 0) {
      return dimensions[i];
    }
  }
}

function flattenDataDiffItems(list) {
  var items = [];
  each(list, function (seriesInfo) {
    var data = seriesInfo.data;

    if (data.count() > DATA_COUNT_THRESHOLD) {
      if (process.env.NODE_ENV !== 'production') {
        warn('Universal transition is disabled on large data > 10k.');
      }

      return;
    }

    var indices = data.getIndices();
    var groupDim = getGroupIdDimension(data);

    for (var dataIndex = 0; dataIndex < indices.length; dataIndex++) {
      items.push({
        data: data,
        dim: seriesInfo.dim || groupDim,
        divide: seriesInfo.divide,
        dataIndex: dataIndex
      });
    }
  });
  return items;
}

function fadeInElement(newEl, newSeries, newIndex) {
  newEl.traverse(function (el) {
    if (el instanceof Path) {
      // TODO use fade in animation for target element.
      initProps(el, {
        style: {
          opacity: 0
        }
      }, newSeries, {
        dataIndex: newIndex,
        isFrom: true
      });
    }
  });
}

function removeEl(el) {
  if (el.parent) {
    // Bake parent transform to element.
    // So it can still have proper transform to transition after it's removed.
    var computedTransform = el.getComputedTransform();
    el.setLocalTransform(computedTransform);
    el.parent.remove(el);
  }
}

function stopAnimation(el) {
  el.stopAnimation();

  if (el.isGroup) {
    el.traverse(function (child) {
      child.stopAnimation();
    });
  }
}

function animateElementStyles(el, dataIndex, seriesModel) {
  var animationConfig = getAnimationConfig('update', seriesModel, dataIndex);
  animationConfig && el.traverse(function (child) {
    if (child instanceof Displayable) {
      var oldStyle = getOldStyle(child);

      if (oldStyle) {
        child.animateFrom({
          style: oldStyle
        }, animationConfig);
      }
    }
  });
}

function isAllIdSame(oldDiffItems, newDiffItems) {
  var len = oldDiffItems.length;

  if (len !== newDiffItems.length) {
    return false;
  }

  for (var i = 0; i < len; i++) {
    var oldItem = oldDiffItems[i];
    var newItem = newDiffItems[i];

    if (oldItem.data.getId(oldItem.dataIndex) !== newItem.data.getId(newItem.dataIndex)) {
      return false;
    }
  }

  return true;
}

function transitionBetween(oldList, newList, api) {
  var oldDiffItems = flattenDataDiffItems(oldList);
  var newDiffItems = flattenDataDiffItems(newList);

  function updateMorphingPathProps(from, to, rawFrom, rawTo, animationCfg) {
    if (rawFrom || from) {
      to.animateFrom({
        style: rawFrom && rawFrom !== from ? // dividingMethod like clone may override the style(opacity)
        // So extend it to raw style.
        extend(extend({}, rawFrom.style), from.style) : from.style
      }, animationCfg);
    }
  }

  function findKeyDim(items) {
    for (var i = 0; i < items.length; i++) {
      if (items[i].dim) {
        return items[i].dim;
      }
    }
  }

  var oldKeyDim = findKeyDim(oldDiffItems);
  var newKeyDim = findKeyDim(newDiffItems);
  var hasMorphAnimation = false;

  function createKeyGetter(isOld, onlyGetId) {
    return function (diffItem) {
      var data = diffItem.data;
      var dataIndex = diffItem.dataIndex; // TODO if specified dim

      if (onlyGetId) {
        return data.getId(dataIndex);
      } // Use group id as transition key by default.
      // So we can achieve multiple to multiple animation like drilldown / up naturally.
      // If group id not exits. Use id instead. If so, only one to one transition will be applied.


      var dataGroupId = data.hostModel && data.hostModel.get('dataGroupId'); // If specified key dimension(itemGroupId by default). Use this same dimension from other data.
      // PENDING: If only use key dimension of newData.

      var keyDim = isOld ? oldKeyDim || newKeyDim : newKeyDim || oldKeyDim;
      var dimInfo = keyDim && data.getDimensionInfo(keyDim);
      var dimOrdinalMeta = dimInfo && dimInfo.ordinalMeta;

      if (dimInfo) {
        // Get from encode.itemGroupId.
        var key = data.get(dimInfo.name, dataIndex);

        if (dimOrdinalMeta) {
          return dimOrdinalMeta.categories[key] || key + '';
        }

        return key + '';
      } // Get groupId from raw item. { groupId: '' }


      var itemVal = data.getRawDataItem(dataIndex);

      if (itemVal && itemVal.groupId) {
        return itemVal.groupId + '';
      }

      return dataGroupId || data.getId(dataIndex);
    };
  } // Use id if it's very likely to be an one to one animation
  // It's more robust than groupId
  // TODO Check if key dimension is specified.


  var useId = isAllIdSame(oldDiffItems, newDiffItems);
  var isElementStillInChart = {};

  if (!useId) {
    // We may have different diff strategy with basicTransition if we use other dimension as key.
    // If so, we can't simply check if oldEl is same with newEl. We need a map to check if oldEl is still being used in the new chart.
    // We can't use the elements that already being morphed. Let it keep it's original basic transition.
    for (var i = 0; i < newDiffItems.length; i++) {
      var newItem = newDiffItems[i];
      var el = newItem.data.getItemGraphicEl(newItem.dataIndex);

      if (el) {
        isElementStillInChart[el.id] = true;
      }
    }
  }

  function updateOneToOne(newIndex, oldIndex) {
    var oldItem = oldDiffItems[oldIndex];
    var newItem = newDiffItems[newIndex];
    var newSeries = newItem.data.hostModel; // TODO Mark this elements is morphed and don't morph them anymore

    var oldEl = oldItem.data.getItemGraphicEl(oldItem.dataIndex);
    var newEl = newItem.data.getItemGraphicEl(newItem.dataIndex); // Can't handle same elements.

    if (oldEl === newEl) {
      newEl && animateElementStyles(newEl, newItem.dataIndex, newSeries);
      return;
    }

    if ( // We can't use the elements that already being morphed
    oldEl && isElementStillInChart[oldEl.id]) {
      return;
    }

    if (newEl) {
      // TODO: If keep animating the group in case
      // some of the elements don't want to be morphed.
      // TODO Label?
      stopAnimation(newEl);

      if (oldEl) {
        stopAnimation(oldEl); // If old element is doing leaving animation. stop it and remove it immediately.

        removeEl(oldEl);
        hasMorphAnimation = true;
        applyMorphAnimation(getPathList(oldEl), getPathList(newEl), newItem.divide, newSeries, newIndex, updateMorphingPathProps);
      } else {
        fadeInElement(newEl, newSeries, newIndex);
      }
    } // else keep oldEl leaving animation.

  }

  new DataDiffer(oldDiffItems, newDiffItems, createKeyGetter(true, useId), createKeyGetter(false, useId), null, 'multiple').update(updateOneToOne).updateManyToOne(function (newIndex, oldIndices) {
    var newItem = newDiffItems[newIndex];
    var newData = newItem.data;
    var newSeries = newData.hostModel;
    var newEl = newData.getItemGraphicEl(newItem.dataIndex);
    var oldElsList = filter(map(oldIndices, function (idx) {
      return oldDiffItems[idx].data.getItemGraphicEl(oldDiffItems[idx].dataIndex);
    }), function (oldEl) {
      return oldEl && oldEl !== newEl && !isElementStillInChart[oldEl.id];
    });

    if (newEl) {
      stopAnimation(newEl);

      if (oldElsList.length) {
        // If old element is doing leaving animation. stop it and remove it immediately.
        each(oldElsList, function (oldEl) {
          stopAnimation(oldEl);
          removeEl(oldEl);
        });
        hasMorphAnimation = true;
        applyMorphAnimation(getPathList(oldElsList), getPathList(newEl), newItem.divide, newSeries, newIndex, updateMorphingPathProps);
      } else {
        fadeInElement(newEl, newSeries, newItem.dataIndex);
      }
    } // else keep oldEl leaving animation.

  }).updateOneToMany(function (newIndices, oldIndex) {
    var oldItem = oldDiffItems[oldIndex];
    var oldEl = oldItem.data.getItemGraphicEl(oldItem.dataIndex); // We can't use the elements that already being morphed

    if (oldEl && isElementStillInChart[oldEl.id]) {
      return;
    }

    var newElsList = filter(map(newIndices, function (idx) {
      return newDiffItems[idx].data.getItemGraphicEl(newDiffItems[idx].dataIndex);
    }), function (el) {
      return el && el !== oldEl;
    });
    var newSeris = newDiffItems[newIndices[0]].data.hostModel;

    if (newElsList.length) {
      each(newElsList, function (newEl) {
        return stopAnimation(newEl);
      });

      if (oldEl) {
        stopAnimation(oldEl); // If old element is doing leaving animation. stop it and remove it immediately.

        removeEl(oldEl);
        hasMorphAnimation = true;
        applyMorphAnimation(getPathList(oldEl), getPathList(newElsList), oldItem.divide, // Use divide on old.
        newSeris, newIndices[0], updateMorphingPathProps);
      } else {
        each(newElsList, function (newEl) {
          return fadeInElement(newEl, newSeris, newIndices[0]);
        });
      }
    } // else keep oldEl leaving animation.

  }).updateManyToMany(function (newIndices, oldIndices) {
    // If two data are same and both have groupId.
    // Normally they should be diff by id.
    new DataDiffer(oldIndices, newIndices, function (rawIdx) {
      return oldDiffItems[rawIdx].data.getId(oldDiffItems[rawIdx].dataIndex);
    }, function (rawIdx) {
      return newDiffItems[rawIdx].data.getId(newDiffItems[rawIdx].dataIndex);
    }).update(function (newIndex, oldIndex) {
      // Use the original index
      updateOneToOne(newIndices[newIndex], oldIndices[oldIndex]);
    }).execute();
  }).execute();

  if (hasMorphAnimation) {
    each(newList, function (_a) {
      var data = _a.data;
      var seriesModel = data.hostModel;
      var view = seriesModel && api.getViewOfSeriesModel(seriesModel);
      var animationCfg = getAnimationConfig('update', seriesModel, 0); // use 0 index.

      if (view && seriesModel.isAnimationEnabled() && animationCfg && animationCfg.duration > 0) {
        view.group.traverse(function (el) {
          if (el instanceof Path && !el.animators.length) {
            // We can't accept there still exists element that has no animation
            // if universalTransition is enabled
            el.animateFrom({
              style: {
                opacity: 0
              }
            }, animationCfg);
          }
        });
      }
    });
  }
}

function getSeriesTransitionKey(series) {
  var seriesKey = series.getModel('universalTransition').get('seriesKey');

  if (!seriesKey) {
    // Use series id by default.
    return series.id;
  }

  return seriesKey;
}

function convertArraySeriesKeyToString(seriesKey) {
  if (isArray(seriesKey)) {
    // Order independent.
    return seriesKey.sort().join(',');
  }

  return seriesKey;
}

function getDivideShapeFromData(data) {
  if (data.hostModel) {
    return data.hostModel.getModel('universalTransition').get('divideShape');
  }
}

function findTransitionSeriesBatches(globalStore, params) {
  var updateBatches = createHashMap();
  var oldDataMap = createHashMap(); // Map that only store key in array seriesKey.
  // Which is used to query the old data when transition from one to multiple series.

  var oldDataMapForSplit = createHashMap();
  each(globalStore.oldSeries, function (series, idx) {
    var oldData = globalStore.oldData[idx];
    var transitionKey = getSeriesTransitionKey(series);
    var transitionKeyStr = convertArraySeriesKeyToString(transitionKey);
    oldDataMap.set(transitionKeyStr, oldData);

    if (isArray(transitionKey)) {
      // Same key can't in different array seriesKey.
      each(transitionKey, function (key) {
        oldDataMapForSplit.set(key, {
          data: oldData,
          key: transitionKeyStr
        });
      });
    }
  });

  function checkTransitionSeriesKeyDuplicated(transitionKeyStr) {
    if (updateBatches.get(transitionKeyStr)) {
      warn("Duplicated seriesKey in universalTransition " + transitionKeyStr);
    }
  }

  each(params.updatedSeries, function (series) {
    if (series.isUniversalTransitionEnabled() && series.isAnimationEnabled()) {
      var newData = series.getData();
      var transitionKey = getSeriesTransitionKey(series);
      var transitionKeyStr = convertArraySeriesKeyToString(transitionKey); // Only transition between series with same id.

      var oldData = oldDataMap.get(transitionKeyStr); // string transition key is the best match.

      if (oldData) {
        if (process.env.NODE_ENV !== 'production') {
          checkTransitionSeriesKeyDuplicated(transitionKeyStr);
        } // TODO check if data is same?


        updateBatches.set(transitionKeyStr, {
          oldSeries: [{
            divide: getDivideShapeFromData(oldData),
            data: oldData
          }],
          newSeries: [{
            divide: getDivideShapeFromData(newData),
            data: newData
          }]
        });
      } else {
        // Transition from multiple series.
        if (isArray(transitionKey)) {
          if (process.env.NODE_ENV !== 'production') {
            checkTransitionSeriesKeyDuplicated(transitionKeyStr);
          }

          var oldSeries_1 = [];
          each(transitionKey, function (key) {
            var oldData = oldDataMap.get(key);

            if (oldData) {
              oldSeries_1.push({
                divide: getDivideShapeFromData(oldData),
                data: oldData
              });
            }
          });

          if (oldSeries_1.length) {
            updateBatches.set(transitionKeyStr, {
              oldSeries: oldSeries_1,
              newSeries: [{
                data: newData,
                divide: getDivideShapeFromData(newData)
              }]
            });
          }
        } else {
          // Try transition to multiple series.
          var oldData_1 = oldDataMapForSplit.get(transitionKey);

          if (oldData_1) {
            var batch = updateBatches.get(oldData_1.key);

            if (!batch) {
              batch = {
                oldSeries: [{
                  data: oldData_1.data,
                  divide: getDivideShapeFromData(oldData_1.data)
                }],
                newSeries: []
              };
              updateBatches.set(oldData_1.key, batch);
            }

            batch.newSeries.push({
              data: newData,
              divide: getDivideShapeFromData(newData)
            });
          }
        }
      }
    }
  });
  return updateBatches;
}

function querySeries(series, finder) {
  for (var i = 0; i < series.length; i++) {
    var found = finder.seriesIndex != null && finder.seriesIndex === series[i].seriesIndex || finder.seriesId != null && finder.seriesId === series[i].id;

    if (found) {
      return i;
    }
  }
}

function transitionSeriesFromOpt(transitionOpt, globalStore, params, api) {
  var from = [];
  var to = [];
  each(normalizeToArray(transitionOpt.from), function (finder) {
    var idx = querySeries(globalStore.oldSeries, finder);

    if (idx >= 0) {
      from.push({
        data: globalStore.oldData[idx],
        // TODO can specify divideShape in transition.
        divide: getDivideShapeFromData(globalStore.oldData[idx]),
        dim: finder.dimension
      });
    }
  });
  each(normalizeToArray(transitionOpt.to), function (finder) {
    var idx = querySeries(params.updatedSeries, finder);

    if (idx >= 0) {
      var data = params.updatedSeries[idx].getData();
      to.push({
        data: data,
        divide: getDivideShapeFromData(data),
        dim: finder.dimension
      });
    }
  });

  if (from.length > 0 && to.length > 0) {
    transitionBetween(from, to, api);
  }
}

export function installUniversalTransition(registers) {
  registers.registerUpdateLifecycle('series:beforeupdate', function (ecMOdel, api, params) {
    each(normalizeToArray(params.seriesTransition), function (transOpt) {
      each(normalizeToArray(transOpt.to), function (finder) {
        var series = params.updatedSeries;

        for (var i = 0; i < series.length; i++) {
          if (finder.seriesIndex != null && finder.seriesIndex === series[i].seriesIndex || finder.seriesId != null && finder.seriesId === series[i].id) {
            series[i][SERIES_UNIVERSAL_TRANSITION_PROP] = true;
          }
        }
      });
    });
  });
  registers.registerUpdateLifecycle('series:transition', function (ecModel, api, params) {
    // TODO api provide an namespace that can save stuff per instance
    var globalStore = getUniversalTransitionGlobalStore(api); // TODO multiple to multiple series.

    if (globalStore.oldSeries && params.updatedSeries && params.optionChanged) {
      // Use give transition config if its' give;
      var transitionOpt = params.seriesTransition;

      if (transitionOpt) {
        each(normalizeToArray(transitionOpt), function (opt) {
          transitionSeriesFromOpt(opt, globalStore, params, api);
        });
      } else {
        // Else guess from series based on transition series key.
        var updateBatches_1 = findTransitionSeriesBatches(globalStore, params);
        each(updateBatches_1.keys(), function (key) {
          var batch = updateBatches_1.get(key);
          transitionBetween(batch.oldSeries, batch.newSeries, api);
        });
      } // Reset


      each(params.updatedSeries, function (series) {
        // Reset;
        if (series[SERIES_UNIVERSAL_TRANSITION_PROP]) {
          series[SERIES_UNIVERSAL_TRANSITION_PROP] = false;
        }
      });
    } // Save all series of current update. Not only the updated one.


    var allSeries = ecModel.getSeries();
    var savedSeries = globalStore.oldSeries = [];
    var savedData = globalStore.oldData = [];

    for (var i = 0; i < allSeries.length; i++) {
      var data = allSeries[i].getData(); // Only save the data that can have transition.
      // Avoid large data costing too much extra memory

      if (data.count() < DATA_COUNT_THRESHOLD) {
        savedSeries.push(allSeries[i]);
        savedData.push(data);
      }
    }
  });
}