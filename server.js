// e'lonber.uz — server (Node.js 18+, qo'shimcha kutubxona kerak emas)
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const ADMIN_PHONE='998990832696';          // +998 99-083-26-96
const ADMIN_PASS=process.env.ADMIN_PASS||'ElonBer#2026';  // Render'da ADMIN_PASS o'zgaruvchisi bilan almashtiring
const PORT=process.env.PORT||3000, F=path.join(__dirname,'data.json');
let db={users:[],ads:[],orders:[],msgs:[],sessions:{},n:1};
const SB=process.env.SUPABASE_URL,KEY=process.env.SUPABASE_KEY;
const H={apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json'};
let timer;
const push=()=>fetch(SB+'/rest/v1/store',{method:'POST',headers:{...H,Prefer:'resolution=merge-duplicates'},body:JSON.stringify({id:1,data:db})}).catch(e=>console.log('saqlash xatosi',e.message));
const save=()=>{if(!SB)return fs.writeFileSync(F,JSON.stringify(db));clearTimeout(timer);timer=setTimeout(push,400)};
async function init(){
  if(SB){const r=await fetch(SB+'/rest/v1/store?id=eq.1&select=data',{headers:H});const j=await r.json();if(j[0])db=j[0].data;else if(!Array.isArray(j))throw new Error(JSON.stringify(j))}
  else try{db=JSON.parse(fs.readFileSync(F))}catch{}
  if(!db.users.find(u=>u.admin)){db.users.push({id:nid(),username:'+'+ADMIN_PHONE,first:'Admin',last:'',admin:true,pro:true,credits:0,t:Date.now(),seen:0});save()}
}
const hash=(p,s=crypto.randomBytes(8).toString('hex'))=>s+':'+crypto.scryptSync(p,s,32).toString('hex');
const ok=(p,h)=>hash(p,h.split(':')[0])===h;
const nid=()=>db.n++;
const pub=u=>({id:u.id,username:u.username,first:u.first,last:u.last,pro:u.pro,credits:u.credits,admin:!!u.admin});
const tok=()=>crypto.randomBytes(24).toString('hex');
function api(m,url,b,u){
  const A=()=>u?null:[401,{e:'Avval kiring'}], S=()=>u&&u.admin?null:[403,{e:'Ruxsat yo\'q'}];
  if(url==='/api/register'&&m==='POST'){
    const un=String(b.username||'').trim().toLowerCase();
    if(un.length<3||String(b.password||'').length<6||!b.first)return[400,{e:'Ism, login (3+) va parol (6+ belgi) kiriting'}];
    if(db.users.find(x=>x.username===un)||un.replace(/\D/g,'')===ADMIN_PHONE)return[400,{e:'Bu login band'}];
    const n={id:nid(),username:un,pw:hash(b.password),first:b.first.trim(),last:(b.last||'').trim(),pro:false,credits:1,t:Date.now(),seen:Date.now()};
    db.users.push(n);const t=tok();db.sessions[t]=n.id;save();return[200,{token:t,user:pub(n)}];
  }
  if(url==='/api/login'&&m==='POST'){
    const un=String(b.username||'').trim().toLowerCase();let x;
    if(un.replace(/\D/g,'')===ADMIN_PHONE){x=db.users.find(v=>v.admin);if(b.password!==ADMIN_PASS)return[400,{e:'Login yoki parol xato'}]}
    else{x=db.users.find(v=>v.username===un&&v.pw);if(!x||!ok(String(b.password),x.pw))return[400,{e:'Login yoki parol xato'}]}
    const t=tok();db.sessions[t]=x.id;save();return[200,{token:t,user:pub(x)}];
  }
  if(url==='/api/me')return u?[200,{user:pub(u)}]:[200,{user:null}];
  if(url==='/api/ads'&&m==='GET')return[200,db.ads.slice().reverse().map(a=>({...a,owner:(db.users.find(x=>x.id===a.uid)||{}).first}))];
  if(url==='/api/ads'&&m==='POST'){
    let e=A();if(e)return e;
    if(!b.title||!b.price)return[400,{e:'Nomi va narxini kiriting'}];
    if(!u.admin&&u.credits<=0)return[402,{e:'Bepul e\'lon tugadi. Sozlamalardan PRO oling.'}];
    if(!u.admin)u.credits--;
    db.ads.push({id:nid(),uid:u.id,title:String(b.title).slice(0,80),price:String(b.price).slice(0,30),desc:String(b.desc||'').slice(0,1000),phone:String(b.phone||'').slice(0,20),img:b.img||'',t:Date.now()});
    save();return[200,{user:pub(u)}];
  }
  if(url.startsWith('/api/ads/')&&m==='DELETE'){
    let e=A();if(e)return e;const id=+url.split('/')[3],a=db.ads.find(x=>x.id===id);
    if(a&&(a.uid===u.id||u.admin)){db.ads=db.ads.filter(x=>x.id!==id);save()}return[200,{}];
  }
  if(url==='/api/orders'&&m==='POST'){
    let e=A();if(e)return e;
    for(const id of b.ids||[]){const a=db.ads.find(x=>x.id===id);if(a)db.orders.push({id:nid(),uid:u.id,adId:id,title:a.title,price:a.price,t:Date.now()})}
    save();return[200,{}];
  }
  if(url==='/api/msgs'&&m==='GET'){let e=A();if(e)return e;return[200,db.msgs.filter(x=>x.uid===u.id)]}
  if(url==='/api/msgs'&&m==='POST'){let e=A();if(e)return e;if(!b.text)return[400,{e:'Bo\'sh'}];db.msgs.push({id:nid(),uid:u.id,from:'user',text:String(b.text).slice(0,1000),type:b.type||'',t:Date.now()});save();return[200,{}]}
  if(url==='/api/admin/stats'){let e=A()||S();if(e)return e;const us=db.users.filter(x=>!x.admin);
    return[200,{users:us.length,online:us.filter(x=>Date.now()-x.seen<3e5).length,ads:db.ads.length,orders:db.orders.length,pro:us.filter(x=>x.pro).length}]}
  if(url==='/api/admin/users'){let e=A()||S();if(e)return e;
    return[200,db.users.filter(x=>!x.admin).reverse().map(x=>({...pub(x),t:x.t,online:Date.now()-x.seen<3e5,ads:db.ads.filter(a=>a.uid===x.id).length,orders:db.orders.filter(o=>o.uid===x.id).length}))]}
  if(url.startsWith('/api/admin/user/')){let e=A()||S();if(e)return e;const x=db.users.find(v=>v.id===+url.split('/')[4]);if(!x)return[404,{}];
    return[200,{user:pub(x),t:x.t,ads:db.ads.filter(a=>a.uid===x.id).map(a=>({...a,img:''})),orders:db.orders.filter(o=>o.uid===x.id)}]}
  if(url.startsWith('/api/admin/pro/')&&m==='POST'){let e=A()||S();if(e)return e;const x=db.users.find(v=>v.id===+url.split('/')[4]);
    if(x){x.pro=!x.pro;if(x.pro)x.credits+=5;else x.credits=0;save()}return[200,{user:pub(x)}]}
  if(url==='/api/admin/threads'){let e=A()||S();if(e)return e;const ids=[...new Set(db.msgs.map(x=>x.uid))];
    return[200,ids.map(i=>{const x=db.users.find(v=>v.id===i),l=db.msgs.filter(v=>v.uid===i).pop();return{uid:i,name:x?x.first+' '+x.last:'?',last:l.text,from:l.from,type:l.type,t:l.t}}).sort((a,b)=>b.t-a.t)]}
  if(url.startsWith('/api/admin/thread/')){let e=A()||S();if(e)return e;return[200,db.msgs.filter(x=>x.uid===+url.split('/')[4]),]}
  if(url==='/api/admin/reply'&&m==='POST'){let e=A()||S();if(e)return e;db.msgs.push({id:nid(),uid:+b.uid,from:'admin',text:String(b.text).slice(0,1000),type:'',t:Date.now()});save();return[200,{}]}
  return[404,{e:'Topilmadi'}];
}
const handler=(req,res)=>{
  const url=req.url.split('?')[0];
  if(url==='/health'){(SB?fetch(SB+'/rest/v1/store?id=eq.1&select=id',{headers:H}):Promise.resolve()).catch(()=>{});res.writeHead(200);return res.end('ok')}
  if(!url.startsWith('/api/')){res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});return res.end(fs.readFileSync(path.join(__dirname,'public','index.html')))}
  let body='';req.on('data',c=>{body+=c;if(body.length>4e6)req.destroy()});
  req.on('end',()=>{
    let b={};try{b=JSON.parse(body||'{}')}catch{}
    const t=(req.headers.authorization||'').slice(7),u=db.users.find(x=>x.id===db.sessions[t]);
    if(u){u.seen=Date.now()}
    let r;try{r=api(req.method,url,b,u)}catch(e){r=[500,{e:'Server xatosi'}]}
    res.writeHead(r[0],{'Content-Type':'application/json'});res.end(JSON.stringify(r[1]));
  });
};
init().then(()=>http.createServer(handler).listen(PORT,'0.0.0.0',()=>console.log("e'lonber.uz ishga tushdi: http://localhost:"+PORT))).catch(e=>{console.log('Boshlashda xato:',e.message);process.exit(1)});
