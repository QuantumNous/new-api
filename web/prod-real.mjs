import { JSDOM, VirtualConsole } from 'jsdom'
import { join, extname } from 'node:path'
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
const DIST='/opt/build/repo/web/dist'
const MIME={'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.svg':'image/svg+xml','.ico':'image/x-icon','.png':'image/png'}
const BACKEND='http://127.0.0.1:3999'
const server=createServer(async(req,res)=>{const url=req.url.split('?')[0]
  if(url.startsWith('/api/')||url.startsWith('/v1/')){
    try{
      const method=req.method
      const body=['GET','HEAD'].includes(method)?undefined:await new Promise((r)=>{const c=[];req.on('data',x=>c.push(x));req.on('end',()=>r(Buffer.concat(c)))})
      const r=await fetch(BACKEND+req.url,{method,headers:{cookie:req.headers.cookie||'','content-type':'application/json','accept':'application/json'},body})
      const buf=Buffer.from(await r.arrayBuffer())
      const sc=r.headers.getSetCookie?r.headers.getSetCookie():[]
      const out={'content-type':r.headers.get('content-type')||'application/json'}
      if(sc.length) out['set-cookie']=sc
      res.writeHead(r.status,out);res.end(buf)
    }catch(e){res.writeHead(502);res.end(String(e))}
    return}
  try{let p=join(DIST,decodeURIComponent(url));let s=await stat(p).catch(()=>null)
    if(!s||s.isDirectory()){p=join(DIST,'index.html');s=await stat(p)}
    res.writeHead(200,{'content-type':MIME[extname(p)]||'application/octet-stream'});res.end(await readFile(p))
  }catch(e){res.writeHead(500);res.end(String(e))}})
await new Promise(r=>server.listen(0,r));const port=server.address().port
const lr=await fetch(BACKEND+'/api/user/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'admin',password:'Admin123456!'})})
await lr.json()
const cookies=lr.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ')
const errors=[];const vc=new VirtualConsole()
vc.on('jsdomError',e=>errors.push('jsdomError :: '+e.message))
vc.on('error',(...a)=>errors.push('console.error :: '+a.map(x=>(x&&x.stack)?String(x.stack):String(x)).join(' | ').split('\n').slice(0,5).join('\n')))
const html=readFileSync(join(DIST,'index.html'),'utf8')
console.log('DEBUG creating dom'); const dom=new JSDOM(html,{url:`http://127.0.0.1:${port}${process.argv[2]}`,runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,virtualConsole:vc,
  beforeParse(w){
    for(const k of ['Response','Request','Headers','ReadableStream','TextEncoder','TextDecoder','AbortController','URL','URLSearchParams','FormData','Blob']) if(typeof w[k]==='undefined'&&typeof globalThis[k]!=='undefined') w[k]=globalThis[k]
    w.matchMedia=(q)=>({matches:false,media:q,onchange:null,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){},dispatchEvent(){return false}})
    w.scrollTo=()=>{}
  }})
const w=dom.window
for(const c of cookies.split('; ')) { try { w.document.cookie = c + '; Path=/' } catch {} }
const hb=setInterval(()=>console.log('HEARTBEAT'),1000); await new Promise(r=>setTimeout(r,7000)); clearInterval(hb); console.log('DEBUG waited')
const root=w.document.querySelector('#root')
const text=(root?.textContent||'').replace(/\s+/g,' ').trim()
console.log('RESULT entry='+process.argv[2]+' rootLen='+(root?.innerHTML.length)+' path='+w.location.pathname+' BLACK='+(root?.innerHTML.length===0)+' ERRORDLG='+text.includes('Oops!'))
console.log('RESULT text='+text.slice(0,240))
errors.slice(0,5).forEach(e=>console.log('ERR '+e.slice(0,700)))
w.close();process.exit(0)
