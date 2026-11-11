'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
function app(saved){
 const storage=new Map(saved?[['plume-light-multipage-v2',JSON.stringify(saved)]]:[]),warnings=[];
 const context=vm.createContext({Intl,Date,setTimeout,clearTimeout,
  console:{...console,warn:(...args)=>warnings.push(args.join(' '))},
  localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
  document:{body:{dataset:{page:'passenger'}},documentElement:{},addEventListener(){},getElementById:()=>null,querySelector:()=>null},window:{addEventListener(){}}});
 for(const file of ['i18n.js','model.js','app.js']){
  let source=fs.readFileSync(path.join(root,'assets',file),'utf8');
  if(file==='app.js')source=source.replace(/persist\(\);render\(\);\s*$/,'');
  vm.runInContext(source,context);
 }
 const run=code=>vm.runInContext(code,context);
 run('render=()=>{};go=()=>{};toast=()=>{};closeModal=()=>{}');
 run.warnings=warnings;return run;
}
(async()=>{
 let run=app();
 assert.equal(run('BOOK_PAGES.length'),5);
 assert.equal(run("href('book',2)").split('?')[0],'../pages/information.html');
 assert.equal(run("href('book',3)").split('?')[0],'../pages/baggage.html');
 assert.equal(run("href('book',5)").split('?')[0],'../pages/checkout.html');
 assert.equal(run("href('book',4)").split('?')[0],'../pages/pricing.html');
 assert.doesNotMatch(run('bookHTML()'),/liveSummary|rules\.html|delivery\.html/);
 const passenger=run('passengerHTML()');
 assert.match(passenger,/Lin Chen/);assert.match(passenger,/免費托運 2 件，每件最多 23 kg/);
 assert.doesNotMatch(passenger,/data-field="(?:travellerId|profile|contact|phone)"/);
 run("state.travellerId='child'");assert.match(run('passengerHTML()'),/免費托運 1 件/);
 run("state.travellerId='lin'");
 assert.equal(run('validateInformation()'),null);
 assert.match(run('informationHTML()'),/SF Express/);assert.match(run('informationHTML()'),/Parcelforce/);
 assert.match(run('informationHTML()'),/起飛前 24 小時/);assert.match(run('informationHTML()'),/起飛前 48 小時/);assert.match(run('informationHTML()'),/起飛前 120 小時/);assert.doesNotMatch(run('informationHTML()'),/起飛前 12 小時|最遲取件/);
 run("state.flight.destination='MEL';migrateBookingState()");
 assert.equal(run('state.destinationAddress'),'');assert.equal(run('state.partner'),'Australia Post');
 assert.doesNotMatch(run('informationHTML()'),/EBC UK/);
 run("state.flight.origin='ZZZ';migrateBookingState()");assert.equal(run('validateInformation()'),'e.routeProviders');

 run=app();
 assert.equal(run('validateHelper()'),null);
 run('state.family=true');
 assert.equal(run('validateHelper()'),'helper.noContactsTitle');
 assert.equal(run('simulateFamilyLink(state.familyLink,FAMILY_MEMBER_ID)'),true);
 assert.equal(run('validateHelper()'),'helper.select');
 assert.match(run('helperHTML()'),/Lin Chen/);
 assert.match(run('helperHTML()'),/Alex Chen/);
 run("selectHelper(helperContacts().find(contact=>contact.name==='Alex Chen').id)");
 assert.equal(run('selectedHelper().memberNo'),'1600654321');
 assert.equal(run('sendHelperRequest()'),true);
 assert.equal(run('sendHelperRequest()'),false);
 assert.equal(run('pendingHelperRequest().recipient'),'alex.chen@example.com');
 assert.equal(run('validateHelper()'),'helper.waiting');
 assert.equal(run('startNewHelperApplication()'),true);
 assert.equal(run('validateHelper()'),null);

 run("state.family=true;const demoMember=linkedFamilyMember('child')");
 assert.equal(run('requestFamilyChange(demoMember)'),true);
 assert.match(run("familyChangeHTML(demoMember,'child')"),/data-action="family-change-preview"/);
 assert.equal(run('reviewFamilyChange(demoMember,false)'),true);
 assert.match(run('helperHTML()'),/Alex Chen/);
 assert.equal(run('requestFamilyChange(demoMember)'),true);
 assert.equal(run('reviewFamilyChange(demoMember,true)'),true);
 assert.doesNotMatch(run('helperHTML()'),/Alex Chen/);

 // Mixed bags consume the ticket allowance only when travelling on the flight.
 run=app();
 run("setItemField({dataset:{id:'bag-1',itemField:'carriage'},value:'cargo'})");
 assert.equal(run('state.transport'),'mixed');assert.equal(run('quoteService().transport'),'mixed');
 assert.equal(run('quoteService().plan.required'),1);assert.equal(run('quoteService().cargoUnits'),1);
 assert.equal(run('quoteService().total'),205000);
 assert.equal(run("quoteService('flight').total"),240000);assert.equal(run("quoteService('cargo').total"),195000);
 run("setItemField({dataset:{id:'bag-2',itemField:'carriage'},value:'self'})");
 assert.equal(run('quoteService().count'),2);assert.equal(run('quoteService().plan.items.length'),3);
 run("setField({dataset:{field:'transport'},type:'radio',value:'cargo'})");
 assert.equal(run('quoteService().plan.required'),0);assert.equal(run('quoteService().total'),170000);
 const saved=run('clone(state)'),restored=app(saved);
 assert.equal(restored('quoteService().total'),170000);
 run=app();run("state.agent.mode='local';draft().items[0].categories=['books','battery'];sendQuestion('power bank 74 Wh')");
 assert.equal(run('state.agent.answer.advice.type'),'cabin');

 // Render every new panel in every supported language and catch missing copy keys.
 run=app();run('state.family=true;simulateFamilyLink(state.familyLink,FAMILY_MEMBER_ID)');
 for(const lang of ['zh-Hant','en','fr','es','ar']){
  run(`setLanguage('${lang}')`);
  for(const code of ['passengerHTML()','informationHTML()','baggageHTML()'])assert.ok(run(code).length>100);
  for(const step of [1,2,3,4,5])run(`state.step=${step};bookHTML()`);
 }
 assert.deepEqual(run.warnings,[]);
 console.log('PASS: five-step routing, read-only passenger/allowance, route-bound providers and cutoffs, confirmed helper selection, request lifecycle, simulated removal, mixed-bag pricing, saved choices, multi-category AI advice and all five languages.');
})().catch(error=>{console.error(error);process.exitCode=1});
