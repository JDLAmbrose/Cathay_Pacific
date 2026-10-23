'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
function model(saved){
 const storage=new Map(saved?[['plume-light-multipage-v2',JSON.stringify(saved)]]:[]);
 const context=vm.createContext({console,Intl,Date,setTimeout,localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},document:{documentElement:{}},toast(){},render(){},go(){},closeModal(){}});
 for(const file of ['i18n.js','model.js'])vm.runInContext(fs.readFileSync(path.join(root,'assets',file),'utf8'),context);
 return code=>vm.runInContext(code,context);
}
(async()=>{
 let run=model();
 assert.equal(run('ticketAllowance().pieces'),2);
 assert.equal(run('quoteService().total'),240000);
 assert.equal(run('quoteService().plan.required'),2);
 assert.equal(run('quoteService().extraFee'),120000);
 assert.equal(run('validateService()'),'e.buyAllowance');
 assert.equal(run("quoteService('cargo').total"),195000);
 assert.equal(run("quoteService('cargo').cargoUnits"),3);
 assert.equal(run("quoteService('cargo').chargeableWeight"),56);
 run('state.extraBags.lin=2');assert.equal(run('validateService()'),null);
 const before=run('quoteService().signature');run('state.extraBags.lin=3');assert.notEqual(run('quoteService().signature'),before);
 assert.equal(run('quoteService().extraFee'),120000);
 // Removing bags automatically removes stale extra charges and needs no new purchase.
 const full=model();full('state.extraBags.lin=2;draft().items=draft().items.slice(0,2)');
 assert.equal(full('quoteService().extraFee'),0);assert.equal(full('quoteService().priority'),0);
 assert.equal(full('baggagePlan().purchased'),0);assert.equal(full('validateService()'),null);
 assert.equal(full('quoteService().total'),full('quoteService().serviceFee'));
 full('draft().items=draft().items.slice(0,1)');assert.equal(full('quoteService().extraFee'),0);
 run("state.travellerId='child'");assert.equal(run('ticketAllowance().pieces'),1);assert.equal(run('baggagePlan().purchased'),0);
 assert.equal(run('validateService()'),null);
 run("state.travellerId='lin';state.transport='cargo'");assert.equal(run('quoteService().extraFee'),0);
 assert.equal(run('validateService()'),null);
 run('draft().items.forEach((i,index)=>i.service=index===3);state.extraBags.lin=0');
 assert.equal(run('baggagePlan().required'),1);assert.equal(run('validateService()'),'e.buyAllowance');
 run('state.extraBags.lin=1');assert.equal(run('validateService()'),null);
 run('draft().items[0].weight=null');assert.equal(run('quoteService().error'),'e.flightWeight');
 run('draft().items[0].weight=30');assert.equal(run('quoteService().error'),'e.pieceWeight');
 run('draft().items.forEach((i,index)=>i.service=index<3)');assert.equal(run('quoteService().valid'),true);
 assert.equal(run('quoteService().cargoUnits'),4);
 run("state.transport='flight'");assert.equal(run('quoteService().error'),'e.pieceWeight');
 run('draft().items[0].weight=20;state.extraBags.lin=-1');assert.equal(run('quoteService().error'),'e.extraQuantity');
 run('state.extraBags.lin=1.5');assert.equal(run('quoteService().error'),'e.extraQuantity');
 run('state.extraBags.lin=100');assert.equal(run('quoteService().error'),'e.extraQuantity');
 run("state.extraBags.lin=2;state.flight.bookingId='another-ticket'");assert.equal(run('quoteService().error'),'e.allowance');
 run("state.transport='cargo';draft().items=draft().items.slice(0,3)");assert.equal(run('quoteService().valid'),true);
 const legacy=model()('initial()');delete legacy.flight.baggageAllowance;delete legacy.extraBags;
 assert.equal(model(legacy)('ticketAllowance().pieces'),2);
 legacy.flight.bookingId='unrecognized';assert.equal(model(legacy)('ticketAllowance()'),null);
 const oldPartner=['DPD','UK'].join(' '),saved=model()('initial()');
 saved.partner=oldPartner;
 saved.orders=[{id:'legacy-order',partner:oldPartner,status:'paid_demo',quote:{total:160000,miles:40000,signature:JSON.stringify({partner:oldPartner})}}];
 saved.events=[{eventId:'legacy-event',direction:'Cathay → '+oldPartner}];
 const migrated=model(saved);
 assert.equal(migrated('state.partner'),'EBC UK');assert.equal(migrated('state.orders[0].partner'),'EBC UK');
 assert.equal(migrated('state.orders[0].quote.total'),160000);assert.equal(migrated('state.orders[0].quote.miles'),40000);
 assert.equal(migrated('state.orders[0].id'),'legacy-order');assert.equal(migrated('state.events[0].direction'),'Cathay → EBC UK');
 assert.equal(migrated("partnerName('DHL eCommerce UK')"),'DHL eCommerce UK');
 for(const payment of ['cash','miles']){
  run=model();run(`state.extraBags.lin=2;state.agreed=true;state.payment='${payment}';state.milesBalance=100000`);
  await run('pay()');assert.equal(run('state.orders.length'),1);
  assert.equal(run('state.orders[0].extraPieces'),2);assert.equal(run('state.orders[0].allowance.pieces'),2);
  assert.equal(run('state.orders[0].quote.total'),240000);
  run('state.extraBags.lin=5');assert.equal(run('state.orders[0].extraPieces'),2);
  run("cancelOrder(state.orders[0].id,true)");assert.equal(run('state.orders[0].status'),'cancelled');
  assert.equal(run('state.milesBalance'),100000);
 }
 run=model();run('state.extraBags.lin=2;state.agreed=true');
 const payment=run('pay()');run('state.extraBags.lin=3');await payment;
 assert.equal(run('state.orders.length'),0);assert.equal(run('state.frozenMiles'),0);
 run=model();run("state.transport='cargo';state.agreed=true");await run('pay()');
 assert.equal(run('state.orders[0].quote.cargoFee'),75000);assert.equal(run('state.orders[0].extraPieces'),0);

 // Proposed door-to-door package is per move, with a hard three-bag boundary.
 const packageQuote=model();
 for(const count of [1,2,3]){
  // Restore the sample between counts to exercise each size independently.
  packageQuote(`state=initial();draft().items=draft().items.slice(0,${count})`);
  assert.equal(packageQuote('quoteService().serviceFee'),120000);
  assert.equal(packageQuote('quoteService().pricingVersion'),3);
  assert.equal(packageQuote('quoteService().miles'),packageQuote('Math.ceil(quoteService().total/100*25)'));
 }
 packageQuote('state=initial();draft().items.forEach(i=>i.service=true)');
 assert.equal(packageQuote('quoteService().error'),'e.serviceLimit');
 assert.equal(packageQuote('validateService()'),'e.serviceLimit');
 packageQuote("state=initial();state.region='gba'");assert.equal(packageQuote('quoteService().serviceFee'),168000);
 packageQuote("state.region='mainland'");assert.equal(packageQuote('quoteService().serviceFee'),216000);
 const oldAnswer=model()('initial()');oldAnswer.agent.answer={kind:'service',quote:{valid:true,pricingVersion:2}};
 assert.equal(model(oldAnswer)('state.agent.stale'),true);
 for(const lang of ['zh-Hant','en','fr','es','ar']){
  packageQuote(`setLanguage('${lang}')`);
  assert.match(packageQuote("t('service.packagePrice')"),/HK\$1,200/);
  assert.match(packageQuote("t('service.packageSaving')"),/15/);
 }
 console.log('PASS: ticket allowance, passenger isolation, extra confirmations, cargo pricing and volumetric weight, residual flight bags, missing and overweight data, legacy migration, snapshots, cash/miles refunds and payment quote changes.');
})().catch(error=>{console.error(error);process.exitCode=1});
