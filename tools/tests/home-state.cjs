'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
function home(saved){
 const storage=new Map(saved?[['plume-light-multipage-v2',JSON.stringify(saved)]]:[]);
 const context=vm.createContext({console,Intl,Date,setTimeout,clearTimeout,
  localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
  document:{body:{dataset:{page:'home'}},documentElement:{},addEventListener(){}},
  window:{addEventListener(){}}});
 for(const file of ['i18n.js','model.js','app.js']){
  let source=fs.readFileSync(path.join(root,'assets',file),'utf8');
  // Exercise rendering and real payment transitions without mounting a browser DOM.
  if(file==='app.js')source=source.replace(/persist\(\);render\(\);\s*$/,'');
  vm.runInContext(source,context);
 }
 const run=code=>vm.runInContext(code,context);
 run('render=()=>{};go=()=>{};toast=()=>{};closeModal=()=>{}');
 return run;
}
function intro(run){return run('homeHTML()').split('<section class="home-services"')[0];}
function unbooked(run){
 const html=intro(run);
 assert.match(html,/data-booking-state="unbooked"/);
 assert.doesNotMatch(html,/luggage-tag|class="welcome"|LSE Student Dormitory 6/);
}
(async()=>{
 let run=home();unbooked(run);
 run("draft().items.push({...draft().items[0],id:'draft-only'});state.destinationAddress='Draft address'");
 unbooked(run);
 run('state=initial();state.extraBags.lin=2;state.agreed=true;state.forceFail=true');
 await run('pay()');unbooked(run);
 run('state.agreed=true');
 const pending=run('pay()');unbooked(run);await pending;
 assert.equal(run('state.orders.length'),1);
 assert.equal(run('state.orders[0].itemIds.length'),3);
 assert.match(intro(run),/data-booking-state="booked"/);
 assert.match(intro(run),/LSE Student Dormitory 6/);
 assert.match(intro(run),/<b>03<\/b>/);
 assert.match(intro(run),/2026-11-12 09:00 HKT/);
 // Confirmation details must use the paid order even after draft edits.
 run("state.destinationAddress='Changed draft';state.pickup='2026-11-13T18:00';draft().items=[]");
 assert.match(intro(run),/LSE Student Dormitory 6/);
 assert.match(intro(run),/<b>03<\/b>/);
 assert.doesNotMatch(intro(run),/Changed draft|2026-11-13 18:00/);
 run("state.travellerId='child'");unbooked(run);
 run("state.travellerId='lin'");
 const restored=home(run('clone(state)'));
 assert.match(intro(restored),/data-booking-state="booked"/);
 run("state.orders[0].status='completed'");
 assert.match(intro(run),/data-booking-state="booked"/);
 run('cancelOrder(state.orders[0].id,true)');unbooked(run);
 for(const language of ['zh-Hant','en','fr','es','ar']){
  run(`setLanguage('${language}')`);
  const html=run('homeHTML()');
  assert.match(html,/familyTitle/);
  assert.match(html,/data-family-prepare/);
  for(const key of ['home.beforeBooking','home.bookedNotice','family.intro','family.childText','family.seniorText','family.start','feature.reportShort','feature.rulesShort','feature.deliveryShort','feature.milesShort']){
   assert.notEqual(run(`t('${key}')`),key);
  }
 }
 console.log('PASS: unbooked drafts, pending and failed payment, paid snapshots and service bag counts, saved bookings, passenger isolation, completion, cancellation and five-language family preparation.');
})().catch(error=>{console.error(error);process.exitCode=1});
