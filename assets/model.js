'use strict';
// Deterministic domain model shared by every page. All prices / events are demo data.
const KEY='plume-light-multipage-v2',clone=x=>JSON.parse(JSON.stringify(x));
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(n,d=0)=>Number(n).toLocaleString(language==='zh-Hant'?'zh-HK':language,{maximumFractionDigits:d});
const money=n=>'HKD '+fmt(n/100,2),iso=t=>new Date(t).toISOString();
const hk=date=>new Intl.DateTimeFormat(language==='zh-Hant'?'zh-HK':language,{timeZone:'Asia/Hong_Kong',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(date));
const REGIONS={hk:{hours:24,pickupLead:12,factor:1},gba:{hours:48,pickupLead:24,factor:1.4},mainland:{hours:120,pickupLead:72,factor:1.8}};
const PEOPLE=[{id:'lin',name:'Lin Chen',type:'student'},{id:'child',name:'Alex Chen',type:'child'}];
// Demo ticket entitlements and tariffs, independent of live Cathay fare rules.
const DEMO_BAGGAGE_ALLOWANCE={bookingId:'PL-CX257-DEMO',travellers:{lin:{pieces:2,kgPerPiece:23},child:{pieces:1,kgPerPiece:23}}};
const TRANSPORT_RATES={extraPiece:60000,cargoUnit:25000,cargoUnitKg:23,volumeDivisor:6000};
// Normalize legacy partner names in saved demo orders without changing their charges.
function partnerName(value){return String(value??'').replace(/\bDPD\s+UK\b/g,'EBC UK');}
function migratePartnerNames(){
 if(typeof state.partner==='string')state.partner=partnerName(state.partner);
 for(const order of state.orders||[]){
  if(typeof order.partner==='string')order.partner=partnerName(order.partner);
  if(typeof order.quote?.signature==='string')order.quote.signature=partnerName(order.quote.signature);
 }
 for(const event of state.events||[])if(typeof event.direction==='string')event.direction=partnerName(event.direction);
}
function migratePricingState(){
 migratePartnerNames();
 state.extraBags??={};
 if(state.agent?.answer?.kind==='service'&&state.agent.answer.quote?.valid&&state.agent.answer.quote.pricingVersion!==2){state.agent.stale=true;state.agent.answer.stale=true;}
 if(state.flight?.bookingId===DEMO_BAGGAGE_ALLOWANCE.bookingId&&!Object.prototype.hasOwnProperty.call(state.flight,'baggageAllowance'))state.flight.baggageAllowance=clone(DEMO_BAGGAGE_ALLOWANCE);
}
function ticketAllowance(){
 const data=state.flight.baggageAllowance,a=data?.travellers?.[state.travellerId];
 return data?.bookingId===state.flight.bookingId&&a&&Number.isInteger(a.pieces)&&a.pieces>=0&&Number.isFinite(a.kgPerPiece)&&a.kgPerPiece>0?clone(a):null;
}
function baggagePlan(transport=state.transport){
 const d=draft(),items=checked(d).filter(i=>transport==='flight'||!i.service),allowance=ticketAllowance();
 const required=allowance?Math.max(0,items.length-allowance.pieces):0,requested=items.length?(state.extraBags?.[state.travellerId]??0):0;
 // Only the shortfall is billable; old add-ons cannot create a charge after bags are removed.
 const purchased=Number.isSafeInteger(requested)&&requested>=0?Math.min(requested,required):0;
 return {allowance,items:clone(items),required,requested,purchased,quoted:required,missing:Math.max(0,required-purchased),weight:items.reduce((n,i)=>n+(Number(i.weight)||0),0)};
}

function initial(){const items=[{id:'bag-1',name:'@sample.suitcaseA',category:'clothes',weight:20,l:70,w:45,h:30},{id:'bag-2',name:'@sample.suitcaseB',category:'clothes',weight:20,l:70,w:45,h:30},{id:'box-1',name:'@sample.books',category:'books',weight:10,l:60,w:40,h:40},{id:'box-2',name:'@sample.clothes',category:'clothes',weight:10,l:60,w:40,h:40}].map(i=>({...i,mode:'checked',service:true,review:false})),d={items,zero:false,countUnknown:false};return {schema:1,view:'home',step:1,large:false,travellerId:'lin',profile:'student',family:false,assistance:'lifting',flight:{bookingId:'PL-CX257-DEMO',legId:'CX257-20261115',flightNo:'CX257',departure:'2026-11-15T09:30:00+08:00',origin:'HKG',destination:'LHR',terminal:'T3',baggageAllowance:clone(DEMO_BAGGAGE_ALLOWANCE)},extraBags:{},clock:'2026-11-10T09:30:00+08:00',drafts:{lin:clone(d),child:{items:[{...clone(items[0]),id:'child-bag',weight:10}],zero:false,countUnknown:false}},declarations:{lin:{...clone(d),version:1,legId:'CX257-20261115',status:'submitted',updatedAt:'2026-11-09T10:00:00+08:00'}},region:'hk',pickup:'2026-11-12T09:00',pickupAddress:'@sample.address',destinationAddress:'LSE Student Dormitory 6',contact:'Lin Chen',recipient:'Lin Chen',phone:'+852 00000000',partner:'EBC UK',transport:'flight',payment:'cash',agreed:false,milesBalance:100000,frozenMiles:0,orders:[],events:[],nextOrder:1,processing:false,pendingPayment:null,forceFail:false,lastSavedAt:null,ops:{budget:5000,spaceBudget:22,otherWeight:1200,buffer:300,otherSpace:5,spaceBuffer:2,expired:false},agent:{route:'GB',itemId:'bag-1',messages:[],pending:null,answer:null,quality:'current',stale:false}};}

let state,storageOK=true;
try{const saved=JSON.parse(localStorage.getItem(KEY)||'null');state=saved?.schema===1?saved:initial();if(!state.drafts?.lin||!state.agent||!Array.isArray(state.orders))throw Error('invalid');state.processing=false;state.pendingPayment=null;state.frozenMiles=0;}catch(_){state=initial();}
// Existing saved bookings predate the transport choice and used the passenger flight.
if(state.transport==null)state.transport='flight';
migratePricingState();
function persist(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch(_){storageOK=false;}}
const draft=()=>state.drafts[state.travellerId],person=()=>PEOPLE.find(p=>p.id===state.travellerId)||PEOPLE[0],activeOrder=()=>state.orders.find(o=>o.travellerId===state.travellerId&&o.status!=='cancelled');
const checked=d=>d.zero||d.countUnknown?[]:d.items.filter(i=>i.mode==='checked');
const displayValue=value=>typeof value==='string'&&value.startsWith('@sample.')?t(value.slice(1)):String(value??'');
function localHK(t){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Hong_Kong',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(t)),v=k=>parts.find(p=>p.type===k).value;return `${v('year')}-${v('month')}-${v('day')}T${v('hour')}:${v('minute')}`;}
function demand(d){if(!d||d.countUnknown)return {count:null,weight:30,imputed:30,volume:null,review:0};let known=0,imputed=0,volume=0,missing=false;const items=checked(d);for(const i of items){if(i.weight==null)imputed+=20;else known+=Number(i.weight);if([i.l,i.w,i.h].some(v=>v==null))missing=true;else volume+=i.l*i.w*i.h/1e6;}return {count:items.length,weight:known+imputed,imputed,volume:missing?null:volume,review:items.filter(i=>i.review).length};}
function validateDeclaration(d){if(d.zero||d.countUnknown)return null;if(!d.items.length)return 'e.addBaggage';for(const i of d.items){if(!i.name.trim())return 'e.itemName';for(const k of ['weight','l','w','h'])if(i[k]!=null&&(!Number.isFinite(Number(i[k]))||Number(i[k])<=0))return 'e.positive';}return null;}
function aggregateBaggage(){const records=Object.values(state.declarations).filter(d=>d.legId===state.flight.legId&&d.status==='submitted'&&!d.countUnknown),reported=79+records.length,unreported=100-reported;let known=1140,imputed=unreported*30,pieces=114,volume=7+unreported*.15,missing=false,reviews=0;for(const d of records){const q=demand(d);known+=q.weight-q.imputed;imputed+=q.imputed;pieces+=q.count;reviews+=q.review;if(q.volume==null)missing=true;else volume+=q.volume;}return {reported,unreported,coverage:reported,known,imputed,weight:known+imputed,pieces,volume:missing?null:volume,reviews};}
function forecastCapacity(){const a=aggregateBaggage(),o=state.ops;return {...a,weightRemaining:[o.budget,o.otherWeight,o.buffer].some(v=>v==null)?null:o.budget-a.weight-o.otherWeight-o.buffer,spaceRemaining:[o.spaceBudget,o.otherSpace,o.spaceBuffer,a.volume].some(v=>v==null)?null:o.spaceBudget-a.volume-o.otherSpace-o.spaceBuffer,expired:o.expired};}
function checkApplicationDeadline(region=state.region,departure=state.flight.departure,now=state.clock){const r=REGIONS[region],dep=new Date(departure).getTime(),n=new Date(now).getTime();if(!r||!Number.isFinite(dep)||!Number.isFinite(n))return {valid:false,deadline:null,hours:null};return {valid:n<=dep-r.hours*3600000,deadline:iso(dep-r.hours*3600000),hours:r.hours};}
function quoteService(transport=state.transport){
 const d=draft(),items=d.items.filter(i=>!d.zero&&!d.countUnknown&&i.mode==='checked'&&i.service),plan=baggagePlan(transport);
 if(!['flight','cargo'].includes(transport))return {valid:false,error:'e.transport'};
 if(!REGIONS[state.region])return {valid:false,error:'e.region'};
 if(!items.length)return {valid:false,error:'e.serviceBags'};
 if(items.some(i=>[i.weight,i.l,i.w,i.h].some(v=>v==null||!Number.isFinite(Number(v))||Number(v)<=0)))return {valid:false,error:'e.fullSpecs'};
 if(plan.items.length&&!plan.allowance)return {valid:false,error:'e.allowance'};
 if(!Number.isSafeInteger(plan.requested)||plan.requested<0||plan.requested>99)return {valid:false,error:'e.extraQuantity'};
 if(plan.items.some(i=>i.weight==null||!Number.isFinite(Number(i.weight))||Number(i.weight)<=0))return {valid:false,error:'e.flightWeight'};
 if(plan.items.some(i=>Number(i.weight)>plan.allowance.kgPerPiece))return {valid:false,error:'e.pieceWeight'};
 const weight=items.reduce((n,i)=>n+Number(i.weight),0),large=items.filter(i=>Math.max(i.l,i.w,i.h)>100).length;
 const first=Math.round(15000*items.length*REGIONS[state.region].factor),localGBP=Math.round((items.length*12.5+weight*.5+20+large*15)*100);
 const priority=0,extraFee=plan.required*TRANSPORT_RATES.extraPiece;
 const chargeableWeight=transport==='cargo'?items.reduce((n,i)=>n+Math.max(Number(i.weight),i.l*i.w*i.h/TRANSPORT_RATES.volumeDivisor),0):0;
 const cargoUnits=transport==='cargo'?items.reduce((n,i)=>n+Math.ceil(Math.max(Number(i.weight),i.l*i.w*i.h/TRANSPORT_RATES.volumeDivisor)/TRANSPORT_RATES.cargoUnitKg),0):0;
 const cargoFee=cargoUnits*TRANSPORT_RATES.cargoUnit,total=first+localGBP*10+priority+extraFee+cargoFee;
 if(!Number.isSafeInteger(total)||!Number.isFinite(chargeableWeight))return {valid:false,error:'e.fullSpecs'};
 return {valid:true,pricingVersion:2,transport,first,localGBP,priority,extraFee,cargoFee,cargoUnits,chargeableWeight,plan,total,miles:Math.ceil(total/100*25),earn:Math.floor(total/1000),count:items.length,weight,
 signature:JSON.stringify({flight:state.flight,travellerId:state.travellerId,region:state.region,items,airlineItems:plan.items,extraPieces:plan.purchased,requestedExtraPieces:plan.requested,rates:TRANSPORT_RATES,partner:state.partner,transport,pickup:state.pickup,pickupAddress:state.pickupAddress,destination:state.destinationAddress,contact:state.contact,recipient:state.recipient,phone:state.phone})};
}

function isDirty(){const s=state.declarations[state.travellerId];return !s||s.legId!==state.flight.legId||JSON.stringify({items:s.items,zero:s.zero,countUnknown:s.countUnknown})!==JSON.stringify(draft());}
function invalidateAgent(){if(state.agent.answer){state.agent.stale=true;state.agent.answer.stale=true;}}
function saveDeclaration(silent=false){const error=validateDeclaration(draft());if(error){toast(error);return false;}if(!isDirty()){if(!silent)toast('notice.same');return true;}const old=state.declarations[state.travellerId];state.declarations[state.travellerId]={...clone(draft()),version:(old?.version||0)+1,legId:state.flight.legId,status:'submitted',updatedAt:iso(state.clock)};state.lastSavedAt=iso(state.clock);persist();if(!silent)toast('notice.saved');return true;}
function validateService(){if(!['flight','cargo'].includes(state.transport))return 'e.transport';const q=quoteService();if(!q.valid)return q.error;if(q.plan.missing)return 'e.buyAllowance';const err=validateDeclaration(draft());if(err)return err;if(!checkApplicationDeadline().valid)return 'e.deadline';if([state.pickupAddress,state.destinationAddress,state.contact,state.recipient,state.phone].some(v=>!v.trim()))return 'e.contacts';const pickup=new Date(state.pickup+':00+08:00').getTime(),latest=new Date(state.flight.departure).getTime()-REGIONS[state.region].pickupLead*3600000;if(!Number.isFinite(pickup)||pickup<new Date(state.clock).getTime()||pickup>latest)return 'e.pickup';return null;}
function eventCounts(o){const ids=o?.itemIds||[],events=state.events.filter(e=>e.orderId===o?.id),counts={};for(const type of ['airport','loaded','handover'])counts[type]=new Set(events.filter(e=>e.type===type).flatMap(e=>e.itemIds).filter(id=>ids.includes(id))).size;return counts;}
const DEMO_RULE_ROUTES=['GB','AU','IN'];
function serviceIntent(text){
 const checks=[['miles',/里數|里数|万里通|萬里通|\bmiles\b|millas|أميال/i],['deadline',/截止|提前|期限|deadline|how early|before.{0,20}(?:flight|departure)|délai|antelación|plazo|مسبق|موعد/i],['price',/價格|价格|費用|费用|收費|收费|報價|报价|多少錢|多少钱|\bprice\b|\bcost\b|tarif|combien|precio|cuesta|تكلف|سعر/i],['tracking',/追蹤|追踪|進度|进度|狀態|状态|tracking|updates|track.{0,12}(?:bag|luggage)|suivi|étapes|seguimiento|actualizaciones|تتبع|تحديثات/i],['family',/家人|兒童|儿童|小孩|\bchild\b|family|enfant|famille|menor|familia|طفل|الأسرة/i],['delivery',/取件|送達|送达|宿舍|配送|送到|pickup|delivery|collect|livraison|collecte|entrega|recogida|استلام|التوصيل/i]];
 return checks.find(([,pattern])=>pattern.test(text))?.[0]||null;
}
function ruleCategory(text){
 const checks=[['battery',/電池|电池|充電|充电|battery|batterie|batería|bateria|power\s*bank|بطاري|شاحن|\bwh\b/i],['liquids',/液體|液体|洗護|洗护|洗髮|洗发|香水|噴霧|喷雾|liquid|toiletr|shampoo|liquide|toilette|líquido|champú|سوائل|شامبو|عطر/i],['medicine',/藥|药|處方|处方|medicin|prescription|tablet|médicament|ordonnance|medicamento|receta|أدوي|دواء|وصفة/i],['food',/食品|零食|茶葉|茶叶|鮮|鲜|food|snack|\btea\b|aliment|\bthé\b|aperitiv|comida|أطعم|طعام|الشاي|شاي/i],['fragile',/易碎|相機|相机|電腦|电脑|camera|laptop|fragile|ordinateur|photo|portátil|frágil|cámara|كاميرا|حواسيب|الكسر/i],['equipment',/輪椅|轮椅|輔助|辅助|設備|设备|wheelchair|equipment|mobility|fauteuil|équipement|silla|equipo|كرسي|معدات/i],['ordinary',/衣|書|书|clothes|books?|vêtement|livre|ropa|libro|ملابس|كتب/i]];
 return checks.find(([,pattern])=>pattern.test(text))?.[0]||'unknown';
}
function answerRouteScope(route){return route==='AU'?'CX105 · HKG → MEL':route==='IN'?'HKG → DEL':'CX257 · HKG → LHR T3';}
function sendQuestion(question){
 const a=state.agent,text=String(question).trim();if(!text)return;
 a.messages.push({role:'user',text});a.messages=a.messages.slice(-24);a.stale=false;
 const service=serviceIntent(text);
 if(service){a.pending=null;a.answer={kind:'service',topic:service,quote:clone(quoteService()),region:state.region,deadline:checkApplicationDeadline(),balance:state.milesBalance,destination:state.destinationAddress,retrievedAt:iso(state.clock),sourceIds:[],advice:null};a.messages.push({role:'assistant',key:'qa.serviceMessage'});persist();render();return;}
 if(!a.route){a.pending={type:'route'};a.answer=null;a.messages.push({role:'assistant',key:'ai.clarifyRoute'});persist();render();return;}
 const normal=text.replace(/[٠-٩۰-۹]/g,c=>String(c.charCodeAt(0)-(c>='۰'?1776:1632))).replace(/٫/g,'.');
 let category=ruleCategory(text);const energy=normal.match(/(\d+(?:[.,]\d+)?)\s*wh/i),quantity=normal.match(/\d/);
 // Short attribute replies continue the pending topic; a new named topic starts a new enquiry.
 if(a.pending&&category==='unknown'&&['battery','liquids','medicine','food'].includes(a.pending.type))category=a.pending.type;
 const unknown=/不知道|未知|不清楚|unknown|don.t know|inconnu|ne sais|no (?:lo )?s[eé]|desconoc|لا [أا]عرف|غير معروف/i.test(text);
 const needsClarify=category==='battery'&&!energy&&!unknown||category==='liquids'&&!quantity&&!unknown||category==='medicine'&&!quantity&&!unknown||category==='food'&&!a.pending&&(/可以|can I|puis-je|puedo|هل/i.test(text)||text.length<12);
 if(needsClarify){a.pending={type:category};a.answer=null;a.messages.push({role:'assistant',key:category==='battery'?'ai.clarifyBattery':'qa.clarify'+category[0].toUpperCase()+category.slice(1)});persist();render();return;}
 const reason=!DEMO_RULE_ROUTES.includes(a.route)?'ai.gapRoute':a.quality==='expired'?'ai.gapExpired':a.quality==='conflict'?'ai.gapConflict':a.quality==='missing'?'ai.gapMissing':category==='unknown'?'ai.gapItem':null;
 const item=draft().items.find(i=>i.id===a.itemId);
 a.answer={kind:'rules',category,route:a.route,reason,attributes:text,energy:energy?.[1]||null,sourceIds:reason?[]:['ENTRY','CARRIER','SECURITY'],retrievedAt:iso(state.clock),advice:!reason&&item&&a.route==='GB'?{itemId:item.id,type:category==='battery'&&item.category==='battery'?'cabin':'review'}:null};
 a.pending=null;a.messages.push({role:'assistant',key:'ai.resultMessage'});persist();render();
}
function reviewAdvice(){const advice=state.agent.answer?.advice;if(!advice||state.agent.stale)return;const item=draft().items.find(i=>i.id===advice.itemId);if(!item)return;modal(t('ai.adviceTitle'),t(advice.type==='cabin'?'ai.adviceCabin':'ai.adviceReview',{name:displayValue(item.name)}),[{text:t('ai.apply'),action:'apply-advice'},{text:t('common.cancel'),action:'close-dialog',light:true}]);}
function applyAdvice(){const a=state.agent.answer;if(!a?.advice||state.agent.stale)return;const item=draft().items.find(i=>i.id===a.advice.itemId);if(!item)return;if(activeOrder()){toast('e.orderChange');return;}item.review=true;if(a.advice.type==='cabin'){item.mode='cabin';item.service=false;}state.agreed=false;if(!saveDeclaration(true))return;a.advice=null;closeModal();persist();render();toast('notice.applied');}
async function pay(){
 if(state.processing||activeOrder())return;const error=validateService(),q=quoteService();if(error||!q.valid){toast(error||q.error);return;}if(!state.agreed){toast('e.agree');return;}if(state.payment==='miles'&&state.milesBalance<q.miles){toast('e.miles');return;}if(!saveDeclaration(true))return;
 const snapshot={travellerId:state.travellerId,declaration:clone(draft()),flight:clone(state.flight),quote:clone(q),payment:state.payment,extraPieces:q.plan.purchased,allowance:clone(q.plan.allowance),contact:state.contact,phone:state.phone,pickup:state.pickup,pickupAddress:state.pickupAddress,destination:state.destinationAddress,recipient:state.recipient,partner:state.partner,transport:state.transport,region:state.region,itemIds:checked(draft()).filter(i=>i.service).map(i=>i.id)};
 state.processing=true;state.pendingPayment=snapshot;state.frozenMiles=state.payment==='miles'?q.miles:0;persist();render();await new Promise(r=>setTimeout(r,650));if(!state.processing||state.pendingPayment!==snapshot)return;
 const changed=quoteService().signature!==q.signature||state.travellerId!==snapshot.travellerId||state.payment!==snapshot.payment,insufficient=snapshot.payment==='miles'&&state.milesBalance<q.miles;
 if(state.forceFail||changed||insufficient||!checkApplicationDeadline().valid){state.processing=false;state.pendingPayment=null;state.frozenMiles=0;state.forceFail=false;persist();render();toast('notice.failed');return;}
 if(snapshot.payment==='miles')state.milesBalance-=q.miles;
 state.orders.push({...snapshot,id:'PL-20261115-'+String(state.nextOrder++).padStart(3,'0'),status:'paid_demo',earned:false,refunded:false,createdAt:iso(state.clock)});
 state.processing=false;state.pendingPayment=null;state.frozenMiles=0;state.agreed=false;persist();go('journey');
}
function recordHandover(kind){const o=activeOrder();if(!o){toast('e.orderFirst');return;}let type=kind,ids=o.itemIds;const c=eventCounts(o),n=ids.length;if(kind==='partial'){type='loaded';ids=ids.slice(0,Math.max(0,n-1));}if(type==='loaded'&&c.airport<n){toast('e.airportFirst');return;}if(type==='handover'&&c.loaded<n){toast('e.loadedFirst');return;}if(!ids.length){toast('e.partial');return;}const eventId=o.id+':'+type+':'+ids.join(',');if(state.events.some(e=>e.eventId===eventId)){toast('notice.duplicate');return;}state.events.push({eventId,orderId:o.id,type,itemIds:clone(ids),legId:o.flight.legId,confirmedAt:iso(state.clock)});persist();render();toast('notice.event');}
function completeService(){const o=activeOrder();if(!o)return;if(o.status==='completed'){toast('notice.duplicate');return;}if(eventCounts(o).handover<o.itemIds.length){toast('e.localFirst');return;}o.status='completed';if(o.payment==='cash'&&!o.earned){state.milesBalance+=o.quote.earn;o.earned=true;}persist();render();toast('notice.complete');}
function cancelOrder(id,confirmed=false){const o=state.orders.find(o=>o.id===id);if(!o||o.refunded)return;if(!confirmed){modal(t('dialog.cancelTitle'),t('dialog.cancelBody',{id}),[{text:t('dialog.cancelConfirm'),action:'confirm-cancel',id},{text:t('common.cancel'),action:'close-dialog',light:true}]);return;}if(o.earned&&state.milesBalance<o.quote.earn){toast('e.reverse');return;}if(o.payment==='miles')state.milesBalance+=o.quote.miles;if(o.earned){state.milesBalance-=o.quote.earn;o.earned=false;}o.refunded=true;o.status='cancelled';o.cancelledAt=iso(state.clock);persist();closeModal();render();toast('notice.cancelled');}
function resetDemo(scenario){if(state.processing){toast('e.processing');return;}const oldLarge=state.large;state=initial();state.large=oldLarge;let target='home',step=1;if(scenario==='family'){state.travellerId='child';state.profile='child';state.family=true;state.contact='@sample.parent';target='book';}if(scenario==='late'){state.clock='2026-11-14T09:30:01+08:00';target='book';step=4;}if(scenario==='unknown'){state.drafts.lin.items[0].weight=null;state.drafts.lin.items[0].l=null;saveDeclaration(true);target='ops';}persist();go(target,step);}
