// Sistema Condomínio Rua Glaziou, 30 — versão funcional segura
(function(){
'use strict';

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const APTOS_FIXOS = ["101","101 Fundos","201","201 Sala","201 Fundos","301","301 Sala","301 Fundos"];
const FIXOS = { taxa:160, emitente:"Gabriel Brito Cirilo", rua:"Rua Glaziou, 30", bairro:"Pilares - RJ", cep:"20750-010", cidade:"Rio de Janeiro", isento:"101 Fundos", logo:"logo.png" };
const K = { aptos:"glaziou_aptos_v10", recibos:"glaziou_recibos_v10", despesas:"glaziou_despesas_v10", caixa:"glaziou_caixa_v10", seq:"glaziou_seq_v10", logo:"glaziou_logo_v10" };

let state = { aptos:[], recibos:[], despesas:[], caixa:{saldoInicial:0,saldoReal:0}, logoData:"" };

function $(id){ return document.getElementById(id); }
function all(sel){ return Array.from(document.querySelectorAll(sel)); }
function money(n){ return (Number(n)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
function inputMoney(n){ return (Number(n)||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function parseMoney(v){ if(v==null) return 0; return Number(String(v).replace(/\./g,'').replace(',','.').replace(/[^0-9.-]/g,''))||0; }
function save(k,v){ localStorage.setItem(k, JSON.stringify(v)); }
function load(k,fb){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):fb; }catch(e){ return fb; } }
function uid(){ return 'id_'+Date.now()+'_'+Math.random().toString(16).slice(2); }
function today(){ const d=new Date(); return {dia:d.getDate(), mes:d.getMonth(), ano:d.getFullYear()}; }
function pad(n){ return String(n).padStart(6,'0'); }
function monthYear(m,y){ return `${MESES[Number(m)]}/${y}`; }
function endereco(ap){ return `${FIXOS.rua} — Apto ${ap} / ${FIXOS.bairro}`; }
function apto(id){ return state.aptos.find(a=>a.id===id || a.name===id); }
function selectedMonths(){ return all('.month-check:checked').map(x=>Number(x.value)).sort((a,b)=>a-b); }
function nextNum(){ return pad((Number(localStorage.getItem(K.seq)||0)+1)); }
function consumeNum(){ const n=Number(localStorage.getItem(K.seq)||0)+1; localStorage.setItem(K.seq,String(n)); return pad(n); }
function syncSeq(){ let max=Number(localStorage.getItem(K.seq)||0); state.recibos.forEach(r=>{ const n=Number(String(r.number||'').replace(/\D/g,''))||0; if(n>max) max=n; }); localStorage.setItem(K.seq,String(max)); }
function setText(id, txt){ const el=$(id); if(el) el.textContent=txt; }
function setValue(id, val){ const el=$(id); if(el) el.value=val; }
function val(id){ const el=$(id); return el?el.value:''; }
function checked(id){ const el=$(id); return !!(el&&el.checked); }

function migrateOld(){
  const oldA = load('cond_apartments_v3', null);
  const oldR = load('cond_receipts_v3', null);
  const oldD = load('cond_expenses_v3', null);
  if(!localStorage.getItem(K.aptos) && Array.isArray(oldA)){
    const arr = oldA.map(a=>({ id:a.id||a.name, name:a.name||a.id, residentName:a.residentName||'', balance:Number(a.balance||0), justification:a.justification||'', exemptCondo:(a.name||a.id)===FIXOS.isento || !!a.exemptCondo }));
    save(K.aptos, arr);
  }
  if(!localStorage.getItem(K.recibos) && Array.isArray(oldR)) save(K.recibos, oldR);
  if(!localStorage.getItem(K.despesas) && Array.isArray(oldD)) save(K.despesas, oldD);
}

function initData(){
  migrateOld();
  state.aptos = load(K.aptos, []);
  APTOS_FIXOS.forEach(nome=>{
    if(!state.aptos.find(a=>a.name===nome || a.id===nome)) state.aptos.push({id:nome,name:nome,residentName:'',balance:0,justification:'',exemptCondo:nome===FIXOS.isento});
  });
  state.aptos.forEach(a=>{ if(a.name===FIXOS.isento || a.id===FIXOS.isento){ a.exemptCondo=true; a.balance=0; } if(a.justification==null) a.justification=''; });
  save(K.aptos,state.aptos);
  state.recibos = load(K.recibos, []);
  state.despesas = load(K.despesas, []);
  state.caixa = load(K.caixa, {saldoInicial:0,saldoReal:0});
  syncSeq();
}

function fillSelects(){
  const t=today();
  const recApto=$('recApto'); if(recApto){ recApto.innerHTML=''; state.aptos.slice().sort((a,b)=>a.name.localeCompare(b.name)).forEach(a=>{ const o=document.createElement('option'); o.value=a.id; o.textContent=a.name; recApto.appendChild(o); }); }
  ['despMes','histMes'].forEach(id=>{ const s=$(id); if(!s) return; s.innerHTML=''; if(id==='histMes'){ const o=document.createElement('option'); o.value='-1'; o.textContent='Todos'; s.appendChild(o); } MESES.forEach((m,i)=>{ const o=document.createElement('option'); o.value=i; o.textContent=m; s.appendChild(o); }); });
  const dia=$('despDia'); if(dia){ dia.innerHTML=''; for(let i=1;i<=31;i++){ const o=document.createElement('option'); o.value=i; o.textContent=i; dia.appendChild(o); } }
  const months=$('monthChecklist'); if(months){ months.innerHTML=''; MESES.forEach((m,i)=>{ const lab=document.createElement('label'); lab.className='month-item'; lab.innerHTML=`<input type="checkbox" class="month-check" value="${i}"> <span>${m}</span>`; months.appendChild(lab); }); const c=months.querySelectorAll('.month-check')[t.mes]; if(c) c.checked=true; }
  setValue('recNumero', nextNum()); setValue('recAnoRef', t.ano); setValue('recDiaAtual', t.dia); setValue('recCondominio', inputMoney(FIXOS.taxa)); setValue('recPagoAgora','0,00');
  setValue('despAno', t.ano); setValue('despMes', t.mes); setValue('despDia', t.dia); setValue('histAno', t.ano); setValue('histMes','-1');
  setValue('saldoInicial', inputMoney(state.caixa.saldoInicial)); setValue('saldoReal', inputMoney(state.caixa.saldoReal));
}

function calcReceipt(){
  const ap=apto(val('recApto')); if(!ap) return null;
  const meses=selectedMonths(); const ano=Number(val('recAnoRef'))||today().ano; const dia=Number(val('recDiaAtual'))||today().dia;
  const include=checked('ckCondo');
  const condo = include && !ap.exemptCondo ? FIXOS.taxa : 0;
  const lancado = meses.length * condo;
  const pago = parseMoney(val('recPagoAgora'));
  const anterior = Number(ap.balance||0);
  let restante = anterior + lancado - pago;
  if(ap.exemptCondo && include){ restante = Math.max(0, anterior - pago); }
  const status = restante>0 ? (restante<FIXOS.taxa?'Parcial':'Em aberto') : (restante<0?'Crédito':'Quitado');
  return { ap, meses, ano, dia, include, condo, lancado, pago, anterior, restante, status, nome:val('recNome').trim(), referente:'Condomínio' };
}

function updatePreview(){
  const d=calcReceipt(); if(!d) return;
  setText('enderecoLinha', endereco(d.ap.name)); setValue('recCondominio', inputMoney(d.ap.exemptCondo?0:FIXOS.taxa));
  setValue('recSaldoAnterior', money(d.anterior)); setValue('recTotalLancado', money(d.lancado)); setValue('recSaldoRestante', money(d.restante)); setValue('recSituacao', d.status);
  const meses = d.meses.length?d.meses.map(m=>monthYear(m,d.ano)).join(', '):'Nenhum mês selecionado';
  const linhas=[];
  linhas.push(`Recebido de: ${d.nome || '__________________________'}`);
  linhas.push(`Endereço: ${endereco(d.ap.name)}`); linhas.push(`CEP: ${FIXOS.cep}`); linhas.push('');
  linhas.push(`Referente a: Condomínio`); linhas.push(`Mês/Referência: ${meses}`); linhas.push(''); linhas.push('Valores recebidos:');
  linhas.push(`Condomínio: ${money(d.lancado)}`); linhas.push(''); linhas.push(`TOTAL: ${money(d.pago)}`);
  if(d.anterior>0 || d.restante>0){ linhas.push(''); linhas.push(`Saldo anterior: ${money(d.anterior)}`); linhas.push(`Valor pago: ${money(d.pago)}`); linhas.push(`Saldo restante: ${money(Math.max(0,d.restante))}`); }
  linhas.push(''); linhas.push(`${FIXOS.cidade}, dia ${d.dia} de ${MESES[today().mes]} de ${today().ano}`); linhas.push(''); linhas.push(`Emitente: ${FIXOS.emitente}`);
  setText('recPreview', linhas.join('\n'));
}

function saveReceipt(){
  const d=calcReceipt(); if(!d) return alert('Erro ao calcular recibo.');
  if(!d.nome) return alert('Digite o nome do morador/proprietário.');
  if(!d.meses.length) return alert('Selecione pelo menos um mês.');
  const editId=val('editingReceiptId');
  if(editId){
    const r=state.recibos.find(x=>x.id===editId); if(r) Object.assign(r,{apartmentName:d.ap.name,residentName:d.nome,year:d.ano,months:d.meses,referente:d.referente,condoPerMonth:d.condo,previousBalance:d.anterior,launchedNow:d.lancado,paidNow:d.pago,remainingBalance:d.restante,status:d.status,issueDay:d.dia,issueMonth:today().mes,issueYear:today().ano,updatedAt:Date.now()});
    setValue('editingReceiptId','');
  }else{
    const r={id:uid(),number:consumeNum(),apartmentName:d.ap.name,residentName:d.nome,year:d.ano,months:d.meses,referente:d.referente,condoPerMonth:d.condo,waterPerMonth:0,previousBalance:d.anterior,launchedNow:d.lancado,paidNow:d.pago,remainingBalance:d.restante,status:d.status,issueDay:d.dia,issueMonth:today().mes,issueYear:today().ano,createdAt:Date.now()};
    state.recibos.push(r);
    generateReceiptPDF(r);
  }
  const ap=apto(d.ap.id); if(ap){ ap.residentName=d.nome; ap.balance=d.ap.exemptCondo?0:Math.max(0,d.restante); }
  save(K.aptos,state.aptos); save(K.recibos,state.recibos);
  setValue('recNumero', nextNum()); renderAll(); updatePreview();
}

function renderAptos(){
  const tb=$('tbodyApartamentos'); if(!tb) return; tb.innerHTML='';
  state.aptos.slice().sort((a,b)=>a.name.localeCompare(b.name)).forEach(a=>{
    const tr=document.createElement('tr');
    const lock=a.name===FIXOS.isento;
    tr.innerHTML=`<td>${a.name}</td><td><input data-apnome="${a.id}" value="${a.residentName||''}"></td><td><input data-apsaldo="${a.id}" value="${inputMoney(lock?0:a.balance||0)}" ${lock?'readonly':''}></td><td><input data-apjust="${a.id}" value="${a.justification||''}" placeholder="Justificativa"></td><td><input type="checkbox" data-apisento="${a.id}" ${a.exemptCondo?'checked':''} ${lock?'disabled':''}></td><td class="actions"><button class="linkbtn" data-apsave="${a.id}">Salvar</button></td>`;
    tb.appendChild(tr);
  });
  tb.querySelectorAll('[data-apsave]').forEach(b=>b.onclick=()=>{ const id=b.dataset.apsave; const a=apto(id); if(!a) return; a.residentName=tb.querySelector(`[data-apnome="${CSS.escape(id)}"]`).value.trim(); a.justification=tb.querySelector(`[data-apjust="${CSS.escape(id)}"]`).value.trim(); if(a.name!==FIXOS.isento){ a.balance=parseMoney(tb.querySelector(`[data-apsaldo="${CSS.escape(id)}"]`).value); a.exemptCondo=tb.querySelector(`[data-apisento="${CSS.escape(id)}"]`).checked; } else { a.balance=0; a.exemptCondo=true; } save(K.aptos,state.aptos); renderAll(); updatePreview(); });
}

function addExpense(){
  const edit=val('editingExpenseId'); const value=parseMoney(val('despValor')); if(!value) return alert('Digite o valor da despesa.');
  const obj={day:Number(val('despDia'))||today().dia,month:Number(val('despMes'))||today().mes,year:Number(val('despAno'))||today().ano,category:val('despCat')||'Outros',description:val('despDesc').trim(),value,updatedAt:Date.now()};
  if(edit){ const e=state.despesas.find(x=>x.id===edit); if(e) Object.assign(e,obj); setValue('editingExpenseId',''); }
  else state.despesas.push(Object.assign({id:uid(),createdAt:Date.now()},obj));
  save(K.despesas,state.despesas); setValue('despValor',''); setValue('despDesc',''); renderAll();
}

function renderDespesas(){
  const tb=$('tbodyDespesas'); if(!tb) return; tb.innerHTML='';
  state.despesas.slice().sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).forEach(e=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${String(e.day).padStart(2,'0')}/${String(Number(e.month)+1).padStart(2,'0')}/${e.year}</td><td>${e.category}</td><td>${e.description||''}</td><td>${money(e.value)}</td><td class="actions"><button class="linkbtn" data-expdf="${e.id}">PDF</button><button class="linkbtn" data-expedit="${e.id}">Editar</button><button class="linkbtn" data-expdel="${e.id}">Excluir</button></td>`;
    tb.appendChild(tr);
  });
  tb.querySelectorAll('[data-expdel]').forEach(b=>b.onclick=()=>{ if(confirm('Excluir esta despesa?')){ state.despesas=state.despesas.filter(e=>e.id!==b.dataset.expdel); save(K.despesas,state.despesas); renderAll(); }});
  tb.querySelectorAll('[data-expedit]').forEach(b=>b.onclick=()=>{ const e=state.despesas.find(x=>x.id===b.dataset.expedit); if(!e) return; setValue('editingExpenseId',e.id); setValue('despDia',e.day); setValue('despMes',e.month); setValue('despAno',e.year); setValue('despCat',e.category); setValue('despValor',inputMoney(e.value)); setValue('despDesc',e.description||''); showTab('despesas'); });
  tb.querySelectorAll('[data-expdf]').forEach(b=>b.onclick=()=>{ const e=state.despesas.find(x=>x.id===b.dataset.expdf); if(e) generateExpensePDF(e); });
}

function filter(){ const y=Number(val('histAno'))||null; const m=Number(val('histMes')); return {y, m:m>=0?m:null}; }
function filtRec(){ const f=filter(); return state.recibos.filter(r=>(!f.y||Number(r.year)===f.y)&&(f.m===null||(r.months||[]).map(Number).includes(f.m))); }
function filtDesp(){ const f=filter(); return state.despesas.filter(e=>(!f.y||Number(e.year)===f.y)&&(f.m===null||Number(e.month)===f.m)); }
function totals(){ const rec=filtRec(), des=filtDesp(); const recebido=rec.reduce((s,r)=>s+Number(r.paidNow||0),0); const lancado=rec.reduce((s,r)=>s+Number(r.launchedNow||0),0); const despesas=des.reduce((s,e)=>s+Number(e.value||0),0); const esperado=Number(state.caixa.saldoInicial||0)+recebido-despesas; const real=Number(state.caixa.saldoReal||0); return {rec,des,recebido,lancado,despesas,esperado,real,dif:real-esperado}; }
function renderHistorico(){
  const t=totals(); const cls=t.dif>=0?'🟢 POSITIVO':'🔴 NEGATIVO';
  const html=`<div><b>Total recebido:</b> ${money(t.recebido)}</div><div><b>Total despesas:</b> ${money(t.despesas)}</div><div><b>Saldo esperado:</b> ${money(t.esperado)}</div><div><b>Saldo real:</b> ${money(t.real)}</div><div><b>Diferença:</b> ${money(t.dif)} — ${cls}</div>`;
  const hist=$('histTotais'); if(hist) hist.innerHTML=html; const prest=$('prestacaoResumo'); if(prest) prest.innerHTML=html;
  const tb=$('tbodyHistorico'); if(!tb) return; tb.innerHTML='';
  t.rec.slice().sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).forEach(r=>{ const ref=(r.months||[]).map(m=>monthYear(m,r.year)).join(', '); const tr=document.createElement('tr'); tr.innerHTML=`<td>${r.number}</td><td>${ref}</td><td>${r.apartmentName}</td><td>${r.residentName}</td><td>${money(r.paidNow)}</td><td>${money(r.remainingBalance)}</td><td>${String(r.issueDay).padStart(2,'0')}/${String(Number(r.issueMonth)+1).padStart(2,'0')}/${r.issueYear}</td><td class="actions"><button class="linkbtn" data-pdf="${r.id}">PDF</button><button class="linkbtn" data-edit="${r.id}">Editar</button><button class="linkbtn" data-refazer="${r.id}">Refazer</button><button class="linkbtn" data-del="${r.id}">Excluir</button></td>`; tb.appendChild(tr); });
  tb.querySelectorAll('[data-pdf]').forEach(b=>b.onclick=()=>{ const r=state.recibos.find(x=>x.id===b.dataset.pdf); if(r) generateReceiptPDF(r); });
  tb.querySelectorAll('[data-edit],[data-refazer]').forEach(b=>b.onclick=()=>{ const id=b.dataset.edit||b.dataset.refazer; const r=state.recibos.find(x=>x.id===id); if(!r) return; setValue('editingReceiptId',b.dataset.edit?id:''); setValue('recApto', state.aptos.find(a=>a.name===r.apartmentName)?.id || r.apartmentName); setValue('recNome',r.residentName||''); setValue('recAnoRef',r.year); setValue('recPagoAgora',inputMoney(r.paidNow)); all('.month-check').forEach(c=>c.checked=(r.months||[]).map(Number).includes(Number(c.value))); showTab('recibo'); updatePreview(); });
  tb.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{ if(confirm('Excluir este recibo? O saldo dos apartamentos será recalculado.')){ state.recibos=state.recibos.filter(r=>r.id!==b.dataset.del); save(K.recibos,state.recibos); recalculateBalances(); renderAll(); }});
}
function recalculateBalances(){ state.aptos.forEach(a=>{ if(a.name===FIXOS.isento){a.balance=0;a.exemptCondo=true;} else a.balance=0; }); state.recibos.slice().sort((a,b)=>(a.createdAt||0)-(b.createdAt||0)).forEach(r=>{ const a=state.aptos.find(x=>x.name===r.apartmentName||x.id===r.apartmentName); if(a&&!a.exemptCondo){ a.balance=Math.max(0,Number(a.balance||0)+Number(r.launchedNow||0)-Number(r.paidNow||0)); a.residentName=r.residentName||a.residentName; }}); save(K.aptos,state.aptos); }

async function logo(){ if(state.logoData) return state.logoData; const cached=localStorage.getItem(K.logo); if(cached){ state.logoData=cached; return cached; } try{ const res=await fetch(FIXOS.logo,{cache:'no-store'}); const blob=await res.blob(); const data=await new Promise((ok,err)=>{ const fr=new FileReader(); fr.onload=()=>ok(fr.result); fr.onerror=err; fr.readAsDataURL(blob); }); state.logoData=data; localStorage.setItem(K.logo,data); return data; }catch(e){ return ''; } }
async function pdfBase(title){ if(!window.jspdf) { alert('Biblioteca PDF não carregou. Verifique a internet e tente de novo.'); return null; } const {jsPDF}=window.jspdf; const doc=new jsPDF({unit:'mm',format:'a4'}); const lg=await logo(); let y=12; if(lg){ try{ doc.addImage(lg, lg.startsWith('data:image/jpeg')?'JPEG':'PNG', 91, 8, 28, 28); y=42; }catch(e){} } doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.text(title,14,y); y+=7; doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.text(`${FIXOS.rua} / ${FIXOS.bairro} — CEP ${FIXOS.cep}`,14,y); y+=6; doc.line(14,y,196,y); y+=12; return {doc,y}; }
async function generateReceiptPDF(r){ const b=await pdfBase(`RECIBO Nº ${r.number}`); if(!b) return; const {doc}=b; let y=b.y; doc.setFontSize(12); doc.text(`Recebido de: ${r.residentName||''}`,14,y); y+=8; doc.text(`Endereço: ${endereco(r.apartmentName)}`,14,y); y+=8; doc.text(`CEP: ${FIXOS.cep}`,14,y); y+=10; doc.text(`Referente a: Condomínio`,14,y); y+=8; doc.text(`Mês/Referência: ${(r.months||[]).map(m=>monthYear(m,r.year)).join(', ')}`,14,y); y+=10; doc.setFont('helvetica','bold'); doc.text('Valores recebidos:',14,y); y+=8; doc.setFont('helvetica','normal'); doc.text(`Condomínio: ${money(r.launchedNow||0)}`,14,y); y+=8; doc.setFont('helvetica','bold'); doc.text(`TOTAL: ${money(r.paidNow||0)}`,14,y); y+=10; if((r.previousBalance||0)>0 || (r.remainingBalance||0)>0){ doc.setFont('helvetica','normal'); doc.text(`Saldo anterior: ${money(r.previousBalance||0)}`,14,y); y+=8; doc.text(`Valor pago: ${money(r.paidNow||0)}`,14,y); y+=8; doc.text(`Saldo restante: ${money(Math.max(0,r.remainingBalance||0))}`,14,y); y+=10; } doc.text(`${FIXOS.cidade}, dia ${r.issueDay} de ${MESES[r.issueMonth]} de ${r.issueYear}`,14,y); y+=10; doc.text(`Emitente: ${FIXOS.emitente}`,14,y); doc.save(`Recibo_${r.number}_${r.apartmentName}.pdf`); }
async function generateExpensePDF(e){ const b=await pdfBase('COMPROVANTE DE DESPESA'); if(!b) return; const {doc}=b; let y=b.y; doc.setFontSize(12); doc.text(`Data: ${String(e.day).padStart(2,'0')}/${String(Number(e.month)+1).padStart(2,'0')}/${e.year}`,14,y); y+=8; doc.text(`Categoria: ${e.category}`,14,y); y+=8; doc.text(`Descrição: ${e.description||''}`,14,y); y+=8; doc.setFont('helvetica','bold'); doc.text(`Valor: ${money(e.value)}`,14,y); doc.save(`Despesa_${e.category}_${e.year}.pdf`); }
async function statementPDF(title, receipts, expenses){ const b=await pdfBase(title); if(!b) return; const {doc}=b; let y=b.y; const recebido=receipts.reduce((s,r)=>s+Number(r.paidNow||0),0); const desp=expenses.reduce((s,e)=>s+Number(e.value||0),0); const esperado=Number(state.caixa.saldoInicial||0)+recebido-desp; const real=Number(state.caixa.saldoReal||0); doc.setFontSize(12); doc.text(`Saldo inicial: ${money(state.caixa.saldoInicial)}`,14,y); y+=8; doc.text(`Total recebido: ${money(recebido)}`,14,y); y+=8; doc.text(`Total despesas: ${money(desp)}`,14,y); y+=8; doc.text(`Saldo esperado: ${money(esperado)}`,14,y); y+=8; doc.text(`Saldo real: ${money(real)}`,14,y); y+=8; doc.setFont('helvetica','bold'); doc.text(`Diferença: ${money(real-esperado)} — ${real-esperado>=0?'POSITIVO':'NEGATIVO'}`,14,y); y+=12; doc.setFont('helvetica','bold'); doc.text('Despesas:',14,y); y+=8; doc.setFont('helvetica','normal'); doc.setFontSize(10); if(!expenses.length) doc.text('Nenhuma despesa lançada.',14,y); expenses.forEach(e=>{ const line=`${String(e.day).padStart(2,'0')}/${String(Number(e.month)+1).padStart(2,'0')}/${e.year} — ${e.category} — ${money(e.value)} ${e.description||''}`; const parts=doc.splitTextToSize(line,180); doc.text(parts,14,y); y+=parts.length*5; if(y>275){doc.addPage(); y=20;} }); doc.save(title.replace(/\s+/g,'_')+'.pdf'); }
function saveCaixa(){ state.caixa={saldoInicial:parseMoney(val('saldoInicial')), saldoReal:parseMoney(val('saldoReal'))}; save(K.caixa,state.caixa); renderAll(); }
function renderAll(){ renderAptos(); renderDespesas(); renderHistorico(); }
function showTab(name){ all('.sidebtn').forEach(b=>b.classList.toggle('active',b.dataset.tab===name)); all('.panel').forEach(p=>p.classList.add('hidden')); const p=$('tab-'+name); if(p) p.classList.remove('hidden'); }
function wire(){
  all('.sidebtn').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.tab)));
  ['recApto','recNome','recAnoRef','recPagoAgora','ckCondo'].forEach(id=>{ const e=$(id); if(e){ e.addEventListener('input',updatePreview); e.addEventListener('change',updatePreview); }});
  all('.month-check').forEach(e=>e.addEventListener('change',updatePreview));
  const g=$('btnGerarRecibo'); if(g) g.onclick=saveReceipt; const ld=$('btnLimparRecibo'); if(ld) ld.onclick=()=>{ setValue('editingReceiptId',''); setValue('recNome',''); setValue('recPagoAgora','0,00'); updatePreview(); };
  const ad=$('btnAddDesp'); if(ad) ad.onclick=addExpense; const cl=$('btnLimparDesp'); if(cl) cl.onclick=()=>{ setValue('editingExpenseId',''); setValue('despValor',''); setValue('despDesc',''); };
  const af=$('btnAplicarFiltro'); if(af) af.onclick=renderAll; const sc=$('btnSalvarCaixa'); if(sc) sc.onclick=saveCaixa;
  const recalc=$('btnRecalcular'); if(recalc) recalc.onclick=()=>{ recalculateBalances(); renderAll(); alert('Histórico recalculado.'); };
  const m=$('btnPDFMes'); if(m) m.onclick=()=>{ const f=filter(); if(f.m===null) return alert('Selecione um mês específico.'); statementPDF(`PRESTAÇÃO DE CONTAS ${monthYear(f.m,f.y)}`, filtRec(), filtDesp()); };
  const a=$('btnPDFAno'); if(a) a.onclick=()=>statementPDF(`PRESTAÇÃO DE CONTAS ${filter().y}`, filtRec(), filtDesp());
  const c=$('btnPDFCompleta'); if(c) c.onclick=()=>statementPDF('PRESTAÇÃO DE CONTAS COMPLETA', state.recibos, state.despesas);
  const pm=$('btnPDFPrestacaoMes'); if(pm) pm.onclick=()=>{ const f=filter(); if(f.m===null) return alert('Selecione um mês específico no Histórico.'); statementPDF(`PRESTAÇÃO DE CONTAS ${monthYear(f.m,f.y)}`, filtRec(), filtDesp()); };
  const pa=$('btnPDFPrestacaoAno'); if(pa) pa.onclick=()=>statementPDF(`PRESTAÇÃO DE CONTAS ${filter().y}`, filtRec(), filtDesp());
  const lote=$('btnPDFLote'); if(lote) lote.onclick=()=>{ filtRec().forEach(r=>generateReceiptPDF(r)); };
  const cat=$('despCat'); if(cat) cat.onchange=()=>{ if(cat.value==='Zelador (Tião)') setValue('despValor','250,00'); if(cat.value==='Material limpeza') setValue('despValor','50,00'); };
}

function boot(){ try{ initData(); fillSelects(); updatePreview(); renderAll(); wire(); }catch(err){ console.error(err); alert('Erro ao iniciar o sistema: '+err.message); } }
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
