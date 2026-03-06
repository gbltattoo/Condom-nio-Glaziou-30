import {
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  runTransaction,
  serverTimestamp
} from "./firebase.js";

const MESES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
];

const APTOS = [
  "101",
  "101 Fundos",
  "201",
  "201 Sala",
  "201 Fundos",
  "301",
  "301 Sala",
  "301 Fundos"
];

const FIXOS = {
  taxaCondominio: 160,
  emitente: "Gabriel Brito Cirilo",
  cidade: "Rio de Janeiro",
  rua: "Rua Glaziou, 30",
  bairroUf: "Pilares - RJ",
  cep: "20750-010",
  logoPath: "logo.png"
};

const COL = {
  apartments: "apartments",
  receipts: "receipts",
  expenses: "expenses",
  config: "config"
};

const state = {
  apartments: [],
  receipts: [],
  expenses: [],
  configSeq: 0,
  logoDataUrl: ""
};

function qs(sel){ return document.querySelector(sel); }
function qsa(sel){ return [...document.querySelectorAll(sel)]; }

function moneyToNumber(str){
  if (!str) return 0;
  return Number(String(str).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "")) || 0;
}
function numberToMoney(n){
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function numberToInput(n){
  return (Number(n) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function pad(num, size=6){
  const s = String(num);
  return s.length >= size ? s : "0".repeat(size - s.length) + s;
}
function today(){
  const d = new Date();
  return { dia:d.getDate(), mes:d.getMonth(), ano:d.getFullYear() };
}
function enderecoCompleto(apto){
  return `${FIXOS.rua} - Apto ${apto} / ${FIXOS.bairroUf}`;
}
function statusFromBalance(balance){
  if (balance <= 0) return "Quitado";
  return balance < FIXOS.taxaCondominio ? "Parcial" : "Em aberto";
}
function badgeClass(status){
  if (status === "Quitado") return "ok";
  if (status === "Parcial") return "warn";
  return "danger";
}
function ymValue(year, month){ return year * 12 + month; }

function fillMonths(select, includeTodos=false){
  select.innerHTML = "";
  if (includeTodos) {
    const opt = document.createElement("option");
    opt.value = "-1";
    opt.textContent = "Todos";
    select.appendChild(opt);
  }
  MESES.forEach((m, i) => {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = m;
    select.appendChild(opt);
  });
}
function fillDays(select){
  select.innerHTML = "";
  for (let i=1;i<=31;i++){
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = String(i);
    select.appendChild(opt);
  }
}
function fillApartments(select){
  select.innerHTML = "";
  state.apartments
    .slice()
    .sort((a,b)=> a.name.localeCompare(b.name))
    .forEach(ap=>{
      const opt = document.createElement("option");
      opt.value = ap.id;
      opt.textContent = ap.name;
      select.appendChild(opt);
    });
}

function aptById(id){
  return state.apartments.find(a => a.id === id);
}

function monthYearLabel(m, y){
  return `${MESES[m]}/${y}`;
}

function initTabs(){
  qsa(".sidebtn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      qsa(".sidebtn").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      qsa(".panel").forEach(p=>p.classList.add("hidden"));
      qs(`#tab-${btn.dataset.tab}`).classList.remove("hidden");
    });
  });
}

async function ensureInitialData(){
  const configRef = doc(db, COL.config, "app");
  const cfgSnap = await getDoc(configRef);
  if (!cfgSnap.exists()) {
    await setDoc(configRef, { receiptSeq: 0 });
  }

  const aptSnap = await getDocs(collection(db, COL.apartments));
  if (aptSnap.empty) {
    for (const name of APTOS) {
      const id = name;
      await setDoc(doc(db, COL.apartments, id), {
        name,
        exemptCondo: name === "101 Fundos",
        balance: 0,
        residentName: "",
        createdAt: serverTimestamp()
      });
    }
  }
}

function bindRealtime(){
  onSnapshot(doc(db, COL.config, "app"), snap=>{
    const data = snap.data() || {};
    state.configSeq = Number(data.receiptSeq || 0);
    qs("#recNumero").value = pad(state.configSeq + 1);
    qs("#retroNumero").value = pad(state.configSeq + 1);
  });

  onSnapshot(query(collection(db, COL.apartments)), snap=>{
    state.apartments = snap.docs.map(d=> ({ id:d.id, ...d.data() }));
    fillApartments(qs("#recApto"));
    fillApartments(qs("#retroApto"));
    renderApartments();
    handleApartmentChange();
    refreshRetroPreview();
  });

  onSnapshot(query(collection(db, COL.receipts), orderBy("createdAt", "desc")), snap=>{
    state.receipts = snap.docs.map(d=> ({ id:d.id, ...d.data() }));
    renderHistory();
  });

  onSnapshot(query(collection(db, COL.expenses), orderBy("createdAt", "desc")), snap=>{
    state.expenses = snap.docs.map(d=> ({ id:d.id, ...d.data() }));
    renderExpenses();
    renderHistory();
  });
}

