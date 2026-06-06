(function(){
"use strict";

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const APTOS = ["101","101 Fundos","201","201 Sala","201 Fundos","301","301 Sala","301 Fundos"];
const NOMES_PADRAO = {
  "101": "Jaqueline C Ribeiro",
  "101 Fundos": "Catia Maria",
  "201": "Edmea de Melo",
  "201 Sala": "Danilo Reis E Silva",
  "201 Fundos": "",
  "301": "Marcia Valeria",
  "301 Sala": "Fernanda Telles",
  "301 Fundos": "Vagna Miranda"
};
const OBS_PADRAO = { "101 Fundos": "Isento - Síndica" };
const FIXOS = { taxa:160, emitente:"Gabriel Brito Cirilo", rua:"Rua Glaziou, 30", bairro:"Pilares - RJ", cep:"20750-010", cidade:"Rio de Janeiro", isento:"101 Fundos" };
const STORAGE = {
  apartments:"glz_apartamentos_caixa_v6",
  receipts:"glz_receitas_caixa_v6",
  expenses:"glz_despesas_caixa_v6",
  seq:"glz_seq_caixa_v6",
  balances:"glz_saldos_caixa_v6"
};
const OLD_KEYS = {
  apartments:["glz_apartamentos_caixa_v5","glz_apartamentos_caixa_v4"],
  receipts:["glz_receitas_caixa_v5","glz_receitas_caixa_v4"],
  expenses:["glz_despesas_caixa_v5","glz_despesas_caixa_v4"],
  balances:["glz_saldos_caixa_v5","glz_saldos_caixa_v4"],
  seq:["glz_seq_caixa_v5","glz_seq_caixa_v4"]
};
const state = { apartments:[], receipts:[], expenses:[], balances:{} };

function qs(s){ return document.querySelector(s); }
function qsa(s){ return Array.from(document.querySelectorAll(s)); }
function load(k,f){ try{ const r = localStorage.getItem(k); return r ? JSON.parse(r) : f; }catch(e){ return f; } }
function save(k,v){ localStorage.setItem(k, JSON.stringify(v)); }
function loadWithOld(newKey, oldKeys, fallback){
  const current = localStorage.getItem(newKey);
  if(current !== null) return load(newKey, fallback);
  for(const k of oldKeys || []){
    const v = localStorage.getItem(k);
    if(v !== null){ localStorage.setItem(newKey, v); return load(newKey, fallback); }
  }
  return fallback;
}
function moneyToNumber(v){
  if(v === undefined || v === null) return 0;
  let s = String(v).trim();
  if(!s) return 0;
  s = s.replace(/R\$/g, "").replace(/\s/g, "");
  if(s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  return Number(s.replace(/[^\d.-]/g, "")) || 0;
}
function money(n){ return (Number(n)||0).toLocaleString("pt-BR", {style:"currency", currency:"BRL"}); }
function inputMoney(n){ return (Number(n)||0).toLocaleString("pt-BR", {minimumFractionDigits:2, maximumFractionDigits:2}); }
function uid(){ return "id_" + Date.now() + "_" + Math.random().toString(16).slice(2); }
function pad(n){ return String(n).padStart(6,"0"); }
function today(){ const d = new Date(); return {day:d.getDate(), month:d.getMonth(), year:d.getFullYear()}; }
function dateLabel(day,month,year){ return String(day).padStart(2,"0") + "/" + String(Number(month)+1).padStart(2,"0") + "/" + year; }
function monthYear(month,year){ return MESES[Number(month)] + "/" + year; }
function ymKey(year, month){ return String(year) + "-" + String(Number(month)+1).padStart(2,"0"); }
function periodKey(startY,startM,endY,endM){ return ymKey(startY,startM) + "_" + ymKey(endY,endM); }
function parsePeriod(item){ return Number(item.year) * 12 + Number(item.month); }
function selectedPairs(prefix){
  const out = [];
  [["A", qs("#"+prefix+"AnoA")], ["B", qs("#"+prefix+"AnoB")]].forEach(([suffix, yearEl])=>{
    const year = Number(yearEl && yearEl.value);
    if(!year) return;
    qsa("."+prefix+"-month-"+suffix+":checked").forEach(el=> out.push({year, month:Number(el.value)}));
  });
  const map = new Map();
  out.forEach(p=> map.set(ymKey(p.year,p.month), p));
  return Array.from(map.values()).sort((a,b)=> (a.year*12+a.month) - (b.year*12+b.month));
}
function buildMonthChecks(container, cls){
  container.innerHTML = "";
  MESES.forEach((m,i)=>{
    const label = document.createElement("label");
    label.className = "month-item";
    label.innerHTML = `<input type="checkbox" class="${cls}" value="${i}"> <span>${m}</span>`;
    container.appendChild(label);
  });
}
function setAllMonths(cls, checked){ qsa("."+cls).forEach(el=>{ el.checked = checked; }); refreshPreview(); }
function fillMonths(select, includeTodos){
  select.innerHTML = "";
  if(includeTodos){ const opt=document.createElement("option"); opt.value="-1"; opt.textContent="Todos"; select.appendChild(opt); }
  MESES.forEach((m,i)=>{ const opt=document.createElement("option"); opt.value=String(i); opt.textContent=m; select.appendChild(opt); });
}
function fillDays(select){ select.innerHTML=""; for(let i=1;i<=31;i++){ const opt=document.createElement("option"); opt.value=String(i); opt.textContent=String(i); select.appendChild(opt); } }
function setApartments(arr){ state.apartments = arr; save(STORAGE.apartments, arr); }
function setReceipts(arr){ state.receipts = arr; save(STORAGE.receipts, arr); syncSeq(); }
function setExpenses(arr){ state.expenses = arr; save(STORAGE.expenses, arr); }
function setBalances(obj){ state.balances = obj; save(STORAGE.balances, obj); }
function getSeq(){
  const current = localStorage.getItem(STORAGE.seq);
  if(current !== null) return Number(current)||0;
  for(const k of OLD_KEYS.seq){ const v = localStorage.getItem(k); if(v !== null){ localStorage.setItem(STORAGE.seq, v); return Number(v)||0; } }
  return 0;
}
function setSeq(n){ localStorage.setItem(STORAGE.seq, String(n)); }
function syncSeq(){
  let max = getSeq();
  (state.receipts || []).forEach(r=>{ const n = Number(String(r.number||"").replace(/\D/g,"")) || 0; if(n>max) max=n; });
  setSeq(max);
}
function nextNumber(){ syncSeq(); return pad(getSeq()+1); }
function consumeNumber(){ syncSeq(); const n=getSeq()+1; setSeq(n); return pad(n); }
function aptById(id){ return state.apartments.find(a=>a.id===id); }
function displayName(apto, typed){ return (typed || "").trim() || (apto || ""); }

function initData(){
  let aps = loadWithOld(STORAGE.apartments, OLD_KEYS.apartments, []);
  if(!Array.isArray(aps) || !aps.length) aps = [];
  const byId = new Map(aps.map(a=>[a.id || a.name, a]));
  const finalAps = APTOS.map(ap=>{
    const old = byId.get(ap) || {};
    return { id:ap, name:ap, residentName: old.residentName || old.ownerName || NOMES_PADRAO[ap] || "", exempt: ap===FIXOS.isento, obs: old.obs || old.note || OBS_PADRAO[ap] || "" };
  });
  setApartments(finalAps);
  const recs = loadWithOld(STORAGE.receipts, OLD_KEYS.receipts, []);
  const exps = loadWithOld(STORAGE.expenses, OLD_KEYS.expenses, []);
  setReceipts(Array.isArray(recs)?recs:[]);
  setExpenses(Array.isArray(exps)?exps:[]);
  setBalances(loadWithOld(STORAGE.balances, OLD_KEYS.balances, {}));
}
function initTabs(){
  qsa(".sidebtn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      qsa(".sidebtn").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      qsa(".panel").forEach(p=>p.classList.add("hidden"));
      const panel = qs("#tab-"+btn.dataset.tab);
      if(panel) panel.classList.remove("hidden");
      renderAll();
    });
  });
}
function fillAptSelect(){
  const sel = qs("#recApto"); sel.innerHTML="";
  state.apartments.forEach(a=>{ const opt=document.createElement("option"); opt.value=a.id; opt.textContent=a.name + (a.exempt ? " (isento)" : ""); sel.appendChild(opt); });
}
function updateNameFromApt(){
  const apt = aptById(qs("#recApto").value);
  if(!apt) return;
  qs("#recNome").value = apt.residentName || "";
  qs("#recValor").value = inputMoney(apt.exempt ? 0 : FIXOS.taxa);
  refreshPreview();
}
function saveNameToApartment(apto, name){
  const apt = aptById(apto);
  if(!apt) return;
  if((name || "").trim() && apt.residentName !== name.trim()){
    apt.residentName = name.trim();
    setApartments(state.apartments);
    renderApartments();
  }
}
function refreshPreview(){
  const apt = qs("#recApto") ? qs("#recApto").value : "";
  const name = qs("#recNome") ? qs("#recNome").value.trim() : "";
  const value = qs("#recValor") ? moneyToNumber(qs("#recValor").value) : 0;
  const referente = qs("#recReferente") ? qs("#recReferente").value : "Condomínio";
  const day = qs("#recDia") ? Number(qs("#recDia").value) : today().day;
  const pairs = selectedPairs("rec");
  const total = value * pairs.length;
  const monthsText = pairs.length ? pairs.map(p=>monthYear(p.month,p.year)).join(", ") : "Nenhum mês selecionado";
  const linhas = [];
  linhas.push("Recebido de: " + displayName(apt, name));
  linhas.push("Endereço: " + FIXOS.rua + " — Apto " + apt + " / " + FIXOS.bairro);
  linhas.push("CEP: " + FIXOS.cep);
  linhas.push("");
  linhas.push("Referente a: " + referente);
  linhas.push("Mês/Referência: " + monthsText);
  linhas.push("Valor por mês: " + money(value));
  linhas.push("Quantidade de meses: " + pairs.length);
  linhas.push("");
  linhas.push("TOTAL RECEBIDO: " + money(total));
  linhas.push("");
  linhas.push(FIXOS.cidade + ", dia " + day + " de " + MESES[today().month] + " de " + today().year);
  linhas.push("Emitente: " + FIXOS.emitente);
  const prev = qs("#recPreview"); if(prev) prev.textContent = linhas.join("\n");
}
function saveReceipts(withPdf){
  const apt = qs("#recApto").value;
  const typedName = qs("#recNome").value.trim();
  const value = moneyToNumber(qs("#recValor").value);
  const referente = qs("#recReferente").value;
  const day = Number(qs("#recDia").value);
  const obs = qs("#recObs").value.trim();
  const pairs = selectedPairs("rec");
  if(!pairs.length){ alert("Marque pelo menos um mês pago."); return; }
  if(value < 0){ alert("Valor inválido."); return; }
  saveNameToApartment(apt, typedName);
  const batch = uid();
  const receipts = state.receipts.slice();
  const created = pairs.map(p=>({
    id:uid(), batchId:batch, number:consumeNumber(), day, month:p.month, year:p.year, apartmentName:apt,
    residentName:typedName, displayName:displayName(apt, typedName), referente, value, obs, createdAt:Date.now()
  }));
  receipts.push(...created);
  setReceipts(receipts);
  qs("#recNumero").value = nextNumber();
  renderAll();
  if(withPdf) generateBatchReceiptPDF(created);
  alert("Recebimento salvo no histórico: " + created.length + " mês(es).");
}
function addExpenses(withPdf){
  const category = qs("#despCat").value;
  const value = moneyToNumber(qs("#despValor").value);
  const day = Number(qs("#despDia").value);
  const description = qs("#despDesc").value.trim();
  const pairs = selectedPairs("desp");
  if(!pairs.length){ alert("Marque pelo menos um mês da despesa."); return; }
  if(value <= 0){ alert("Digite um valor válido."); return; }
  const batch = uid();
  const created = pairs.map(p=>({ id:uid(), batchId:batch, day, month:p.month, year:p.year, category, description, value, createdAt:Date.now() }));
  setExpenses(state.expenses.concat(created));
  renderAll();
  if(withPdf) generateExpenseBatchPDF(created);
  alert("Despesa salva no histórico: " + created.length + " mês(es).");
}
function defaultCategoryValue(){
  const cat = qs("#despCat").value;
  if(cat === "Zelador (Tião)") qs("#despValor").value = "250,00";
  if(cat === "Material limpeza") qs("#despValor").value = "50,00";
}
function filters(){ const year=Number(qs("#histAno").value)||null; const m=Number(qs("#histMes").value); return {year, month:m>=0?m:null}; }
function filteredReceipts(year,month){ return state.receipts.filter(r=>(!year || Number(r.year)===year) && (month===null || Number(r.month)===month)); }
function filteredExpenses(year,month){ return state.expenses.filter(e=>(!year || Number(e.year)===year) && (month===null || Number(e.month)===month)); }
function periodBounds(){
  const sy = Number(qs("#prestAnoInicio").value) || today().year;
  const sm = Number(qs("#prestMesInicio").value) || 0;
  const ey = Number(qs("#prestAnoFim").value) || sy;
  const em = Number(qs("#prestMesFim").value) || sm;
  let start = sy*12+sm, end = ey*12+em;
  if(start > end) return {startY:ey,startM:em,endY:sy,endM:sm,start:end,end:start};
  return {startY:sy,startM:sm,endY:ey,endM:em,start,end};
}
function filteredPeriodItems(){
  const p = periodBounds();
  const rec = state.receipts.filter(r=>{ const v=parsePeriod(r); return v>=p.start && v<=p.end; });
  const exp = state.expenses.filter(e=>{ const v=parsePeriod(e); return v>=p.start && v<=p.end; });
  return {period:p, rec, exp};
}
function calcTotals(rec, exp){ return { received:rec.reduce((s,r)=>s+Number(r.value||0),0), spent:exp.reduce((s,e)=>s+Number(e.value||0),0) }; }
function getBalanceForPeriod(){
  const p = periodBounds();
  const key = periodKey(p.startY,p.startM,p.endY,p.endM);
  return state.balances[key] || { initial:0, real:0 };
}
function setBalanceForPeriod(initial, real){
  const p = periodBounds();
  const key = periodKey(p.startY,p.startM,p.endY,p.endM);
  state.balances[key] = { initial, real };
  setBalances(state.balances);
}
function loadBalanceInputs(){
  const b = getBalanceForPeriod();
  qs("#saldoInicial").value = inputMoney(b.initial || 0);
  qs("#saldoReal").value = inputMoney(b.real || 0);
  renderPrestacao();
}
function saveBalanceInputs(){
  setBalanceForPeriod(moneyToNumber(qs("#saldoInicial").value), moneyToNumber(qs("#saldoReal").value));
  renderPrestacao();
  alert("Saldos salvos para este período.");
}
function renderPrestacao(){
  const data = filteredPeriodItems();
  const b = getBalanceForPeriod();
  const t = calcTotals(data.rec, data.exp);
  const expected = Number(b.initial||0) + t.received - t.spent;
  const real = Number(b.real||0);
  const diff = real - expected;
  const cls = diff >= 0 ? "positivo" : "negativo";
  const periodo = monthYear(data.period.startM,data.period.startY) + " até " + monthYear(data.period.endM,data.period.endY);
  qs("#prestResumo").innerHTML = `
    <div class="resumoCard"><div class="label">Período</div><div class="value">${periodo}</div></div>
    <div class="resumoCard"><div class="label">Saldo inicial</div><div class="value">${money(b.initial)}</div></div>
    <div class="resumoCard"><div class="label">Total recebido</div><div class="value positivo">${money(t.received)}</div></div>
    <div class="resumoCard"><div class="label">Total despesas</div><div class="value negativo">${money(t.spent)}</div></div>
    <div class="resumoCard"><div class="label">Quanto deveria existir</div><div class="value">${money(expected)}</div></div>
    <div class="resumoCard"><div class="label">Quanto existe na conta</div><div class="value">${money(real)}</div></div>
    <div class="resumoCard"><div class="label">Diferença</div><div class="value ${cls}">${money(diff)}</div></div>
    <div class="resumoCard"><div class="label">Resultado</div><div class="value ${cls}">${diff>=0 ? "🟢 Sobrou " + money(diff) : "🔴 Falta " + money(Math.abs(diff))}</div></div>`;
}
function renderHistory(){
  const f = filters();
  const rec = filteredReceipts(f.year,f.month), exp = filteredExpenses(f.year,f.month), t = calcTotals(rec,exp);
  qs("#histTotais").innerHTML = `<div><b>Total recebido:</b> ${money(t.received)}</div><div><b>Total despesas:</b> ${money(t.spent)}</div><div><b>Resultado:</b> ${money(t.received-t.spent)}</div>`;
  const rb = qs("#tbodyReceitas"); rb.innerHTML = "";
  rec.slice().sort((a,b)=>b.createdAt-a.createdAt).forEach(r=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${r.number||""}</td><td>${dateLabel(r.day,r.month,r.year)}</td><td>${r.apartmentName||""}</td><td>${r.displayName||r.residentName||r.apartmentName||""}</td><td>${r.referente||""}</td><td>${money(r.value)}</td><td class="actions"><button class="linkbtn" data-pdfrec="${r.id}">PDF</button><button class="linkbtn" data-editrec="${r.id}">Editar</button><button class="linkbtn danger" data-delrec="${r.id}">Excluir</button></td>`;
    rb.appendChild(tr);
  });
  const eb = qs("#tbodyHistDespesas"); eb.innerHTML = "";
  exp.slice().sort((a,b)=>b.createdAt-a.createdAt).forEach(e=> eb.appendChild(expenseRow(e)));
  wireDynamicButtons();
}
function expenseRow(e){
  const tr = document.createElement("tr");
  tr.innerHTML = `<td>${dateLabel(e.day,e.month,e.year)}</td><td>${e.category||""}</td><td>${e.description||""}</td><td>${money(e.value)}</td><td class="actions"><button class="linkbtn" data-editexp="${e.id}">Editar</button><button class="linkbtn danger" data-delexp="${e.id}">Excluir</button></td>`;
  return tr;
}
function renderExpenses(){
  const tbody = qs("#tbodyDespesas"); tbody.innerHTML = "";
  state.expenses.slice().sort((a,b)=>b.createdAt-a.createdAt).forEach(e=> tbody.appendChild(expenseRow(e)));
  const total = state.expenses.reduce((s,e)=>s+Number(e.value||0),0);
  qs("#despResumo").innerHTML = `<b>Total de despesas lançadas:</b> ${money(total)}`;
  wireDynamicButtons();
}
function renderApartments(){
  const tb = qs("#tbodyApartamentos"); tb.innerHTML="";
  state.apartments.forEach(a=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${a.name}</td><td><input value="${escapeHtml(a.residentName||"")}" data-apt-name="${a.id}"></td><td>${a.exempt ? "Sim" : "Não"}</td><td><input value="${escapeHtml(a.obs||"")}" data-apt-obs="${a.id}"></td><td><button class="linkbtn" data-saveapt="${a.id}">Salvar</button></td>`;
    tb.appendChild(tr);
  });
  qsa("[data-saveapt]").forEach(btn=>btn.onclick=()=>{
    const id = btn.dataset.saveapt; const apt = aptById(id); if(!apt) return;
    apt.residentName = qs(`[data-apt-name="${cssEscape(id)}"]`).value.trim();
    apt.obs = qs(`[data-apt-obs="${cssEscape(id)}"]`).value.trim();
    setApartments(state.apartments); fillAptSelect(); updateNameFromApt(); renderApartments(); alert("Apartamento salvo.");
  });
}
function escapeHtml(s){ return String(s).replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c])); }
function cssEscape(s){ return String(s).replace(/(["\\])/g,"\\$1"); }
function editReceipt(id){
  const r = state.receipts.find(x=>x.id===id); if(!r) return;
  const val = prompt("Novo valor recebido:", inputMoney(r.value)); if(val===null) return;
  const n = moneyToNumber(val); if(n < 0){ alert("Valor inválido."); return; }
  r.value = n;
  const nome = prompt("Nome do morador/proprietário (opcional):", r.residentName || "");
  if(nome !== null){ r.residentName = nome.trim(); r.displayName = displayName(r.apartmentName, nome); saveNameToApartment(r.apartmentName, nome); }
  setReceipts(state.receipts); renderAll();
}
function editExpense(id){
  const e = state.expenses.find(x=>x.id===id); if(!e) return;
  const val = prompt("Novo valor da despesa:", inputMoney(e.value)); if(val===null) return;
  const n = moneyToNumber(val); if(n <= 0){ alert("Valor inválido."); return; }
  e.value = n;
  const desc = prompt("Descrição:", e.description || ""); if(desc !== null) e.description = desc.trim();
  setExpenses(state.expenses); renderAll();
}
function wireDynamicButtons(){
  qsa("[data-delrec]").forEach(b=>b.onclick=()=>{ if(confirm("Excluir este recibo/receita?")){ setReceipts(state.receipts.filter(r=>r.id!==b.dataset.delrec)); renderAll(); } });
  qsa("[data-pdfrec]").forEach(b=>b.onclick=()=>{ const r=state.receipts.find(x=>x.id===b.dataset.pdfrec); if(r) generateBatchReceiptPDF([r]); });
  qsa("[data-editrec]").forEach(b=>b.onclick=()=>editReceipt(b.dataset.editrec));
  qsa("[data-delexp]").forEach(b=>b.onclick=()=>{ if(confirm("Excluir esta despesa?")){ setExpenses(state.expenses.filter(e=>e.id!==b.dataset.delexp)); renderAll(); } });
  qsa("[data-editexp]").forEach(b=>b.onclick=()=>editExpense(b.dataset.editexp));
}
function requirePdf(){
  const jsPDF = window.jspdf && window.jspdf.jsPDF;
  if(!jsPDF){ alert("O gerador de PDF não carregou. Verifique a internet e tente de novo."); return null; }
  return jsPDF;
}
function pdfHead(doc, title){
  doc.setFont("helvetica","bold"); doc.setFontSize(14); doc.text(title,14,18);
  doc.setFont("helvetica","normal"); doc.setFontSize(10); doc.text(`${FIXOS.rua} / ${FIXOS.bairro} — CEP ${FIXOS.cep}`,14,25); doc.line(14,29,196,29); return 40;
}
function addLine(doc, text, y, size){
  doc.setFontSize(size || 10);
  const lines = doc.splitTextToSize(String(text), 180); doc.text(lines,14,y); return y + lines.length*5;
}
function ensurePage(doc, y){ if(y>275){ doc.addPage(); return 20; } return y; }
function generateBatchReceiptPDF(items){
  const jsPDF = requirePdf(); if(!jsPDF) return;
  const doc = new jsPDF({unit:"mm", format:"a4"});
  const first = items[0];
  let y = pdfHead(doc, items.length>1 ? `RECIBO EM LOTE — ${first.apartmentName}` : `RECIBO Nº ${first.number}`);
  doc.setFontSize(12);
  y = addLine(doc, `Recebido de: ${first.displayName||first.residentName||first.apartmentName}`, y, 12); y += 3;
  y = addLine(doc, `Endereço: ${FIXOS.rua} — Apto ${first.apartmentName} / ${FIXOS.bairro}`, y, 12); y += 3;
  y = addLine(doc, `CEP: ${FIXOS.cep}`, y, 12); y += 5;
  y = addLine(doc, `Referente a: ${first.referente || "Condomínio"}`, y, 12); y += 3;
  const total = items.reduce((s,r)=>s+Number(r.value||0),0);
  doc.setFont("helvetica","bold"); y = addLine(doc, `TOTAL RECEBIDO: ${money(total)}`, y, 12); doc.setFont("helvetica","normal"); y += 6;
  y = addLine(doc, "Meses pagos:", y, 11);
  items.sort((a,b)=>parsePeriod(a)-parsePeriod(b)).forEach(r=>{ y=ensurePage(doc,y); y=addLine(doc, `${monthYear(r.month,r.year)} — Recibo ${r.number} — ${money(r.value)}`, y, 10); });
  y += 8; y=ensurePage(doc,y);
  if(first.obs) y = addLine(doc, `Observação: ${first.obs}`, y, 10);
  y += 4;
  y = addLine(doc, `${FIXOS.cidade}, dia ${first.day} de ${MESES[today().month]} de ${today().year}`, y, 12); y += 5;
  y = addLine(doc, `Emitente: ${FIXOS.emitente}`, y, 12);
  doc.save(`Recibo_${first.apartmentName}_${Date.now()}.pdf`);
}
function generateExpenseBatchPDF(items){
  const jsPDF = requirePdf(); if(!jsPDF) return;
  const doc = new jsPDF({unit:"mm", format:"a4"});
  const first = items[0]; let y = pdfHead(doc, `COMPROVANTE DE DESPESA — ${first.category}`);
  const total = items.reduce((s,e)=>s+Number(e.value||0),0);
  doc.setFont("helvetica","bold"); y=addLine(doc, `TOTAL DE DESPESAS: ${money(total)}`, y, 12); doc.setFont("helvetica","normal"); y += 6;
  items.sort((a,b)=>parsePeriod(a)-parsePeriod(b)).forEach(e=>{ y=ensurePage(doc,y); y=addLine(doc, `${dateLabel(e.day,e.month,e.year)} — ${e.category} — ${money(e.value)}${e.description?" — "+e.description:""}`, y, 10); });
  doc.save(`Despesa_${first.category}_${Date.now()}.pdf`);
}
function statementPDF(all){
  const jsPDF = requirePdf(); if(!jsPDF) return;
  let rec, exp, title, b={initial:0,real:0}, p=null;
  if(all){ rec = state.receipts.slice(); exp = state.expenses.slice(); title = "PRESTAÇÃO DE CONTAS COMPLETA"; }
  else { const data = filteredPeriodItems(); rec=data.rec; exp=data.exp; p=data.period; b=getBalanceForPeriod(); title = `PRESTAÇÃO DE CONTAS — ${monthYear(p.startM,p.startY)} até ${monthYear(p.endM,p.endY)}`; }
  const t = calcTotals(rec, exp), expected = Number(b.initial||0)+t.received-t.spent, real=Number(b.real||0), diff=real-expected;
  const doc = new jsPDF({unit:"mm", format:"a4"}); let y = pdfHead(doc,title);
  y=addLine(doc, `Saldo inicial: ${money(b.initial)}`, y, 12);
  y=addLine(doc, `Total recebido: ${money(t.received)}`, y, 12);
  y=addLine(doc, `Total despesas: ${money(t.spent)}`, y, 12);
  y=addLine(doc, `Quanto deveria existir: ${money(expected)}`, y, 12);
  y=addLine(doc, `Quanto existe na conta: ${money(real)}`, y, 12);
  y=addLine(doc, `Diferença: ${money(diff)} — ${diff>=0 ? "POSITIVO / SOBROU" : "NEGATIVO / FALTA"}`, y, 12); y+=8;
  doc.setFont("helvetica","bold"); y=addLine(doc,"RECEITAS",y,11); doc.setFont("helvetica","normal");
  rec.sort((a,b)=>parsePeriod(a)-parsePeriod(b)).forEach(r=>{ y=ensurePage(doc,y); y=addLine(doc, `${dateLabel(r.day,r.month,r.year)} — ${r.apartmentName} — ${r.displayName||r.apartmentName} — ${r.referente} — ${money(r.value)}`, y, 9); });
  y+=5; y=ensurePage(doc,y); doc.setFont("helvetica","bold"); y=addLine(doc,"DESPESAS",y,11); doc.setFont("helvetica","normal");
  exp.sort((a,b)=>parsePeriod(a)-parsePeriod(b)).forEach(e=>{ y=ensurePage(doc,y); y=addLine(doc, `${dateLabel(e.day,e.month,e.year)} — ${e.category} — ${money(e.value)}${e.description?" — "+e.description:""}`, y, 9); });
  doc.save(title.replace(/\s+/g,"_").replace(/[\/]/g,"-") + ".pdf");
}
function defaults(){
  const t = today();
  buildMonthChecks(qs("#recMonthsA"), "rec-month-A"); buildMonthChecks(qs("#recMonthsB"), "rec-month-B");
  buildMonthChecks(qs("#despMonthsA"), "desp-month-A"); buildMonthChecks(qs("#despMonthsB"), "desp-month-B");
  fillDays(qs("#recDia")); fillDays(qs("#despDia"));
  fillMonths(qs("#prestMesInicio")); fillMonths(qs("#prestMesFim")); fillMonths(qs("#histMes"), true);
  fillAptSelect();
  qs("#recNumero").value = nextNumber(); qs("#recDia").value = t.day; qs("#recAnoA").value = t.year; qs("#recAnoB").value = t.year+1; qs("#recValor").value = inputMoney(FIXOS.taxa);
  qs("#despDia").value = t.day; qs("#despAnoA").value = t.year; qs("#despAnoB").value = t.year+1; qs("#despValor").value = "250,00";
  qs("#prestAnoInicio").value = t.year; qs("#prestMesInicio").value = t.month; qs("#prestAnoFim").value = t.year; qs("#prestMesFim").value = t.month;
  qs("#histAno").value = t.year; qs("#histMes").value = "-1";
  updateNameFromApt(); loadBalanceInputs();
}
function wire(){
  initTabs();
  ["#recApto","#recNome","#recValor","#recReferente","#recDia","#recAnoA","#recAnoB","#recObs"].forEach(s=>{ const e=qs(s); if(e){ e.addEventListener("input",refreshPreview); e.addEventListener("change",refreshPreview); } });
  qsa(".rec-month-A,.rec-month-B").forEach(e=>e.addEventListener("change",refreshPreview));
  qs("#recApto").addEventListener("change", updateNameFromApt);
  qs("#btnRecTodosA").onclick=()=>setAllMonths("rec-month-A", true); qs("#btnRecLimparA").onclick=()=>setAllMonths("rec-month-A", false);
  qs("#btnRecTodosB").onclick=()=>setAllMonths("rec-month-B", true); qs("#btnRecLimparB").onclick=()=>setAllMonths("rec-month-B", false);
  qs("#btnSalvarRecibo").onclick=()=>saveReceipts(true); qs("#btnSalvarSemPdf").onclick=()=>saveReceipts(false);
  qs("#btnDespTodosA").onclick=()=>setAllMonths("desp-month-A", true); qs("#btnDespLimparA").onclick=()=>setAllMonths("desp-month-A", false);
  qs("#btnDespTodosB").onclick=()=>setAllMonths("desp-month-B", true); qs("#btnDespLimparB").onclick=()=>setAllMonths("desp-month-B", false);
  qs("#despCat").addEventListener("change", defaultCategoryValue); qs("#btnAddDesp").onclick=()=>addExpenses(false); qs("#btnAddDespPdf").onclick=()=>addExpenses(true);
  ["#prestAnoInicio","#prestMesInicio","#prestAnoFim","#prestMesFim"].forEach(s=>{ const e=qs(s); e.addEventListener("input",loadBalanceInputs); e.addEventListener("change",loadBalanceInputs); });
  qs("#btnSalvarSaldos").onclick=saveBalanceInputs; qs("#btnPdfPeriodo").onclick=()=>statementPDF(false); qs("#btnPdfCompleta").onclick=()=>statementPDF(true);
  qs("#btnFiltrarHist").onclick=renderHistory;
}
function renderAll(){ renderApartments(); renderExpenses(); renderHistory(); renderPrestacao(); refreshPreview(); }
window.addEventListener("error", function(e){ console.error(e.error || e.message); });
initData(); defaults(); wire(); renderAll();
})();
