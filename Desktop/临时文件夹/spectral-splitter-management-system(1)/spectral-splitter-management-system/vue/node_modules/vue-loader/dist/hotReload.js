"use strict";
// __VUE_HMR_RUNTIME__ is injected to global scope by @vue/runtime-core
Object.defineProperty(exports, "__esModule", { value: true });
exports.genHotReloadCode = void 0;
function genHotReloadCode(id, templateRequest) {
    return `
/* hot reload */
if (module.hot) {
  __exports__.__hmrId = "${id}"
  const api = __VUE_HMR_RUNTIME__
  module.hot.accept()
  if (!api.createRecord('${id}', __exports__)) {
    api.reload('${id}', __exports__)
  }
  ${templateRequest ? genTemplateHotReloadCode(id, templateRequest) : ''}
}
`;
}
exports.genHotReloadCode = genHotReloadCode;
function genTemplateHotReloadCode(id, request) {
    return `
  module.hot.accept(${request}, () => {
    api.rerender('${id}', render)
  })
`;
}