async function getNextReceiptNumber(){
  const configRef = doc(db, COL.config, "app");
  const next = await runTransaction(db, async (transaction)=>{
    const cfg = await transaction.get(configRef);
    const current = Number(cfg.data()?.receiptSeq || 0);
    const upcoming = current + 1;
    transaction.set(configRef, { receiptSeq: upcoming }, { merge:true });
    return upcoming;
  });
  return pad(next);
}

function loadDefaults(){
  const t = today();

  fillMonths(qs("#recMesRef"));
  fillMonths(qs("#recMesEmissao"));
  fillMonths(qs("#retroMesInicio"));
  fillMonths(qs("#retroMesFim"));
  fillMonths(qs("#despMes"));
  fillMonths(qs("#histMes"), true);

  fillDays(qs("#recDia"));
  fillDays(qs("#despDia"));

  qs("#recMesRef").value = String(t.mes);
  qs("#recAnoRef").value = t.ano;
  qs("#recMesEmissao").value = String(t.mes);
  qs("#recAnoEmissao").value = t.ano;
  qs("#recDia").value = String(t.dia);

  qs("#retroMesInicio").value = String(t.mes);
  qs("#retroAnoInicio").value = t.ano;
  qs("#retroMesFim").value = String(t.mes);
  qs("#retroAnoFim").value = t.ano;

  qs("#despMes").value = String(t.mes);
  qs("#despAno").value = t.ano;
  qs("#despDia").value = String(t.dia);

  qs("#histAno").value = t.ano;
  qs("#histMes").value = "-1";

  qs("#recAjusteSaldo").value = "0,00";
  qs("#recAgua").value = "0,00";
  qs("#recExtra").value = "0,00";
  qs("#recDescontoObra").value = "0,00";
  qs("#recPagoAgora").value = "0,00";
  qs("#retroAguaTotal").value = "0,00";
}

function computeReceiptPreviewData(){
  const apt = aptById(qs("#recApto").value);
  if (!apt) return null;

  const ajuste = moneyToNumber(qs("#recAjusteSaldo").value);
  const saldoAnterior = (Number(apt.balance) || 0) + ajuste;

  const condo = apt.exemptCondo ? 0 : moneyToNumber(qs("#recCondominio").value);
  const agua = moneyToNumber(qs("#recAgua").value);
  const extra = moneyToNumber(qs("#recExtra").value);
  const descontoObra = moneyToNumber(qs("#recDescontoObra").value);
  const pagoAgora = moneyToNumber(qs("#recPagoAgora").value);

  const totalReferencia = condo + agua + extra;
  const saldoRestante = saldoAnterior + totalReferencia - descontoObra - pagoAgora;
  const situacao = statusFromBalance(saldoRestante);

  return {
    apt,
    numero: qs("#recNumero").value,
    nome: qs("#recNome").value.trim(),
    refMes: Number(qs("#recMesRef").value),
    refAno: Number(qs("#recAnoRef").value),
    emDia: Number(qs("#recDia").value),
    emMes: Number(qs("#recMesEmissao").value),
    emAno: Number(qs("#recAnoEmissao").value),
    saldoAnterior,
    ajuste,
    condo,
    agua,
    extra,
    descontoObra,
    pagoAgora,
    totalReferencia,
    saldoRestante,
    situacao
  };
}

function refreshReceiptPreview(){
  const data = computeReceiptPreviewData();
  if (!data) return;

  qs("#enderecoLinha").textContent = enderecoCompleto(data.apt.name);
  qs("#recSaldoAnterior").value = numberToMoney(data.saldoAnterior);
  qs("#recTotalReferencia").value = numberToMoney(data.totalReferencia);
  qs("#recSaldoRestante").value = numberToMoney(data.saldoRestante);
  qs("#recSituacao").value = data.situacao;

  qs("#recPreview").textContent =
`RECIBO Nº ${data.numero}

Recebido de: ${data.nome || "__________________________"}
Endereço: ${enderecoCompleto(data.apt.name)}
CEP: ${FIXOS.cep}

Referente a: ${monthYearLabel(data.refMes, data.refAno)}

Saldo anterior: ${numberToMoney(data.saldoAnterior)}
Condomínio do mês: ${numberToMoney(data.condo)}
Água do mês: ${numberToMoney(data.agua)}
Cobrança extra: ${numberToMoney(data.extra)}
Desconto por obra: ${numberToMoney(data.descontoObra)}
Valor pago nesta data: ${numberToMoney(data.pagoAgora)}

Saldo restante da unidade: ${numberToMoney(data.saldoRestante)}
Situação: ${data.situacao}

${FIXOS.cidade}, dia ${data.emDia} de ${MESES[data.emMes]} de ${data.emAno}

Emitente: ${FIXOS.emitente}`;
}

