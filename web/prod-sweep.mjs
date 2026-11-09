import { JSDOM, VirtualConsole } from 'jsdom'
import { join, extname } from 'node:path'
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
const DIST='/opt/build/repo/web/dist'
const MIME={'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.svg':'image/svg+xml','.ico':'image/x-icon','.png':'image/png'}
const B='http://127.0.0.1:3999'
const lr=await fetch(B+'/api/user/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'admin',password:'Admin123456!'}),signal:AbortSignal.timeout(15000)})
await lr.json()
const cookies=lr.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ')
const AUTH={cookie:cookies,'content-type':'application/json',accept:'application/json'}
const PATHS=['/api/setup','/api/status','/api/notice','/api/uptime/status','/api/data/self','/api/token/','/api/user/self','/api/user/self/groups','/api/user/access_tokens','/api/user/access_tokens/catalog','/api/user/login-sessions','/api/subscription/plans','/api/user/aff','/api/user/token/auto-groups','/api/log/self','/api/log/self/stat','/api/user/invitation','/api/user/2fa','/api/user/topup/info','/api/user/available_credit']
const cache=new Map()
for(const p of PATHS){ try{const r=await fetch(B+p,{headers:AUTH,signal:AbortSignal.timeout(8000)}); cache.set(p,{status:r.status,body:await r.text()})}catch(e){ cache.set(p,{status:502,body:JSON.stringify({success:true,message:'',data:[]})}); console.log('TIMEOUT '+p) } }
const server=createServer(async(req,res)=>{const url=req.url.split('?')[0]
  if(url.startsWith('/api/')){
    const exact=cache.get(req.url)||cache.get(url)
    if(exact){res.writeHead(exact.status,{'content-type':'application/json'});res.end(exact.body);return}
    res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({success:true,message:'',data:[]}));return}
  try{let p=join(DIST,decodeURIComponent(url));let s=await stat(p).catch(()=>null)
    if(!s||s.isDirectory()){p=join(DIST,'index.html');s=await stat(p)}
    res.writeHead(200,{'content-type':MIME[extname(p)]||'application/octet-stream'});res.end(await readFile(p))
  }catch(e){res.writeHead(500);res.end(String(e))}})
await new Promise(r=>server.listen(0,r));const port=server.address().port
for(const entry of process.argv.slice(2)){
  const errors=[];const vc=new VirtualConsole()
  vc.on('jsdomError',e=>errors.push('jsdomError :: '+e.message))
  vc.on('error',(...a)=>errors.push('console.error :: '+a.map(x=>(x&&x.stack)?String(x.stack):String(x)).join(' | ').split('\n').slice(0,5).join('\n')))
  const dom=await JSDOM.fromURL(`http://127.0.0.1:${port}${entry}`,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,virtualConsole:vc,
    beforeParse(w){
      for(const k of ['Response','Request','Headers','ReadableStream','TextEncoder','TextDecoder','AbortController','URL','URLSearchParams','FormData','Blob']) if(typeof w[k]==='undefined'&&typeof globalThis[k]!=='undefined') w[k]=globalThis[k]
      w.matchMedia=(q)=>({matches:false,media:q,onchange:null,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){},dispatchEvent(){return false}})
      w.scrollTo=()=>{}}})
  const w=dom.window
  for(const c of cookies.split('; ')){ try{w.document.cookie=c+'; Path=/'}catch{} }
  await new Promise(r=>setTimeout(r,4000))
  const root=w.document.querySelector('#root')
  const text=(root?.textContent||'').replace(/\s+/g,' ').trim()
  console.log(`SWEEP ${entry} len=${root?.innerHTML.length} BLACK=${root?.innerHTML.length===0} ERRORDLG=${text.includes('Oops! Something went wrong')} path=${w.location.pathname}`)
  errors.slice(0,2).forEach(e=>console.log('   ERR '+e.slice(0,450)))
  w.close()
}
server.close();process.exit(0)
