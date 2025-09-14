/*
GNDU Waste MVP with Camera Barcode Scanning
--------------------------------------------
Run:
  node GNDU_waste_MVP_server.js

Opens:
  Student UI → http://localhost:3000
  Admin Panel → http://localhost:3000/admin.html
Admin password: admin123

Storage: data.json (auto-created)

Features included (minimal MVP):
- Student register/login (no real auth; stored in data.json)
- Manual barcode input + dustbin id submission (simple "scan")
- Points awarding (1 point per valid submission)
- Admin panel (password-protected) to view/approve/reject submissions
- Persistent storage in data.json

Notes & limitations:
- This MVP demo is simple and uses flat file storage.
- For production, add authentication, SSL, DB, validation, and security.

*/

const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");
const PORT = 3000;
const BASE = process.cwd();

const files = {
  "public/index.html": `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>GNDU Waste MVP - Student</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    body{font-family:system-ui,Segoe UI,Roboto,Arial;margin:20px}
    input,button{padding:8px;margin:6px}
    #reader{width:300px; margin-top:10px;}
    #log{white-space:pre-wrap;background:#f6f6f6;padding:10px;border-radius:6px}
  </style>
</head>
<body>
  <h2>GNDU Waste MVP — Student</h2>
  <div>
    <label>Name: <input id="name" /></label><br/>
    <label>Student ID: <input id="sid" /></label><br/>
    <button id="btnReg">Register / Login</button>
  </div>
  <hr/>
  <div id="panel" style="display:none">
    <h3>Submit Waste</h3>
    <div>Logged in as <b id="who"></b> (<span id="whoid"></span>) — Points: <span id="points">0</span></div>

    <label>Barcode: <input id="barcode" placeholder="Scan or type code" /></label><br/>
    <div id="reader"></div>
    <label>Dustbin ID: <input id="bin" placeholder="e.g. BIN-1" /></label><br/>
    <button id="submit">Submit Disposal</button>

    <h4>History</h4>
    <div id="history"></div>
    <h4>Log</h4>
    <div id="log">Ready.</div>
    <p><a href="/admin.html" target="_blank">Open Admin Panel</a></p>
  </div>

  <!-- Barcode Scanner -->
  <script src="https://unpkg.com/html5-qrcode" type="text/javascript"></script>
  <script>
  async function api(path, data){
    const res = await fetch(path, {method:'POST',headers:{'content-type':'application/json'},body: JSON.stringify(data)});
    return res.json();
  }

  let current = null;

  document.getElementById('btnReg').onclick = async () => {
    const name = document.getElementById('name').value.trim();
    const sid = document.getElementById('sid').value.trim();
    if(!name||!sid){alert('enter name and student id');return;}
    const r = await api('/api/register', {name, sid});
    if(r.ok){
      current = r.user;
      document.getElementById('panel').style.display='block';
      document.getElementById('who').innerText = current.name;
      document.getElementById('whoid').innerText = current.sid;
      document.getElementById('points').innerText = current.points;
      loadHistory(); log('Logged in');
    }
  }

  async function loadHistory(){
    const res = await api('/api/profile', {sid: current.sid});
    if(res.ok){
      const hist = res.history || [];
      document.getElementById('history').innerHTML = hist.map(h => `<div>${new Date(h.ts).toLocaleString()} — code:${h.code} bin:${h.bin} status:${h.status}</div>`).join('');
      document.getElementById('points').innerText = res.points;
    }
  }

  function log(msg){ document.getElementById('log').innerText = new Date().toLocaleString()+" - "+msg+"\n"+document.getElementById('log').innerText; }

  document.getElementById('submit').onclick = async () => {
    const code = document.getElementById('barcode').value.trim();
    const bin = document.getElementById('bin').value.trim();
    if(!current){alert('register first');return;}
    if(!code||!bin){alert('enter code and bin');return;}
    const r = await api('/api/submit', {sid:current.sid, code, bin});
    if(r.ok){ log('Submitted — pending approval'); loadHistory(); }
    else log('Submit failed: '+(r.error||'unknown'));
  }

  // Init camera barcode scanner
  function startScanner(){
    const html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 250 },
      decodedText => {
        document.getElementById("barcode").value = decodedText;
        log("Scanned barcode: " + decodedText);
        html5QrCode.stop();
      }
    ).catch(err => log("Camera error: " + err));
  }
  startScanner();
  </script>
</body>
</html>`,

  "public/admin.html": `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>GNDU Waste MVP - Admin</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>body{font-family:system-ui,Segoe UI,Roboto,Arial;margin:20px}table{border-collapse:collapse}td,th{padding:6px;border:1px solid #ddd}</style>
</head>
<body>
  <h2>Admin Panel</h2>
  <div>
    <label>Password: <input id="pw" type="password"/></label>
    <button id="login">Login</button>
    <span id="status"></span>
  </div>
  <div id="panel" style="display:none">
    <h3>Submissions</h3>
    <table id="tbl"><thead><tr><th>Time</th><th>Student</th><th>SID</th><th>Code</th><th>Bin</th><th>Status</th><th>Action</th></tr></thead><tbody></tbody></table>
    <h3>Students</h3>
    <div id="students"></div>
  </div>
<script>
async function api(path, data){
  const res = await fetch(path, {method:'POST',headers:{'content-type':'application/json'},body: JSON.stringify(data)});
  return res.json();
}
let token = null;

document.getElementById('login').onclick = async () => {
  const pw = document.getElementById('pw').value;
  const r = await api('/api/admin/login', {pw});
  if(r.ok){ token = r.token; document.getElementById('panel').style.display='block'; document.getElementById('status').innerText='Logged in'; load(); }
  else document.getElementById('status').innerText='Bad password';
}

async function load(){
  const r = await api('/api/admin/list', {token});
  if(r.ok){
    const tbody = document.querySelector('#tbl tbody'); tbody.innerHTML='';
    r.subs.forEach(s=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${new Date(s.ts).toLocaleString()}</td><td>${s.name}</td><td>${s.sid}</td><td>${s.code}</td><td>${s.bin}</td><td>${s.status}</td><td></td>`;
      const td = tr.querySelector('td:last-child');
      if(s.status==='pending'){
        const a = document.createElement('button'); a.innerText='Approve'; a.onclick=async () => { await api('/api/admin/approve',{token,id:s.id}); load(); }
        const b = document.createElement('button'); b.innerText='Reject'; b.onclick=async () => { await api('/api/admin/reject',{token,id:s.id}); load(); }
        td.appendChild(a); td.appendChild(b);
      }
      tbody.appendChild(tr);
    })
    document.getElementById('students').innerText = JSON.stringify(r.students, null, 2);
  }
}
</script>
</body>
</html>`,

  "data.json": `{
  "students": [],
  "subs": []
}`
};

function ensureFiles(){
  if(!fs.existsSync(path.join(BASE,"public"))){ fs.mkdirSync(path.join(BASE,"public")); }
  for(const p in files){
    const full = path.join(BASE,p);
    if(!fs.existsSync(full)){ fs.writeFileSync(full, files[p], "utf8"); console.log("Created", p); }
  }
}
ensureFiles();

function readData(){ try{ return JSON.parse(fs.readFileSync(path.join(BASE,"data.json"),"utf8")); }catch(e){ return {students:[],subs:[]}; } }
function writeData(d){ fs.writeFileSync(path.join(BASE,"data.json"), JSON.stringify(d,null,2),"utf8"); }

const server = http.createServer((req,res)=>{
  const parsed = url.parse(req.url,true);
  const method = req.method;
  if(method==="GET"){
    let p = parsed.pathname==="/" ? "/public/index.html" : parsed.pathname;
    if(p.startsWith("/")) p = p.slice(1);
    const full = path.join(BASE,p);
    if(fs.existsSync(full) && fs.statSync(full).isFile()){
      const ext = path.extname(full).toLowerCase();
      const map = {".html":"text/html",".js":"application/javascript",".json":"application/json",".css":"text/css"};
      res.writeHead(200, {"Content-Type": map[ext]||"application/octet-stream"});
      res.end(fs.readFileSync(full));
      return;
    }
    res.writeHead(404); res.end("Not found");
    return;
  }
  if(method==="POST"){
    let body=""; req.on("data",ch=>body+=ch); req.on("end",()=>{
      let obj={};
      try{ obj=JSON.parse(body||"{}"); }catch(e){}
      route(req.url,obj,(status,data)=>{
        res.writeHead(status,{"Content-Type":"application/json"});
        res.end(JSON.stringify(data));
      });
    });
    return;
  }
  res.writeHead(405); res.end("Method not allowed");
});

function route(pathname, body, cb){
  const d = readData();
  if(pathname==="/api/register"){
    const {name,sid} = body; if(!name||!sid) return cb(400,{ok:false});
    let user = d.students.find(s=>s.sid===sid);
    if(!user){ user={name,sid,points:0}; d.students.push(user); writeData(d); }
    return cb(200,{ok:true,user});
  }
  if(pathname==="/api/profile"){
    const {sid} = body; const user=d.students.find(s=>s.sid===sid); if(!user) return cb(404,{ok:false});
    const history=d.subs.filter(s=>s.sid===sid).sort((a,b)=>b.ts-a.ts);
    return cb(200,{ok:true,history,points:user.points});
  }
  if(pathname==="/api/submit"){
    const {sid,code,bin} = body; const user=d.students.find(s=>s.sid===sid); if(!user) return cb(404,{ok:false});
    const id="s"+Date.now()+Math.floor(Math.random()*1000);
    const rec={id,sid,name:user.name,code,bin,ts:Date.now(),status:"pending"};
    d.subs.push(rec); writeData(d); return cb(200,{ok:true});
  }
  const ADMIN_PW="admin123";
  if(pathname==="/api/admin/login"){ if(body.pw===ADMIN_PW) return cb(200,{ok:true,token:"admintoken"}); return cb(401,{ok:false}); }
  if(pathname==="/api/admin/list"){ if(body.token!=="admintoken") return cb(403,{ok:false}); return cb(200,{ok:true,subs:d.subs.sort((a,b)=>b.ts-a.ts),students:d.students}); }
  if(pathname==="/api/admin/approve"){ if(body.token!=="admintoken") return cb(403,{ok:false}); const sub=d.subs.find(x=>x.id===body.id); if(!sub) return cb(404,{ok:false}); if(sub.status!=="pending") return cb(400,{ok:false}); sub.status="approved"; const u=d.students.find(s=>s.sid===sub.sid); if(u) u.points=(u.points||0)+10; writeData(d); return cb(200,{ok:true}); }
  if(pathname==="/api/admin/reject"){ if(body.token!=="admintoken") return cb(403,{ok:false}); const sub=d.subs.find(x=>x.id===body.id); if(!sub) return cb(404,{ok:false}); if(sub.status!=="pending") return cb(400,{ok:false}); sub.status="rejected"; writeData(d); return cb(200,{ok:true}); }
  cb(404,{ok:false});
}

server.listen(PORT, ()=>console.log("GNDU Waste MVP running at http://localhost:"+PORT));