function handleApartmentChange(){
  const apt = aptById(qs("#recApto").value);
  if (!apt) return;
  qs("#recCondominio").value = numberToInput(apt.exemptCondo ? 0 : FIXOS.taxaCondominio);
  qs("#recCondominio").disabled = apt.exemptCondo;
  refreshReceiptPreview();
}

function buildRetroMonths(){
  const startMonth = Number(qs("#retroMesInicio").value);
  const startYear = Number(qs("#retroAnoInicio").value);
  const endMonth = Number(qs("#retroMesFim").value);
  const endYear = Number(qs("#retroAnoFim").value);

  const start = ymValue(startYear, startMonth);
  const end = ymValue(endYear, endMonth);
  if (end < start) return [];

  const result = [];
  let y = startYear;
  let m = startMonth;

  while (ymValue(y, m) <= end) {
    result.push({ month: m, year: y });
    m++;
    if (m > 11) { m = 0; y++; }
  }
  return result;
}

function computeRetroData(){
  const apt = aptById(qs("#retroApto").value);
  if (!apt) return null;

  const months = buildRetroMonths();
  const incluiCondo = qs("#retroIncluiCondo").checked;
  const incluiAgua = qs("#retroIncluiAgua").checked;

  const condoPerMonth = apt.exemptCondo ? 0 : FIXOS.taxaCondominio;
  const condoTotal = incluiCondo ? condoPerMonth * months.length : 0;
  const aguaTotal = incluiAgua ? moneyToNumber(qs("#retroAguaTotal").value) : 0;
  const total = condoTotal + aguaTotal;

  return {
    numero: qs("#retroNumero").value,
    apt,
    nome: qs("#retroNome").value.trim(),
    months,
    incluiCondo,
    incluiAgua,
    condoPerMonth,
    condoTotal,
    aguaTotal,
    total
  };
}

function refreshRetroPreview(){
  const data = computeRetroData();
  if (!data) return;

  qs("#retroTotal").value = numberToMoney(data.total);

  const lista = data.months.map(m => `• ${monthYearLabel(m.month, m.year)}`).join("\n") || "• Nenhum mês";

  qs("#retroPreview").textContent =
`RECIBO RETROATIVO Nº ${data.numero}

Recebido de: ${data.nome || "__________________________"}
Endereço: ${enderecoCompleto(data.apt.name)}
CEP: ${FIXOS.cep}

Meses incluídos:
${lista}

Condomínio por mês: ${numberToMoney(data.condoPerMonth)}
Total condomínio retroativo: ${numberToMoney(data.condoTotal)}
Água total retroativa: ${numberToMoney(data.aguaTotal)}

TOTAL: ${numberToMoney(data.total)}

Observação: este recibo é retroativo / segunda via e não entra no caixa do mês.
Emitente: ${FIXOS.emitente}`;
}

async function saveNormalReceipt(){
  const data = computeReceiptPreviewData();
  if (!data) return;
  if (!data.nome) {
    alert("Digite o nome do morador/proprietário.");
    return;
  }

  const receiptNumber = await getNextReceiptNumber();

  await addDoc(collection(db, COL.receipts), {
    type: "normal",
    number: receiptNumber,
    apartmentId: data.apt.id,
    apartmentName: data.apt.name,
    residentName: data.nome,
    refMonth: data.refMes,
    refYear: data.refAno,
    issueDay: data.emDia,
    issueMonth: data.emMes,
    issueYear: data.emAno,
    previousBalance: data.saldoAnterior,
    manualBalanceAdjustment: data.ajuste,
    condoAmount: data.condo,
    waterAmount: data.agua,
    extraAmount: data.extra,
    workDiscount: data.descontoObra,
    paidNow: data.pagoAgora,
    totalReference: data.totalReferencia,
    remainingBalance: data.saldoRestante,
    status: data.situacao,
    affectsCash: true,
    isRetroactive: false,
    createdAt: serverTimestamp()
  });

  await updateDoc(doc(db, COL.apartments, data.apt.id), {
    balance: data.saldoRestante,
    residentName: data.nome
  });

  await generateNormalReceiptPDF({
    number: receiptNumber,
    apartmentName: data.apt.name,
    residentName: data.nome,
    refMonth: data.refMes,
    refYear: data.refAno,
    issueDay: data.emDia,
    issueMonth: data.emMes,
    issueYear: data.emAno,
    previousBalance: data.saldoAnterior,
    condoAmount: data.condo,
    waterAmount: data.agua,
    extraAmount: data.extra,
    workDiscount: data.descontoObra,
    paidNow: data.pagoAgora,
    remainingBalance: data.saldoRestante,
    status: data.situacao
  });
}

