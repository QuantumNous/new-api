export const MIXPANEL_CONSENT_KEY = "flatkey_analytics_consent";
export const MIXPANEL_TOKEN =
  process.env.NEXT_PUBLIC_MIXPANEL_TOKEN ||
  "cf2f149bd61f607c3fd578596ad86921";

export const MIXPANEL_BROWSER_SCRIPT = `(function(){
  var consentKey=${JSON.stringify(MIXPANEL_CONSENT_KEY)};
  var token=${JSON.stringify(MIXPANEL_TOKEN)};
  var loaded=false;
  function consent(){try{return localStorage.getItem(consentKey)||document.cookie.replace(new RegExp('(?:(?:^|.*;\\\\s*)'+consentKey+'\\\\s*\\\\=\\\\s*([^;]*).*$)|^.*$'),'$1');}catch(e){return '';}}
  function attrs(){var out=['path=/','max-age=31536000','SameSite=Lax'];var host=location.hostname;if(host==='flatkey.ai'||host.endsWith('.flatkey.ai'))out.push('domain=.flatkey.ai');if(location.protocol==='https:')out.push('Secure');return out.join('; ');}
  function save(value){try{localStorage.setItem(consentKey,value);document.cookie=consentKey+'='+value+'; '+attrs();}catch(e){}}
  function trackPage(){try{if(!window.mixpanel)return;window.mixpanel.track('page_viewed',{path:location.pathname,search:location.search||undefined,product_surface:'website'});}catch(e){}}
  function init(){
    if(loaded||!token||consent()!=='granted')return;
    loaded=true;
    (function(f,b){if(!b.__SV){var e,g,i,h;window.mixpanel=b;b._i=[];b.init=function(e,f,c){function g(a,d){var b=d.split('.');2==b.length&&(a=a[b[0]],d=b[1]);a[d]=function(){a.push([d].concat(Array.prototype.slice.call(arguments,0)))}}var a=b;'undefined'!==typeof c?a=b[c]=[]:c='mixpanel';a.people=a.people||[];a.toString=function(a){var d='mixpanel';'mixpanel'!==c&&(d+='.'+c);a||(d+=' (stub)');return d};a.people.toString=function(){return a.toString(1)+'.people (stub)'};i='disable time_event track track_pageview track_links track_forms register register_once alias unregister identify name_tag set_config reset people.set people.set_once people.unset people.increment people.append people.union people.track_charge people.clear_charges people.delete_user'.split(' ');for(h=0;h<i.length;h++)g(a,i[h]);b._i.push([e,f,c])};b.__SV=1.2;e=f.createElement('script');e.type='text/javascript';e.async=!0;e.src='https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js';g=f.getElementsByTagName('script')[0];g.parentNode.insertBefore(e,g)}})(document,window.mixpanel||[]);
    window.mixpanel.init(token,{persistence:'localStorage',ignore_dnt:false});
    trackPage();
  }
  window.flatkeyMixpanelConsent={grant:function(){save('granted');init();},deny:function(){save('denied');},status:consent};
  init();
  ['pushState','replaceState'].forEach(function(name){var original=history[name];history[name]=function(){var result=original.apply(this,arguments);setTimeout(trackPage,0);return result;}});
  addEventListener('popstate',function(){setTimeout(trackPage,0);});
})();`;
