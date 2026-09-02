package controller

import (
	"fmt"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

func DomainOAuthHandoffBridge(c *gin.Context) {
	domainContext, found := middleware.GetCustomDomainContext(c)
	mode := c.Query("mode")
	allowedCustom := domainContext.Kind == service.CustomDomainKindCustom || domainContext.Kind == service.CustomDomainKindDisabled
	allowedMainFallback := domainContext.Kind == service.CustomDomainKindMain && mode == "fallback"
	if !found || (!allowedCustom && !allowedMainFallback) {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	nonce, err := common.GenerateRandomCharsKey(24)
	if err != nil {
		c.AbortWithStatus(http.StatusServiceUnavailable)
		return
	}
	c.Header("Cache-Control", "no-store")
	c.Header("Referrer-Policy", "no-referrer")
	c.Header("X-Content-Type-Options", "nosniff")
	c.Header("X-Frame-Options", "DENY")
	c.Header("Content-Security-Policy", fmt.Sprintf(
		"default-src 'none'; script-src 'nonce-%s'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
		nonce,
	))
	page := fmt.Sprintf(`<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body><script nonce="%s">
(()=>{const searchParams=new URLSearchParams(location.search);const mode=searchParams.get('mode');const p=new URLSearchParams(location.hash.slice(1));const t=p.getAll('ticket');const results=p.getAll('result');history.replaceState(null,'',location.pathname+location.search);if(mode==='bind-return'){if(!window.opener||window.opener.closed||results.length!==1||!['cancelled','failed','target_unavailable'].includes(results[0])){location.replace('/sign-in');return;}window.opener.postMessage({type:'oauth:binding:return',provider:searchParams.get('provider')||'',result:results[0]},location.origin);return;}if(t.length!==1||!t[0]){location.replace('/sign-in');return;}if(mode==='bind'){if(!window.opener||window.opener.closed){location.replace('/sign-in');return;}window.opener.postMessage({type:'oauth:binding:handoff',provider:searchParams.get('provider')||'',ticket:t[0]},location.origin);return;}const endpoint=mode==='fallback'?'/api/oauth/domain-handoff-fallback':'/api/oauth/domain-handoff';fetch(endpoint,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticket:t[0]})}).then(async r=>{let b=null;try{b=await r.json();}catch{}if(!r.ok||!b||!b.success){location.replace('/sign-in');return;}const d=b.data||{};if(d.action==='domain_login_fallback'&&typeof d.target_origin==='string'&&typeof d.ticket==='string'){try{const u=new URL(d.target_origin);if(u.protocol!=='https:'||u.pathname!=='/'||u.search||u.hash||u.username||u.password){throw new Error('invalid fallback origin');}u.pathname='/oauth/handoff';u.searchParams.set('mode','fallback');u.hash=new URLSearchParams({ticket:d.ticket}).toString();location.replace(u.toString());return;}catch{location.replace('/sign-in');return;}}location.replace('/');}).catch(()=>location.replace('/sign-in'));})();
</script></body></html>`, nonce)
	c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(page))
}