async function saveRetroReceipt(){
  const data = computeRetroData();
  if (!data) return;
  if (!data.nome) {
    alert("Digite o nome do morador/proprietário.");
    return;
  }
  if (!data.months.length) {
    alert("Selecione um intervalo válido de meses.");
    return;
  }

  const receiptNumber = await getNextReceiptNumber();

  await addDoc(collection(db, COL.receipts), {
    type: "retroativo",
    number: receiptNumber,
    apartmentId: data.apt.id,
    apartmentName: data.apt.name,
    residentName: data.nome,
    months: data.months,
    condoPerMonth: data.condoPerMonth,
    condoTotal: data.condoTotal,
    waterTotal: data.aguaTotal,
    total: data.total,
    affectsCash: false,
    isRetroactive: true,
    createdAt: serverTimestamp()
  });

  await updateDoc(doc(db, COL.apartments, data.apt.id), {
    residentName: data.nome
  });

  await generateRetroReceiptPDF({
    number: receiptNumber,
    apartmentName: data.apt.name,
    residentName: data.nome,
    months: data.months,
    condoPerMonth: data.condoPerMonth,
    condoTotal: data.condoTotal,
    waterTotal: data.aguaTotal,
    total: data.total
  });
}

function renderApartments(){
  const tbody = qs("#tbodyApartamentos");
  tbody.innerHTML = "";

  state.apartments
    .slice()
    .sort((a,b)=> a.name.localeCompare(b.name))
    .forEach(ap=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${ap.name}</td>
        <td><input type="checkbox" data-isento="${ap.id}" ${ap.exemptCondo ? "checked" : ""}></td>
        <td>${ap.residentName || ""}</td>
        <td>${numberToMoney(Number(ap.balance || 0))}</td>
        <td class="actions">
          <button class="linkbtn" data-zerar="${ap.id}">Zerar saldo</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

  tbody.querySelectorAll("[data-isento]").forEach(el=>{
    el.addEventListener("change", async ()=>{
      const id = el.dataset.isento;
      await updateDoc(doc(db, COL.apartments, id), { exemptCondo: el.checked });
    });
  });

  tbody.querySelectorAll("[data-zerar]").forEach(el=>{
    el.addEventListener("click", async ()=>{
      const id = el.dataset.zerar;
      const ok = confirm("Zerar o saldo desta unidade?");
      if (!ok) return;
      await updateDoc(doc(db, COL.apartments, id), { balance: 0 });
    });
  });
}

async function addExpense(){
  const value = moneyToNumber(qs("#despValor").value);
  const desc = qs("#despDesc").value.trim();
  if (!value) {
    alert("Digite um valor válido.");
    return;
  }

  await addDoc(collection(db, COL.expenses), {
    day: Number(qs("#despDia").value),
    month: Number(qs("#despMes").value),
    year: Number(qs("#despAno").value),
    category: qs("#despCat").value,
    description: desc,
    value,
    createdAt: serverTimestamp()
  });

  qs("#despValor").value = "";
  qs("#despDesc").value = "";
}

function renderExpenses(){
  const tbody = qs("#tbodyDespesas");
  tbody.innerHTML = "";

  state.expenses
    .slice()
    .sort((a,b)=>{
      const av = ymValue(a.year, a.month) * 40 + a.day;
      const bv = ymValue(b.year, b.month) * 40 + b.day;
      return bv - av;
    })
    .forEach(exp=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${String(exp.day).padStart(2,"0")}/${String(exp.month+1).padStart(2,"0")}/${exp.year}</td>
        <td>${exp.category}</td>
        <td>${exp.description || ""}</td>
        <td>${numberToMoney(exp.value || 0)}</td>
        <td class="actions">
          <button class="linkbtn" data-expdel="${exp.id}">Excluir</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

  tbody.querySelectorAll("[data-expdel]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const ok = confirm("Excluir esta despesa?");
      if (!ok) return;
      await deleteDoc(doc(db, COL.expenses, btn.dataset.expdel));
    });
  });
}

function getHistoryFilter(){
  const year = Number(qs("#histAno").value) || null;
  const monthRaw = Number(qs("#histMes").value);
  const month = monthRaw >= 0 ? monthRaw : null;
  return { year, month };
}

