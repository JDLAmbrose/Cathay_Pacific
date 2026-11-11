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
function helper(run){run("state.family=true;Object.assign(state.helper,{name:'Demo Helper',identityType:'passport',identityNumber:'DEMO-ONLY',relationship:'parent',memberNo:''})");}
(async()=>{
 let run=app();
 assert.equal(run('BOOK_PAGES.length'),5);
 assert.equal(run("href('book',2)"),'../pages/information.html?v=20261107-aircraft');
 assert.equal(run("href('book',3)"),'../pages/baggage.html?v=20261107-aircraft');
 assert.equal(run("href('book',5)"),'../pages/checkout.html?v=20261107-aircraft');
 assert.equal(run("href('book',4)"),'../pages/pricing.html?v=20261107-aircraft');
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

 run=app();assert.equal(run('validateHelper()'),null);helper(run);
 assert.equal(run('validateHelper()'),null);assert.equal(run('state.helper.memberNo'),'');
 assert.equal(run('submitHelperReview()'),null);assert.equal(run('state.helper.review.status'),'draft');
 run('state.helper.sync=true');assert.equal(run('validateHelper()'),'e.helperProof');
 run("state.helper.proof={id:'test-proof',name:'test.png',type:'image/png',size:1}");
 assert.equal(run('submitHelperReview()'),null);assert.equal(run('state.helper.review.status'),'pending');
 assert.equal(run('state.helper.sharedTrip'),null);
 assert.equal(run('reviewHelperRequest(true)'),true);assert.equal(run('state.helper.sharedTrip.demo'),true);
 run("state.helper.identityNumber='CHANGED';persist()");
 assert.equal(run('state.helper.review.status'),'draft');assert.equal(run('state.helper.sharedTrip'),null);
 run('submitHelperReview();reviewHelperRequest(false)');
 assert.equal(run('state.helper.review.status'),'rejected');assert.equal(run('state.helper.sharedTrip'),null);
 run('submitHelperReview();reviewHelperRequest(true)');
 run("state.travellerId='child';persist()");assert.equal(run('state.helper.sharedTrip'),null);

 // Booking may finish during human review, but sharing starts only after approval.
 run=app();helper(run);run("state.helper.sync=true;state.helper.proof={id:'proof',name:'test.png',type:'image/png',size:1};submitHelperReview();state.extraBags.lin=2;state.agreed=true");
 await run('pay()');assert.equal(run('state.orders.length'),1);assert.equal(run('state.helper.sharedTrip'),null);
 run('reviewHelperRequest(true)');assert.equal(run('state.helper.sharedTrip.order.id'),run('state.orders[0].id'));
 run("recordHandover('airport')");assert.equal(run('state.helper.sharedTrip.order.events.length'),1);
 run('cancelOrder(state.orders[0].id,true)');assert.equal(run('state.helper.sharedTrip.order'),null);
 run('state.helper.sync=false;persist()');assert.equal(run('state.helper.sharedTrip'),null);

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
 run=app();helper(run);run('state.helper.sync=true');
 for(const lang of ['zh-Hant','en','fr','es','ar']){
  run(`setLanguage('${lang}')`);
  for(const code of ['passengerHTML()','informationHTML()','baggageHTML()'])assert.ok(run(code).length>100);
  for(const step of [1,2,3,4,5])run(`state.step=${step};bookHTML()`);
 }
 assert.deepEqual(run.warnings,[]);
 console.log('PASS: five-step routing, read-only passenger/allowance, route-bound providers and cutoffs, optional membership, proof/review/sync lifecycle and revocation, booking during review, mixed-bag pricing, saved choices, multi-category AI advice and all five languages.');
})().catch(error=>{console.error(error);process.exitCode=1});
