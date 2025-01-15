import './setPublicPath'
import Vue from 'vue'
import wrap from '@vue/web-component-wrapper'

// runtime shared by every component chunk
import 'css-loader/dist/runtime/api.js'
import 'vue-style-loader/lib/addStylesShadow'
import 'vue-loader/lib/runtime/componentNormalizer'

window.customElements.define('build-wc-async-app', wrap(Vue, () => import('~root/src/App.vue?shadow')))

window.customElements.define('build-wc-async-hello-world', wrap(Vue, () => import('~root/src/components/HelloWorld.vue?shadow')))
