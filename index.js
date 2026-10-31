const json = (data, status=200) => new Response(JSON.stringify(data), {status, headers:{"content-type":"application/json; charset=utf-8"}});
const enc = new TextEncoder();
const b64 = b => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const unb64 = s => Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")), c=>c.charCodeAt(0));
async function hashPassword(password, salt=b64(crypto.getRandomValues(new Uint8Array(16)))) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({name:"PBKDF2",salt:unb64(salt),iterations:210000,hash:"SHA-256"}, key, 256);
  return `${salt}.${b64(bits)}`;
}
async function verifyPassword(password, stored) {
  const [salt, expected] = stored.split(".");
  const actual = (await hashPassword(password,salt)).split(".")[1];
  return actual === expected;
}
async function sign(value, secret) {
  const key = await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return b64(await crypto.subtle.sign("HMAC",key,enc.encode(value)));
}
async function sessionToken(user, secret) {
  const payload=b64(enc.encode(JSON.stringify({id:user.id,username:user.username,exp:Date.now()+86400000})));
  return `${payload}.${await sign(payload,secret)}`;
}
async function getUser(req, env) {
  const token=(req.headers.get("Cookie")||"").split(";").map(x=>x.trim()).find(x=>x.startsWith("ap_session="))?.slice(11);
  if(!token) return null;
  const [payload,sig]=token.split(".");
  if(!payload||!sig||await sign(payload,env.SESSION_SECRET||"CHANGE_THIS_SECRET")!==sig) return null;
  try { const data=JSON.parse(new TextDecoder().decode(unb64(payload))); return data.exp>Date.now()?data:null; } catch { return null; }
}
const cookie = (value, maxAge=86400) => `ap_session=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
async function body(req){ try{return await req.json()}catch{return {}} }
const tables = {
  employees:["employee_code","name","phone","designation","joining_date","basic_salary","housing_allowance","other_allowance","overtime_mode","overtime_rate","active"],
  attendance:["employee_id","work_date","status","overtime_hours","notes"],
  advances:["employee_id","advance_date","amount","description","remaining"],
  expenses:["expense_date","category","description","amount","status"],
  payroll:["employee_id","pay_month","basic_salary","overtime_hours","overtime_amount","allowances","advance_deduction","other_deductions","net_salary","status"]
};
async function api(req, env) {
  const url=new URL(req.url), path=url.pathname, method=req.method;
  if(path==="/api/status" && method==="GET"){
    const r=await env.DB.prepare("SELECT COUNT(*) n FROM users").first();
    return json({setupRequired:!r.n, appName:env.APP_NAME||"Accountant & Payroll Management"});
  }
  if(path==="/api/setup" && method==="POST"){
    const count=await env.DB.prepare("SELECT COUNT(*) n FROM users").first();
    if(count.n) return json({error:"Setup already completed"},409);
    const b=await body(req);
    if(!b.username||!b.password||String(b.password).length<10) return json({error:"Username and a password of at least 10 characters are required"},400);
    const hashed=await hashPassword(String(b.password));
    const result=await env.DB.prepare("INSERT INTO users(username,password_hash) VALUES(?,?)").bind(String(b.username),hashed).run();
    const user={id:result.meta.last_row_id,username:String(b.username)};
    const token=await sessionToken(user,env.SESSION_SECRET||"CHANGE_THIS_SECRET");
    return new Response(JSON.stringify({ok:true}),{headers:{"content-type":"application/json","set-cookie":cookie(token)}});
  }
  if(path==="/api/login" && method==="POST"){
    const b=await body(req), user=await env.DB.prepare("SELECT * FROM users WHERE username=?").bind(String(b.username||"")).first();
    if(!user||!(await verifyPassword(String(b.password||""),user.password_hash))) return json({error:"Invalid username or password"},401);
    const token=await sessionToken(user,env.SESSION_SECRET||"CHANGE_THIS_SECRET");
    return new Response(JSON.stringify({ok:true}),{headers:{"content-type":"application/json","set-cookie":cookie(token)}});
  }
  if(path==="/api/logout" && method==="POST") return new Response(JSON.stringify({ok:true}),{headers:{"content-type":"application/json","set-cookie":cookie("",0)}});
  const user=await getUser(req,env);
  if(path==="/api/me") return user?json({user:{username:user.username}}):json({error:"Unauthorized"},401);
  if(!user) return json({error:"Please log in"},401);
  if(path==="/api/dashboard"){
    const [employees, payroll, expenses, advances]=await Promise.all([
      env.DB.prepare("SELECT COUNT(*) n FROM employees WHERE active=1").first(),
      env.DB.prepare("SELECT COALESCE(SUM(net_salary),0) total FROM payroll WHERE pay_month=?").bind(url.searchParams.get("month")||new Date().toISOString().slice(0,7)).first(),
      env.DB.prepare("SELECT COALESCE(SUM(amount),0) total FROM expenses WHERE substr(expense_date,1,7)=?").bind(url.searchParams.get("month")||new Date().toISOString().slice(0,7)).first(),
      env.DB.prepare("SELECT COALESCE(SUM(remaining),0) total FROM advances").first()
    ]);
    return json({employees:employees.n,monthlyPayroll:payroll.total,monthlyExpenses:expenses.total,outstandingAdvances:advances.total});
  }
  if(path==="/api/export" && method==="GET"){
    const data={};
    for(const t of Object.keys(tables)) data[t]=(await env.DB.prepare(`SELECT * FROM ${t}`).all()).results;
    return json({exportedAt:new Date().toISOString(),data});
  }
  const match=path.match(/^\/api\/(employees|attendance|advances|expenses|payroll)(?:\/(\d+))?$/);
  if(match){
    const table=match[1], id=match[2], cols=tables[table];
    if(method==="GET"){
      let sql=`SELECT ${table==="payroll"?"payroll.*,employees.name employee_name,employees.employee_code":table==="attendance"?"attendance.*,employees.name employee_name":table==="advances"?"advances.*,employees.name employee_name":"*"} FROM ${table}`;
      if(["payroll","attendance","advances"].includes(table)) sql+=" JOIN employees ON employees.id="+table+".employee_id";
      sql+=" ORDER BY "+(table==="employees"?"id DESC":table==="expenses"?"expense_date DESC":"id DESC");
      return json((await env.DB.prepare(sql).all()).results);
    }
    if(method==="POST"){
      const b=await body(req), values=cols.map(c=>b[c]??(c==="active"?1:c==="status"?(table==="payroll"?"unpaid":table==="expenses"?"paid":"present"):c==="overtime_mode"?"manual":c==="remaining"?b.amount??0:0));
      const sql=`INSERT INTO ${table} (${cols.join(",")}) VALUES (${cols.map(()=>"?").join(",")})`;
      try {const r=await env.DB.prepare(sql).bind(...values).run();return json({ok:true,id:r.meta.last_row_id},201)} catch(e){return json({error:e.message},400)}
    }
    if(id && method==="PUT"){
      const b=await body(req), updates=cols.filter(c=>b[c]!==undefined);
      if(!updates.length)return json({error:"No fields to update"},400);
      try {await env.DB.prepare(`UPDATE ${table} SET ${updates.map(c=>c+"=?").join(",")} WHERE id=?`).bind(...updates.map(c=>b[c]),Number(id)).run();return json({ok:true})}catch(e){return json({error:e.message},400)}
    }
    if(id && method==="DELETE"){await env.DB.prepare(`DELETE FROM ${table} WHERE id=?`).bind(Number(id)).run();return json({ok:true})}
  }
  if(path==="/api/payroll/generate" && method==="POST"){
    const b=await body(req), employee=await env.DB.prepare("SELECT * FROM employees WHERE id=?").bind(Number(b.employee_id)).first();
    if(!employee)return json({error:"Employee not found"},404);
    const hours=Number(b.overtime_hours||0), basic=Number(employee.basic_salary), allowances=Number(employee.housing_allowance)+Number(employee.other_allowance);
    const otRate=employee.overtime_mode==="manual"?Number(employee.overtime_rate):((basic+allowances)/240)+(basic/240*0.5);
    const ot=hours*otRate, advance=await env.DB.prepare("SELECT COALESCE(SUM(remaining),0) total FROM advances WHERE employee_id=?").bind(employee.id).first();
    const deduction=Math.min(Number(b.advance_deduction??advance.total),advance.total);
    const other=Number(b.other_deductions||0), net=basic+allowances+ot-deduction-other;
    try{const r=await env.DB.prepare("INSERT INTO payroll(employee_id,pay_month,basic_salary,overtime_hours,overtime_amount,allowances,advance_deduction,other_deductions,net_salary,status) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(employee.id,b.pay_month,basic,hours,ot,allowances,deduction,other,net,b.status||"unpaid").run();return json({ok:true,id:r.meta.last_row_id,overtimeRate:otRate,overtimeAmount:ot,netSalary:net},201)}catch(e){return json({error:"Payroll may already exist for this employee and month. "+e.message},400)}
  }
  return json({error:"Not found"},404);
}
export default { async fetch(req,env,ctx) { const url=new URL(req.url); if(url.pathname.startsWith("/api/")) return api(req,env); return env.ASSETS.fetch(req); } };
