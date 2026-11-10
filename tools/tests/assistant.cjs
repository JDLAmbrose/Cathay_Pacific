'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
function setup(fetch){
 const context=vm.createContext({console,Intl,Date,setTimeout,clearTimeout,AbortController,AbortSignal,fetch,location:{protocol:'http:'},
  localStorage:{getItem:()=>null,setItem(){}},document:{body:{dataset:{page:'agent'}},documentElement:{},addEventListener(){},getElementById:()=>null},window:{addEventListener(){}}});
 for(const file of ['i18n.js','model.js','app.js']){
  let source=fs.readFileSync(path.join(root,'assets',file),'utf8');
  if(file==='app.js')source=source.replace(/persist\(\);render\(\);\s*$/,'');
  vm.runInContext(source,context);
 }
 const run=code=>vm.runInContext(code,context);run('render=()=>{};toast=()=>{}');return run;
}
(async()=>{
 let sent=[];
 let run=setup(async(url,options)=>{sent.push(JSON.parse(options.body));return {ok:true,json:async()=>({reply:'Demo quote: HKD 1,800.\n<script>alert(1)</script>',tools:['get_price_context']})};});
 run("state.phone='PRIVATE_PHONE';state.pickupAddress='PRIVATE_ADDRESS';state.helper.identityNumber='PRIVATE_ID';state.destinationAddress='PRIVATE_DESTINATION'");
 await run("sendQuestion('Compare the costs')");
 assert.equal(sent.length,1);
 const body=sent[0];assert.equal(body.context.pricing.current.total,2400);
 assert.equal(body.context.pricing.allCargo.total,1950);
 for(const text of ['PRIVATE_PHONE','PRIVATE_ADDRESS','PRIVATE_ID','PRIVATE_DESTINATION'])assert.ok(!JSON.stringify(body).includes(text));
 assert.equal(run('agentRuntime.pending'),false);
 assert.match(run('agentHTML()'),/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
 assert.doesNotMatch(run('agentHTML()'),/<script>/);
 await run("sendQuestion('And what about the deadline?')");
 assert.equal(sent[1].messages.length,3);
 assert.equal(sent[1].messages[1].role,'assistant');
 assert.equal(run('state.orders.length'),0);
 assert.equal(run('draft().items[0].mode'),'checked');

 let attempts=0;
 run=setup(async()=>{attempts++;return {ok:attempts>1,json:async()=>attempts===1?{error:'provider_subscription_expired'}:{reply:'Recovered',tools:[]}};});
 await run("sendQuestion('Hello')");
 assert.equal(run('agentRuntime.error'),'agent.expired');
 assert.equal(run('state.agent.messages.length'),1);
 await run("sendQuestion('Hello',true)");
 assert.equal(run('state.agent.messages.length'),2); // Retry does not duplicate user turns.
 assert.equal(run('agentRuntime.error'),null);

 let finish;
 run=setup(()=>new Promise(resolve=>{finish=resolve;}));
 let pending=run("sendQuestion('What is my price?')");
 assert.equal(run('agentRuntime.pending'),true);
 await run("sendQuestion('Duplicate click')");
 assert.equal(run('state.agent.messages.length'),1);
 run("draft().items[0].weight=21");
 finish({ok:true,json:async()=>({reply:'Stale answer'})});await pending;
 assert.equal(run('agentRuntime.error'),'agent.contextChanged');
 assert.equal(run('state.agent.messages.length'),1);

 pending=run("sendQuestion('Try again')");
 run('clearAgentConversation()');
 finish({ok:true,json:async()=>({reply:'Should be discarded'})});await pending;
 assert.equal(run('state.agent.messages.length'),0);
 assert.equal(run('agentRuntime.pending'),false);

 run=setup(async(_url,options)=>new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('aborted')))));
 pending=run("sendQuestion('Wait')");run('agentRuntime.controller.abort()');await pending;
 assert.equal(run('agentRuntime.error'),'agent.cancelled');
 assert.equal(run('agentRuntime.pending'),false);

 run=setup(()=>{throw Error('Local mode must not call GLM');});
 run("state.agent.mode='local'");await run("sendQuestion('power bank 74 Wh')");
 assert.equal(run('state.agent.answer.category'),'battery');
 for(const lang of ['zh-Hant','en','fr','es','ar']){
  run(`setLanguage('${lang}');state.agent.mode='live';agentRuntime.error='agent.expired'`);
  assert.ok(run('agentHTML()').length>100);
  assert.equal(run("Object.keys(COPY).filter(k=>k.startsWith('agent.')).every(k=>COPY[k].length===5&&COPY[k].every(Boolean))"),true);
 }
 console.log('PASS: private context projection, quote units, multi-turn history, safe rendering, retry, cancel, stale-response isolation, read-only behavior, offline mode and five languages.');
})().catch(error=>{console.error(error);process.exitCode=1});