function getMonthlySummary(year, month){
  const receipts = state.receipts.filter(r => {
    if (r.type !== "normal") return false;
    if (year && r.refYear !== year) return false;
    if (month !== null && r.refMonth !== month) return false;
    return true;
  });

  const expenses = state.expenses.filter(e => {
    if (year && e.year !== year) return false;
    if (month !== null && e.month !== month) return false;
    return true;
  });

  const entrouCaixa = receipts.reduce((a,r)=> a + Number(r.paidNow || 0), 0);
  const descontoObra = receipts.reduce((a,r)=> a + Number(r.workDiscount || 0), 0);
  const entrouAgua = receipts.reduce((a,r)=> a + Number(r.waterAmount || 0), 0);
  const entrouCondo = receipts.reduce((a,r)=> a + Number(r.condoAmount || 0), 0);
  const extra = receipts.reduce((a,r)=> a + Number(r.extraAmount || 0), 0);
  const saiu = expenses.reduce((a,e)=> a + Number(e.value || 0), 0);
  const saldoMes = entrouCaixa - saiu;

  let caixaAcumulado = 0;
  if (year && month !== null) {
    const receiptsAte = state.receipts.filter(r => r.type === "normal" && ymValue(r.refYear, r.refMonth) <= ymValue(year, month));
    const expensesAte = state.expenses.filter(e => ymValue(e.year, e.month) <= ymValue(year, month));
    caixaAcumulado =
      receiptsAte.reduce((a,r)=> a + Number(r.paidNow || 0), 0) -
      expensesAte.reduce((a,e)=> a + Number(e.value || 0), 0);
  }

  return { receipts, expenses, entrouCaixa, descontoObra, entrouAgua, entrouCondo, extra, saiu, saldoMes, caixaAcumulado };
}

function renderHistory(){
  const { year, month } = getHistoryFilter();

  const list = state.receipts.filter(r => {
    if (r.type === "normal") {
      if (year && r.refYear !== year) return false;
      if (month !== null && r.refMonth !== month) return false;
      return true;
    }
    if (r.type === "retroativo") {
      if (!year) return true;
      return (r.months || []).some(m => m.year === year && (month === null || m.month === month));
    }
    return true;
  });

  const summary = getMonthlySummary(year, month);

  qs("#histTotais").innerHTML = `
    <div><b>Entrou no caixa:</b> ${numberToMoney(summary.entrouCaixa)}</div>
    <div><b>Condomínio lançado:</b> ${numberToMoney(summary.entrouCondo)}</div>
    <div><b>Água lançada:</b> ${numberToMoney(summary.entrouAgua)}</div>
    <div><b>Cobranças extras:</b> ${numberToMoney(summary.extra)}</div>
    <div><b>Descontos por obra:</b> ${numberToMoney(summary.descontoObra)}</div>
    <div><b>Saiu do caixa:</b> ${numberToMoney(summary.saiu)}</div>
    <div><b>Saldo do período:</b> ${numberToMoney(summary.saldoMes)}</div>
    ${month !== null ? `<div><b>Caixa acumulado até este mês:</b> ${numberToMoney(summary.caixaAcumulado)}</div>` : `<div class="muted">Selecione um mês específico para ver o caixa acumulado.</div>`}
  `;

  const tbody = qs("#tbodyHistorico");
  tbody.innerHTML = "";

  list
    .slice()
    .sort((a,b)=>{
      const ax = a.createdAt?.seconds || 0;
      const bx = b.createdAt?.seconds || 0;
      return bx - ax;
    })
    .forEach(item=>{
      const ref = item.type === "normal"
        ? monthYearLabel(item.refMonth, item.refYear)
        : (item.months || []).map(m => monthYearLabel(m.month, m.year)).join(", ");

      const entrou = item.type === "normal" ? numberToMoney(item.paidNow || 0) : "Não";
      const saldo = item.type === "normal" ? numberToMoney(item.remainingBalance || 0) : "—";
      const issue = item.type === "normal"
        ? `${String(item.issueDay).padStart(2,"0")}/${String(item.issueMonth+1).padStart(2,"0")}/${item.issueYear}`
        : "Retroativo";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${item.number || ""}</td>
        <td>${item.type === "normal" ? "Normal" : "Retroativo"}</td>
        <td>${ref}</td>
        <td>${item.apartmentName || ""}</td>
        <td>${item.residentName || ""}</td>
        <td>${entrou}</td>
        <td>${saldo}</td>
        <td>${issue}</td>
        <td class="actions">
          <button class="linkbtn" data-download="${item.id}">Baixar PDF</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

  tbody.querySelectorAll("[data-download]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const item = state.receipts.find(r => r.id === btn.dataset.download);
      if (!item) return;

      if (item.type === "normal") {
        await generateNormalReceiptPDF(item);
      } else {
        await generateRetroReceiptPDF(item);
      }
    });
  });
}

