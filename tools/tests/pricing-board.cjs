'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
function app(saved){
 const data=new Map(saved?[['plume-light-multipage-v2',JSON.stringify(saved)]]:[]),warnings=[];
 const context=vm.createContext({Intl,Date,setTimeout,clearTimeout,
  console:{...console,warn:(...args)=>warnings.push(args.join(' '))},
  localStorage:{getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)},
  document:{body:{dataset:{page:'pricing'}},documentElement:{},addEventListener(){},getElementById:()=>null,querySelector:()=>null},window:{addEventListener(){}}});
 for(const file of ['i18n.js','model.js','app.js']){
  let source=fs.readFileSync(path.join(root,'assets',file),'utf8');
  if(file==='app.js')source=source.replace(/persist\(\);render\(\);\s*$/,'');
  vm.runInContext(source,context);
 }
 const run=code=>vm.runInContext(code,context);
 run('render=()=>{};go=()=>{};toast=()=>{};closeModal=()=>{}');run.warnings=warnings;return run;
}
(async()=>{
 let run=app();
 for(const airport of ['HKG','MFM','PEK','PVG','SZX']){
  run(`state=initial();state.flight.origin='${airport}';migrateBookingState()`);
  assert.equal(run('serviceRoute().origin.country'),'CN');
  assert.equal(run('serviceRoute().origin.regions.join()'),'hk,gba,mainland');
 }
 for(const country of ['HK','MO','CN']){
  run(`state=initial();state.flight.originCountry='${country}';migrateBookingState()`);
  assert.equal(run('serviceRoute().origin.country'),'CN');
 }
 for(const airport of ['LHR','NRT','MEL','CDG']){
  run(`state=initial();state.flight.origin='${airport}';migrateBookingState()`);
  assert.equal(run('state.region'),'mainland');
  assert.equal(run('serviceRoute().origin.regions.join()'),'mainland');
  assert.equal(run('checkApplicationDeadline().hours'),120);
  assert.equal(run('serviceRoute().origin.providers.includes(state.pickupPartner)'),true);
  assert.doesNotMatch(run('informationHTML()'),/起飛前 24 小時|起飛前 48 小時|最遲取件/);
 }
 run('state=initial();migrateBookingState()');
 assert.doesNotMatch(run('informationHTML()'),/中國 · 香港|英國 · 倫敦|HKG|LHR|最遲取件/);
 assert.match(run('informationHTML()'),/最遲下單時間/);
 for(const [region,hours] of [['hk',24],['gba',48],['mainland',120]]){
  run(`state.region='${region}';state.clock=new Date(new Date(state.flight.departure).getTime()-${hours}*3600000).toISOString()`);
  assert.equal(run('checkApplicationDeadline().valid'),true);
  run('state.clock=new Date(new Date(state.clock).getTime()+1).toISOString()');
  assert.equal(run('checkApplicationDeadline().valid'),false);
 }
 run('state=initial();migrateBookingState();state.destinationAddress="Keep this address";state.flight.destination="LGW";migrateBookingState()');
 assert.equal(run('state.destinationAddress'),'Keep this address');

 run=app();assert.equal(run('preparePricingBoard()'),true);
 assert.equal(run("draft().items.find(i=>i.id==='box-2').mode"),'cabin');
 assert.equal(run('preparePricingBoard()'),false);
 assert.equal(run('pricingQuote().total'),180000);
 assert.equal(run('pricingQuote().plan.required'),1);
 for(const weight of [null,7,7.01,20]){
  run(`draft().items[0].weight=${weight}`);
  const before=run('JSON.stringify(draft())');
  assert.equal(run("setPricingLane('bag-1','cabin')"),false);
  assert.equal(run('JSON.stringify(draft())'),before);
 }
 run('draft().items[0].weight=20');
 assert.equal(run("setPricingLane('bag-1','cargo')"),true);
 assert.equal(run('pricingQuote().total'),145000);
 assert.equal(run('pricingQuote().plan.required'),0);
 assert.equal(run('pricingQuote().cargoUnits'),1);
 assert.equal(run('state.transport'),'mixed');
 assert.equal(run("setPricingLane('bag-1','flight')"),true);
 assert.equal(run('pricingQuote().total'),180000);
 assert.equal(run("setPricingLane('box-2','flight')"),true);
 assert.equal(run('pricingQuote().valid'),true);
 assert.equal(run('pricingQuote().count'),4);
 assert.equal(run('pricingQuote().total'),240000);
 run("setPricingLane('box-2','cabin');setPricingLane('bag-1','cargo');saveDeclaration(true)");
 assert.equal(run('pricingQuote().total'),145000);
 const snapshot=run('clone(state)'),restored=app(snapshot);
 assert.equal(restored('pricingQuote().total'),145000);
 assert.equal(restored("pricingLane(draft().items.find(i=>i.id==='bag-1'))"),'cargo');
 assert.equal(restored("state.declarations.lin.items.find(i=>i.id==='bag-1').carriage"),'cargo');
 const before=run('pricingQuote().signature');
 assert.equal(run("setPricingLane('missing','flight')"),false);
 assert.equal(run("setPricingLane('bag-1','invalid')"),false);
 assert.equal(run('pricingQuote().signature'),before);
 run('state.processing=true');assert.equal(run("setPricingLane('bag-1','cabin')"),false);run('state.processing=false');
 run("state.orders.push({id:'paid',travellerId:'lin',status:'paid_demo'})");
 assert.equal(run("setPricingLane('bag-1','cabin')"),false);
 run("state.orders[0].status='cancelled';draft().items.forEach(i=>{i.weight=6.9;setPricingLane(i.id,'cabin');})");
 assert.equal(run('pricingQuote().valid'),true);assert.equal(run('pricingQuote().total'),0);assert.equal(run('pricingQuote().serviceFee'),0);
 assert.match(run('bookHTML()'),/finish-declaration/);
 run('draft().countUnknown=true');assert.equal(run('pricingQuote().valid'),false);
 assert.equal(run('pricingQuote().error'),'pricing.unknownCount');
 run("draft().countUnknown=false;setPricingLane('bag-1','cargo');draft().items[0].weight=null");
 assert.equal(run('pricingQuote().error'),'e.fullSpecs');

 // An old saved cabin assignment must be reviewed without changing its transport.
 run=app();
 run("preparePricingBoard();draft().items.find(i=>i.id==='box-2').weight=10");
 const oldCabin=app(run('clone(state)'));
 assert.equal(oldCabin('pricingQuote().error'),'e.cabinWeightLimit');
 assert.equal(oldCabin("pricingLane(draft().items.find(i=>i.id==='box-2'))"),'cabin');
 assert.equal(oldCabin("setPricingLane('box-2','flight')"),true);
 assert.equal(oldCabin('pricingQuote().valid'),true);

 // Moving to a lane updates the same declaration used by quote, checkout and order snapshots.
 run=app();run("preparePricingBoard();setPricingLane('bag-1','cargo');state.agreed=true");
 assert.equal(run('validateService()'),null);await run('pay()');
 assert.equal(run('state.orders[0].quote.total'),145000);
 assert.equal(run('state.orders[0].transport'),'mixed');
 assert.equal(run("state.orders[0].declaration.items.find(i=>i.id==='box-2').mode"),'cabin');
 assert.equal(run("setPricingLane('bag-1','flight')"),false);
 assert.equal(run('state.orders[0].quote.total'),145000);

 run=app();
 for(const language of ['zh-Hant','en','fr','es','ar']){
  run(`setLanguage('${language}')`);
  assert.match(run('pricingHTML()'),/data-drop-lane="cabin"/);
  assert.match(run('pricingHTML()'),/data-drop-lane="flight"/);
  assert.match(run('pricingHTML()'),/data-drop-lane="cargo"/);
  assert.match(run('baggageHTML()'),/class="notice"><strong>/);
  assert.doesNotMatch(run('baggageHTML()'),/carriage-options|own-bag-mode/);
  assert.doesNotMatch(run('pricingHTML()'),/pricing-move|<select/);
 }
 assert.deepEqual(run.warnings,[]);
 console.log('PASS: country-only identification, China/HK/Macao and foreign-country windows, exact order deadlines, cabin weight checks, shared-package charges, unknown/zero/error states, saved assignments, paid-order isolation and five-language price UI.');
})().catch(error=>{console.error(error);process.exitCode=1});