async function loadLogoDataUrl(){
  if (state.logoDataUrl) return state.logoDataUrl;
  try {
    const res = await fetch(FIXOS.logoPath, { cache: "no-store" });
    const blob = await res.blob();
    const dataUrl = await new Promise((resolve, reject)=>{
      const reader = new FileReader();
      reader.onload = ()=> resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    state.logoDataUrl = dataUrl;
    return dataUrl;
  } catch {
    return "";
  }
}

function addLogoToPdf(doc, dataUrl){
  if (!dataUrl) return 18;
  const pageWidth = doc.internal.pageSize.getWidth();
  const w = 28;
  const h = 28;
  const x = (pageWidth - w) / 2;
  const y = 10;
  const fmt = dataUrl.startsWith("data:image/jpeg") ? "JPEG" : "PNG";
  try {
    doc.addImage(dataUrl, fmt, x, y, w, h);
    return y + h + 6;
  } catch {
    return 18;
  }
}

function pdfHeader(doc, title, startY){
  doc.setFont("helvetica","bold");
  doc.setFontSize(14);
  doc.text(title, 14, startY);

  doc.setFont("helvetica","normal");
  doc.setFontSize(10);
  doc.text(`${FIXOS.rua} / ${FIXOS.bairroUf} — CEP ${FIXOS.cep} — ${FIXOS.cidade}/RJ`, 14, startY + 6);
  doc.line(14, startY + 9, 196, startY + 9);

  return startY + 22;
}

async function generateNormalReceiptPDF(item){
  const { jsPDF } = window.jspdf;
  const docPdf = new jsPDF({ unit:"mm", format:"a4" });
  const logo = await loadLogoDataUrl();
  const startY = addLogoToPdf(docPdf, logo);
  let y = pdfHeader(docPdf, `RECIBO Nº ${item.number}`, startY);
  const lh = 8;

  docPdf.setFont("helvetica","normal");
  docPdf.setFontSize(12);

  docPdf.text(`Recebido de: ${item.residentName || ""}`, 14, y); y += lh;
  docPdf.text(`Endereço: ${enderecoCompleto(item.apartmentName)}`, 14, y); y += lh;
  docPdf.text(`CEP: ${FIXOS.cep}`, 14, y); y += lh;

  docPdf.text(`Referente a: ${monthYearLabel(item.refMonth, item.refYear)}`, 14, y); y += lh;
  docPdf.text(`Saldo anterior: ${numberToMoney(item.previousBalance || 0)}`, 14, y); y += lh;
  docPdf.text(`Condomínio do mês: ${numberToMoney(item.condoAmount || 0)}`, 14, y); y += lh;
  docPdf.text(`Água do mês: ${numberToMoney(item.waterAmount || 0)}`, 14, y); y += lh;
  docPdf.text(`Cobrança extra: ${numberToMoney(item.extraAmount || 0)}`, 14, y); y += lh;
  docPdf.text(`Desconto por obra: ${numberToMoney(item.workDiscount || 0)}`, 14, y); y += lh;
  docPdf.text(`Valor pago nesta data: ${numberToMoney(item.paidNow || 0)}`, 14, y); y += lh;

  docPdf.setFont("helvetica","bold");
  docPdf.text(`Saldo restante da unidade: ${numberToMoney(item.remainingBalance || 0)}`, 14, y); y += lh;
  docPdf.text(`Situação: ${item.status || ""}`, 14, y); y += lh + 2;

  docPdf.setFont("helvetica","normal");
  docPdf.text(
    `${FIXOS.cidade}, dia ${item.issueDay} de ${MESES[item.issueMonth]} de ${item.issueYear}`,
    14, y
  );
  y += lh + 6;

  docPdf.text(`Emitente: ${FIXOS.emitente}`, 14, y);

  docPdf.save(`Recibo_${item.number}_${item.apartmentName}.pdf`);
}

async function generateRetroReceiptPDF(item){
  const { jsPDF } = window.jspdf;
  const docPdf = new jsPDF({ unit:"mm", format:"a4" });
  const logo = await loadLogoDataUrl();
  const startY = addLogoToPdf(docPdf, logo);
  let y = pdfHeader(docPdf, `RECIBO RETROATIVO Nº ${item.number}`, startY);

  docPdf.setFont("helvetica","normal");
  docPdf.setFontSize(12);

  docPdf.text(`Recebido de: ${item.residentName || ""}`, 14, y); y += 8;
  docPdf.text(`Endereço: ${enderecoCompleto(item.apartmentName)}`, 14, y); y += 8;
  docPdf.text(`CEP: ${FIXOS.cep}`, 14, y); y += 10;

  docPdf.setFont("helvetica","bold");
  docPdf.text("Meses incluídos:", 14, y); y += 8;
  docPdf.setFont("helvetica","normal");

  (item.months || []).forEach(m=>{
    docPdf.text(`• ${monthYearLabel(m.month, m.year)}`, 18, y);
    y += 7;
  });

  y += 3;
  docPdf.text(`Condomínio por mês: ${numberToMoney(item.condoPerMonth || 0)}`, 14, y); y += 8;
  docPdf.text(`Total condomínio retroativo: ${numberToMoney(item.condoTotal || 0)}`, 14, y); y += 8;
  docPdf.text(`Água total retroativa: ${numberToMoney(item.waterTotal || 0)}`, 14, y); y += 8;

  docPdf.setFont("helvetica","bold");
  docPdf.text(`TOTAL: ${numberToMoney(item.total || 0)}`, 14, y); y += 10;

  docPdf.setFont("helvetica","normal");
  docPdf.text(`Observação: este recibo é retroativo / segunda via e não entra no caixa do mês.`, 14, y); y += 10;
  docPdf.text(`Emitente: ${FIXOS.emitente}`, 14, y);

  docPdf.save(`Recibo_Retroativo_${item.number}_${item.apartmentName}.pdf`);
}

async function generateMonthlyStatementPDF(){
  const year = Number(qs("#histAno").value);
  const month = Number(qs("#histMes").value);
  if (!(month >= 0 && month <= 11)) {
    alert("Selecione um mês específico.");
    return;
  }

  const summary = getMonthlySummary(year, month);

  const { jsPDF } = window.jspdf;
  const docPdf = new jsPDF({ unit:"mm", format:"a4" });
  const logo = await loadLogoDataUrl();
  const startY = addLogoToPdf(docPdf, logo);
  let y = pdfHeader(docPdf, `PRESTAÇÃO DE CONTAS — ${monthYearLabel(month, year)}`, startY);

  docPdf.setFont("helvetica","normal");
  docPdf.setFontSize(12);

  docPdf.text(`Entrou no caixa: ${numberToMoney(summary.entrouCaixa)}`, 14, y); y += 8;
  docPdf.text(`Condomínio lançado: ${numberToMoney(summary.entrouCondo)}`, 14, y); y += 8;
  docPdf.text(`Água lançada: ${numberToMoney(summary.entrouAgua)}`, 14, y); y += 8;
  docPdf.text(`Cobranças extras: ${numberToMoney(summary.extra)}`, 14, y); y += 8;
  docPdf.text(`Descontos por obra: ${numberToMoney(summary.descontoObra)}`, 14, y); y += 8;
  docPdf.text(`Saiu do caixa: ${numberToMoney(summary.saiu)}`, 14, y); y += 8;

  docPdf.setFont("helvetica","bold");
  docPdf.text(`Saldo do mês: ${numberToMoney(summary.saldoMes)}`, 14, y); y += 8;
  docPdf.text(`Caixa acumulado até este mês: ${numberToMoney(summary.caixaAcumulado)}`, 14, y); y += 10;

  docPdf.setFont("helvetica","bold");
  docPdf.text("Despesas do mês:", 14, y); y += 8;
  docPdf.setFont("helvetica","normal");
  docPdf.setFontSize(10);

  if (!summary.expenses.length) {
    docPdf.text("Nenhuma despesa lançada neste mês.", 14, y);
  } else {
    const ordered = summary.expenses.slice().sort((a,b)=> a.day - b.day);
    for (const exp of ordered) {
      const line = `${String(exp.day).padStart(2,"0")}/${String(exp.month+1).padStart(2,"0")}/${exp.year} — ${exp.category} — ${numberToMoney(exp.value)}${exp.description ? " — " + exp.description : ""}`;
      const split = docPdf.splitTextToSize(line, 180);
      docPdf.text(split, 14, y);
      y += split.length * 5;
      if (y > 275) {
        docPdf.addPage();
        y = 20;
      }
    }
  }

  docPdf.save(`Prestacao_${MESES[month]}_${year}.pdf`);
}

async function generateYearStatementPDF(){
  const year = Number(qs("#histAno").value);
  const receipts = state.receipts.filter(r => r.type === "normal" && r.refYear === year);
  const expenses = state.expenses.filter(e => e.year === year);

  const entrouCaixa = receipts.reduce((a,r)=> a + Number(r.paidNow || 0), 0);
  const entrouCondo = receipts.reduce((a,r)=> a + Number(r.condoAmount || 0), 0);
  const entrouAgua = receipts.reduce((a,r)=> a + Number(r.waterAmount || 0), 0);
  const extra = receipts.reduce((a,r)=> a + Number(r.extraAmount || 0), 0);
  const descontoObra = receipts.reduce((a,r)=> a + Number(r.workDiscount || 0), 0);
  const saiu = expenses.reduce((a,e)=> a + Number(e.value || 0), 0);
  const saldoAno = entrouCaixa - saiu;

  const { jsPDF } = window.jspdf;
  const docPdf = new jsPDF({ unit:"mm", format:"a4" });
  const logo = await loadLogoDataUrl();
  const startY = addLogoToPdf(docPdf, logo);
  let y = pdfHeader(docPdf, `PRESTAÇÃO DE CONTAS — ${year}`, startY);

  docPdf.setFont("helvetica","normal");
  docPdf.setFontSize(12);

  docPdf.text(`Entrou no caixa: ${numberToMoney(entrouCaixa)}`, 14, y); y += 8;
  docPdf.text(`Condomínio lançado: ${numberToMoney(entrouCondo)}`, 14, y); y += 8;
  docPdf.text(`Água lançada: ${numberToMoney(entrouAgua)}`, 14, y); y += 8;
  docPdf.text(`Cobranças extras: ${numberToMoney(extra)}`, 14, y); y += 8;
  docPdf.text(`Descontos por obra: ${numberToMoney(descontoObra)}`, 14, y); y += 8;
  docPdf.text(`Saiu do caixa: ${numberToMoney(saiu)}`, 14, y); y += 8;

  docPdf.setFont("helvetica","bold");
  docPdf.text(`Saldo do ano: ${numberToMoney(saldoAno)}`, 14, y); y += 10;

  docPdf.setFont("helvetica","bold");
  docPdf.text("Despesas do ano:", 14, y); y += 8;
  docPdf.setFont("helvetica","normal");
  docPdf.setFontSize(10);

  if (!expenses.length) {
    docPdf.text("Nenhuma despesa lançada neste ano.", 14, y);
  } else {
    const ordered = expenses.slice().sort((a,b)=>{
      const av = ymValue(a.year, a.month) * 40 + a.day;
      const bv = ymValue(b.year, b.month) * 40 + b.day;
      return av - bv;
    });

    for (const exp of ordered) {
      const line = `${String(exp.day).padStart(2,"0")}/${String(exp.month+1).padStart(2,"0")}/${exp.year} — ${exp.category} — ${numberToMoney(exp.value)}${exp.description ? " — " + exp.description : ""}`;
      const split = docPdf.splitTextToSize(line, 180);
      docPdf.text(split, 14, y);
      y += split.length * 5;
      if (y > 275) {
        docPdf.addPage();
        y = 20;
      }
    }
  }

  docPdf.save(`Prestacao_Ano_${year}.pdf`);
}

function wireEvents(){
  initTabs();

  [
    "#recApto","#recNome","#recMesRef","#recAnoRef","#recAjusteSaldo",
    "#recCondominio","#recAgua","#recExtra","#recDescontoObra","#recPagoAgora",
    "#recDia","#recMesEmissao","#recAnoEmissao"
  ].forEach(sel=>{
    const el = qs(sel);
    el.addEventListener("input", refreshReceiptPreview);
    el.addEventListener("change", refreshReceiptPreview);
  });

  [
    "#retroApto","#retroNome","#retroMesInicio","#retroAnoInicio",
    "#retroMesFim","#retroAnoFim","#retroIncluiCondo","#retroIncluiAgua","#retroAguaTotal"
  ].forEach(sel=>{
    const el = qs(sel);
    el.addEventListener("input", refreshRetroPreview);
    el.addEventListener("change", refreshRetroPreview);
  });

  qs("#btnProximo").addEventListener("click", async ()=>{
    qs("#recNumero").value = await getNextReceiptNumber();
    qs("#retroNumero").value = qs("#recNumero").value;
    refreshReceiptPreview();
    refreshRetroPreview();
  });

  qs("#recApto").addEventListener("change", handleApartmentChange);
  qs("#btnGerarRecibo").addEventListener("click", saveNormalReceipt);
  qs("#btnGerarRetroativo").addEventListener("click", saveRetroReceipt);
  qs("#btnAddDesp").addEventListener("click", addExpense);
  qs("#btnAplicarFiltro").addEventListener("click", renderHistory);
  qs("#btnPDFMes").addEventListener("click", generateMonthlyStatementPDF);
  qs("#btnPDFAno").addEventListener("click", generateYearStatementPDF);
}

(async function boot(){
  await ensureInitialData();
  loadDefaults();
  bindRealtime();
  wireEvents();
})();
