const MESES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
];

const APARTAMENTOS_PADRAO = [
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
  aptoIsentoPadrao: "101 Fundos",
  logoPath: "logo.png"
};

const STORAGE = {
  apartments: "cond_apartments_v3",
  receipts: "cond_receipts_v3",
  expenses: "cond_expenses_v3",
  seq: "cond_receipt_seq_v3",
  logo: "cond_logo_cache_v3"
};

const state = {
  apartments: [],
  receipts: [],
  expenses: [],
  logoDataUrl: ""
};

function qs(sel){ return document.querySelector(sel); }
function qsa(sel){ return [...document.querySelectorAll(sel)]; }

function saveJSON(key, value){
  localStorage.setItem(key, JSON.stringify(value));
}
function loadJSON(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  }catch{
    return fallback;
  }
}
function moneyToNumber(str){
  if (!str) return 0;
  return Number(String(str).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "")) || 0;
}
function numberToMoney(n){
  return (Number(n) || 0).toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
}
function numberToInput(n){
  return (Number(n) || 0).toLocaleString("pt-BR", { minimumFractionDigits:2, maximumFractionDigits:2 });
}
function pad(n, size=6){
  const s = String(n);
  return s.length >= size ? s : "0".repeat(size - s.length) + s;
}
function uid(){
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
function today(){
  const d = new Date();
  return { dia:d.getDate(), mes:d.getMonth(), ano:d.getFullYear() };
}
function monthYearLabel(month, year){
  return `${MESES[month]}/${year}`;
}
function enderecoCompleto(apto){
  return `${FIXOS.rua} - Apto ${apto} / ${FIXOS.bairroUf}`;
}
function statusFromBalance(balance){
  if (balance <= 0) return "Quitado";
  if (balance < FIXOS.taxaCondominio) return "Parcial";
  return "Em aberto";
}

function getApartments(){ return loadJSON(STORAGE.apartments, []); }
function setApartments(arr){
  state.apartments = arr;
  saveJSON(STORAGE.apartments, arr);
}
function getReceipts(){ return loadJSON(STORAGE.receipts, []); }
function setReceipts(arr){
  state.receipts = arr;
  saveJSON(STORAGE.receipts, arr);
}
function getExpenses(){ return loadJSON(STORAGE.expenses, []); }
function setExpenses(arr){
  state.expenses = arr;
  saveJSON(STORAGE.expenses, arr);
}
function getSeq(){
  return Number(localStorage.getItem(STORAGE.seq) || "0");
}
function setSeq(n){
  localStorage.setItem(STORAGE.seq, String(n));
}

function syncSeqWithHistory(){
  const receipts = getReceipts();
  let maxNum = 0;
  for (const r of receipts) {
    const n = Number(String(r.number || "").replace(/\D/g, "")) || 0;
    if (n > maxNum) maxNum = n;
  }
  if (maxNum > getSeq()) setSeq(maxNum);
}

function nextReceiptPreview(){
  syncSeqWithHistory();
  return pad(getSeq() + 1);
}
function consumeNextReceiptNumber(){
  syncSeqWithHistory();
  const next = getSeq() + 1;
  setSeq(next);
  return pad(next);
}

function ensureInitialData(){
  let apartments = getApartments();
  if (!apartments.length) {
    apartments = APARTAMENTOS_PADRAO.map(name => ({
      id: name,
      name,
      residentName: "",
      balance: 0,
      exemptCondo: name === FIXOS.aptoIsentoPadrao
    }));
    setApartments(apartments);
  } else {
    let changed = false;
    for (const name of APARTAMENTOS_PADRAO) {
      if (!apartments.find(a => a.id === name)) {
        apartments.push({
          id: name,
          name,
          residentName: "",
          balance: 0,
          exemptCondo: name === FIXOS.aptoIsentoPadrao
        });
        changed = true;
      }
    }
    if (changed) setApartments(apartments);
  }

  setReceipts(getReceipts());
  setExpenses(getExpenses());
  syncSeqWithHistory();
}

function fillMonths(select, includeTodos=false){
  select.innerHTML = "";
  if (includeTodos) {
    const opt = document.createElement("option");
    opt.value = "-1";
    opt.textContent = "Todos";
    select.appendChild(opt);
  }
  MESES.forEach((m,i)=>{
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = m;
    select.appendChild(opt);
  });
}

function fillDays(select){
  select.innerHTML = "";
  for (let i=1; i<=31; i++) {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = String(i);
    select.appendChild(opt);
  }
}

function fillApartmentSelect(select){
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

function buildMonthChecklist(){
  const box = qs("#monthChecklist");
  box.innerHTML = "";
  MESES.forEach((m, i)=>{
    const label = document.createElement("label");
    label.className = "month-item";
    label.innerHTML = `<input type="checkbox" value="${i}" class="month-check"> <span>${m}</span>`;
    box.appendChild(label);
  });
}

function selectedMonths(){
  return qsa(".month-check:checked").map(el => Number(el.value)).sort((a,b)=> a-b);
}

function initTabs(){
  qsa(".sidebtn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      qsa(".sidebtn").forEach(b=> b.classList.remove("active"));
      btn.classList.add("active");
      qsa(".panel").forEach(p=> p.classList.add("hidden"));
      qs(`#tab-${btn.dataset.tab}`).classList.remove("hidden");
    });
  });
}

function loadDefaults(){
  const t = today();

  fillApartmentSelect(qs("#recApto"));
  fillMonths(qs("#despMes"));
  fillMonths(qs("#histMes"), true);
  fillDays(qs("#despDia"));
  buildMonthChecklist();

  qs("#recNumero").value = nextReceiptPreview();
  qs("#recAnoRef").value = t.ano;
  qs("#recDiaAtual").value = t.dia;
  qs("#recAgua").value = "0,00";
  qs("#recPagoAgora").value = "0,00";
  qs("#recCondominio").value = numberToInput(FIXOS.taxaCondominio);

  qs("#despDia").value = String(t.dia);
  qs("#despMes").value = String(t.mes);
  qs("#despAno").value = t.ano;

  qs("#histAno").value = t.ano;
  qs("#histMes").value = "-1";

  const checks = qsa(".month-check");
  if (checks[t.mes]) checks[t.mes].checked = true;

  handleApartmentChange();
  refreshReceiptPreview();
}

function computeReceiptData(){
  const apt = aptById(qs("#recApto").value);
  if (!apt) return null;

  const months = selectedMonths();
  const year = Number(qs("#recAnoRef").value);
  const day = Number(qs("#recDiaAtual").value);

  const includeCondo = qs("#ckCondo").checked;
  const includeWater = qs("#ckAgua").checked;

  const condoPerMonth = includeCondo ? (apt.exemptCondo ? 0 : FIXOS.taxaCondominio) : 0;
  const waterPerMonth = includeWater ? moneyToNumber(qs("#recAgua").value) : 0;

  const previousBalance = Number(apt.balance || 0);
  const launchedNow = months.length * (condoPerMonth + waterPerMonth);
  const paidNow = moneyToNumber(qs("#recPagoAgora").value);
  const remainingBalance = previousBalance + launchedNow - paidNow;
  const status = statusFromBalance(remainingBalance);

  let referente = "—";
  if (includeCondo && includeWater) referente = "Condomínio e Água";
  else if (includeCondo) referente = "Condomínio";
  else if (includeWater) referente = "Água";

  return {
    numberPreview: qs("#recNumero").value,
    apt,
    name: qs("#recNome").value.trim(),
    year,
    day,
    months,
    includeCondo,
    includeWater,
    referente,
    condoPerMonth,
    waterPerMonth,
    previousBalance,
    launchedNow,
    paidNow,
    remainingBalance,
    status
  };
}

function refreshReceiptPreview(){
  const data = computeReceiptData();
  if (!data) return;

  qs("#enderecoLinha").textContent = enderecoCompleto(data.apt.name);
  qs("#recSaldoAnterior").value = numberToMoney(data.previousBalance);
  qs("#recTotalLancado").value = numberToMoney(data.launchedNow);
  qs("#recSaldoRestante").value = numberToMoney(data.remainingBalance);
  qs("#recSituacao").value = data.status;

  const mesesTexto = data.months.length
    ? data.months.map(m => monthYearLabel(m, data.year)).join(", ")
    : "Nenhum mês selecionado";

  let linhas = [];
  linhas.push(`Recebido de: ${data.name || "__________________________"}`);
  linhas.push(`Endereço: ${enderecoCompleto(data.apt.name)}`);
  linhas.push(`CEP: ${FIXOS.cep}`);
  linhas.push(``);
  linhas.push(`Referente a: ${data.referente}`);
  linhas.push(`Mês/Referência: ${mesesTexto}`);
  linhas.push(``);
  linhas.push(`Valores recebidos:`);

  if (data.includeCondo) {
    linhas.push(`Condomínio: ${numberToMoney(data.condoPerMonth * data.months.length)}`);
  }
  if (data.includeWater) {
    linhas.push(`Água: ${numberToMoney(data.waterPerMonth * data.months.length)}`);
  }

  linhas.push(``);
  linhas.push(`TOTAL: ${numberToMoney(data.paidNow)}`);

  if (data.previousBalance > 0) {
    linhas.push(``);
    linhas.push(`Saldo anterior da unidade: ${numberToMoney(data.previousBalance)}`);
    linhas.push(`Saldo restante da unidade: ${numberToMoney(data.remainingBalance)}`);
  }

  linhas.push(``);
  linhas.push(`${FIXOS.cidade}, dia ${data.day} de ${MESES[today().mes]} de ${today().ano}`);
  linhas.push(``);
  linhas.push(`Emitente: ${FIXOS.emitente}`);

  qs("#recPreview").textContent = linhas.join("\n");
}

function handleApartmentChange(){
  const apt = aptById(qs("#recApto").value);
  if (!apt) return;

  qs("#recCondominio").value = numberToInput(apt.exemptCondo ? 0 : FIXOS.taxaCondominio);
  refreshReceiptPreview();
}

function saveReceipt(){
  const data = computeReceiptData();
  if (!data) return;

  if (!data.name) {
    alert("Digite o nome do morador/proprietário.");
    return;
  }
  if (!data.months.length) {
    alert("Selecione pelo menos 1 mês.");
    return;
  }
  if (!data.includeCondo && !data.includeWater) {
    alert("Marque Condomínio, Água ou os dois.");
    return;
  }

  const receiptNumber = consumeNextReceiptNumber();

  const receipt = {
    id: uid(),
    number: receiptNumber,
    apartmentName: data.apt.name,
    residentName: data.name,
    year: data.year,
    months: data.months,
    referente: data.referente,
    condoPerMonth: data.condoPerMonth,
    waterPerMonth: data.waterPerMonth,
    previousBalance: data.previousBalance,
    launchedNow: data.launchedNow,
    paidNow: data.paidNow,
    remainingBalance: data.remainingBalance,
    status: data.status,
    issueDay: data.day,
    issueMonth: today().mes,
    issueYear: today().ano,
    createdAt: Date.now()
  };

  const receipts = getReceipts();
  receipts.push(receipt);
  setReceipts(receipts);

  const apartments = getApartments();
  const apt = apartments.find(a => a.id === data.apt.id);
  if (apt) {
    apt.balance = data.remainingBalance;
    apt.residentName = data.name;
    setApartments(apartments);
  }

  qs("#recNumero").value = nextReceiptPreview();
  renderApartments();
  renderHistory();
  refreshReceiptPreview();

  generateReceiptPDF(receipt);
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
        <td><input type="text" value="${ap.residentName || ""}" data-nome="${ap.id}"></td>
        <td><input type="text" value="${numberToInput(ap.balance || 0)}" data-saldo="${ap.id}"></td>
        <td><input type="checkbox" data-isento="${ap.id}" ${ap.exemptCondo ? "checked" : ""}></td>
        <td class="actions">
          <button class="linkbtn" data-saveapt="${ap.id}">Salvar</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

  tbody.querySelectorAll("[data-saveapt]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.dataset.saveapt;
      const apartments = getApartments();
      const apt = apartments.find(a => a.id === id);
      if (!apt) return;

      const nome = tbody.querySelector(`[data-nome="${id}"]`).value.trim();
      const saldo = moneyToNumber(tbody.querySelector(`[data-saldo="${id}"]`).value);
      const isento = tbody.querySelector(`[data-isento="${id}"]`).checked;

      apt.residentName = nome;
      apt.balance = saldo;
      apt.exemptCondo = isento;

      setApartments(apartments);
      fillApartmentSelect(qs("#recApto"));
      renderApartments();
      renderHistory();
      handleApartmentChange();
    });
  });
}

function addExpense(){
  const value = moneyToNumber(qs("#despValor").value);
  if (!value) {
    alert("Digite um valor válido.");
    return;
  }

  const expenses = getExpenses();
  expenses.push({
    id: uid(),
    day: Number(qs("#despDia").value),
    month: Number(qs("#despMes").value),
    year: Number(qs("#despAno").value),
    category: qs("#despCat").value,
    description: qs("#despDesc").value.trim(),
    value,
    createdAt: Date.now()
  });
  setExpenses(expenses);

  qs("#despValor").value = "";
  qs("#despDesc").value = "";

  renderExpenses();
  renderHistory();
}

function renderExpenses(){
  const tbody = qs("#tbodyDespesas");
  tbody.innerHTML = "";

  state.expenses
    .slice()
    .sort((a,b)=> b.createdAt - a.createdAt)
    .forEach(exp=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${String(exp.day).padStart(2,"0")}/${String(exp.month + 1).padStart(2,"0")}/${exp.year}</td>
        <td>${exp.category}</td>
        <td>${exp.description || ""}</td>
        <td>${numberToMoney(exp.value)}</td>
        <td class="actions">
          <button class="linkbtn" data-expdel="${exp.id}">Excluir</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

  tbody.querySelectorAll("[data-expdel]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const ok = confirm("Excluir esta despesa?");
      if (!ok) return;
      const expenses = getExpenses().filter(e => e.id !== btn.dataset.expdel);
      setExpenses(expenses);
      renderExpenses();
      renderHistory();
    });
  });
}

function getHistoryFilter(){
  const year = Number(qs("#histAno").value) || null;
  const monthRaw = Number(qs("#histMes").value);
  const month = monthRaw >= 0 ? monthRaw : null;
  return { year, month };
}

function getFilteredReceipts(year, month){
  return state.receipts.filter(r=>{
    if (year && r.year !== year) return false;
    if (month !== null && !(r.months || []).includes(month)) return false;
    return true;
  });
}

function getFilteredExpenses(year, month){
  return state.expenses.filter(e=>{
    if (year && e.year !== year) return false;
    if (month !== null && e.month !== month) return false;
    return true;
  });
}

function renderHistory(){
  const { year, month } = getHistoryFilter();
  const receipts = getFilteredReceipts(year, month);
  const expenses = getFilteredExpenses(year, month);

  const enteredCash = receipts.reduce((a,r)=> a + Number(r.paidNow || 0), 0);
  const launchedCash = receipts.reduce((a,r)=> a + Number(r.launchedNow || 0), 0);
  const out = expenses.reduce((a,e)=> a + Number(e.value || 0), 0);
  const periodBalance = enteredCash - out;

  qs("#histTotais").innerHTML = `
    <div><b>Entrou no caixa:</b> ${numberToMoney(enteredCash)}</div>
    <div><b>Total lançado em recibos:</b> ${numberToMoney(launchedCash)}</div>
    <div><b>Saiu do caixa:</b> ${numberToMoney(out)}</div>
    <div><b>Saldo do período:</b> ${numberToMoney(periodBalance)}</div>
  `;

  const tbody = qs("#tbodyHistorico");
  tbody.innerHTML = "";

  receipts
    .slice()
    .sort((a,b)=> b.createdAt - a.createdAt)
    .forEach(r=>{
      const ref = (r.months || []).map(m => monthYearLabel(m, r.year)).join(", ");

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.number}</td>
        <td>${ref}</td>
        <td>${r.apartmentName}</td>
        <td>${r.residentName}</td>
        <td>${numberToMoney(r.paidNow || 0)}</td>
        <td>${numberToMoney(r.remainingBalance || 0)}</td>
        <td>${String(r.issueDay).padStart(2,"0")}/${String(r.issueMonth + 1).padStart(2,"0")}/${r.issueYear}</td>
        <td class="actions">
          <button class="linkbtn" data-download="${r.id}">Baixar PDF</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

  tbody.querySelectorAll("[data-download]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const item = state.receipts.find(r => r.id === btn.dataset.download);
      if (item) generateReceiptPDF(item);
    });
  });
}

async function loadLogoDataUrl(){
  if (state.logoDataUrl) return state.logoDataUrl;

  const cached = localStorage.getItem(STORAGE.logo);
  if (cached && cached.startsWith("data:image/")) {
    state.logoDataUrl = cached;
    return cached;
  }

  try {
    const res = await fetch(FIXOS.logoPath, { cache:"no-store" });
    const blob = await res.blob();
    const dataUrl = await new Promise((resolve, reject)=>{
      const reader = new FileReader();
      reader.onload = ()=> resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    state.logoDataUrl = dataUrl;
    localStorage.setItem(STORAGE.logo, dataUrl);
    return dataUrl;
  } catch {
    return "";
  }
}

function addLogoToPdf(docPdf, dataUrl){
  if (!dataUrl) return 18;
  const pageWidth = docPdf.internal.pageSize.getWidth();
  const w = 28;
  const h = 28;
  const x = (pageWidth - w) / 2;
  const y = 10;
  const fmt = dataUrl.startsWith("data:image/jpeg") ? "JPEG" : "PNG";
  try {
    docPdf.addImage(dataUrl, fmt, x, y, w, h);
    return y + h + 6;
  } catch {
    return 18;
  }
}

function pdfHeader(docPdf, title, startY){
  docPdf.setFont("helvetica", "bold");
  docPdf.setFontSize(14);
  docPdf.text(title, 14, startY);

  docPdf.setFont("helvetica", "normal");
  docPdf.setFontSize(10);
  docPdf.text(`${FIXOS.rua} / ${FIXOS.bairroUf} — CEP ${FIXOS.cep} — ${FIXOS.cidade}/RJ`, 14, startY + 6);
  docPdf.line(14, startY + 9, 196, startY + 9);

  return startY + 22;
}

async function generateReceiptPDF(item){
  const { jsPDF } = window.jspdf;
  const docPdf = new jsPDF({ unit:"mm", format:"a4" });
  const logo = await loadLogoDataUrl();
  let y = pdfHeader(docPdf, `RECIBO Nº ${item.number}`, addLogoToPdf(docPdf, logo));

  docPdf.setFont("helvetica", "normal");
  docPdf.setFontSize(12);

  docPdf.text(`Recebido de: ${item.residentName || ""}`, 14, y); y += 8;
  docPdf.text(`Endereço: ${enderecoCompleto(item.apartmentName)}`, 14, y); y += 8;
  docPdf.text(`CEP: ${FIXOS.cep}`, 14, y); y += 10;

  docPdf.text(`Referente a: ${item.referente}`, 14, y); y += 8;
  docPdf.text(`Mês/Referência: ${(item.months || []).map(m => monthYearLabel(m, item.year)).join(", ")}`, 14, y); y += 10;

  docPdf.setFont("helvetica", "bold");
  docPdf.text("Valores recebidos:", 14, y); y += 8;
  docPdf.setFont("helvetica", "normal");

  const totalCondo = (item.condoPerMonth || 0) * ((item.months || []).length);
  const totalAgua = (item.waterPerMonth || 0) * ((item.months || []).length);

  if (totalCondo > 0) {
    docPdf.text(`Condomínio: ${numberToMoney(totalCondo)}`, 14, y); y += 8;
  }
  if (totalAgua > 0) {
    docPdf.text(`Água: ${numberToMoney(totalAgua)}`, 14, y); y += 8;
  }

  y += 2;
  docPdf.setFont("helvetica", "bold");
  docPdf.text(`TOTAL: ${numberToMoney(item.paidNow || 0)}`, 14, y); y += 10;

  if ((item.previousBalance || 0) > 0) {
    docPdf.setFont("helvetica", "normal");
    docPdf.text(`Saldo anterior da unidade: ${numberToMoney(item.previousBalance || 0)}`, 14, y); y += 8;
    docPdf.text(`Saldo restante da unidade: ${numberToMoney(item.remainingBalance || 0)}`, 14, y); y += 10;
  }

  docPdf.setFont("helvetica", "normal");
  docPdf.text(`${FIXOS.cidade}, dia ${item.issueDay} de ${MESES[item.issueMonth]} de ${item.issueYear}`, 14, y); y += 10;
  docPdf.text(`Emitente: ${FIXOS.emitente}`, 14, y);

  docPdf.save(`Recibo_${item.number}_${item.apartmentName}.pdf`);
}

async function generateMonthlyStatementPDF(){
  const { year, month } = getHistoryFilter();
  if (month === null) {
    alert("Selecione um mês específico.");
    return;
  }

  const receipts = getFilteredReceipts(year, month);
  const expenses = getFilteredExpenses(year, month);

  const enteredCash = receipts.reduce((a,r)=> a + Number(r.paidNow || 0), 0);
  const launchedCash = receipts.reduce((a,r)=> a + Number(r.launchedNow || 0), 0);
  const out = expenses.reduce((a,e)=> a + Number(e.value || 0), 0);
  const periodBalance = enteredCash - out;

  const { jsPDF } = window.jspdf;
  const docPdf = new jsPDF({ unit:"mm", format:"a4" });
  const logo = await loadLogoDataUrl();
  let y = pdfHeader(docPdf, `PRESTAÇÃO DE CONTAS — ${monthYearLabel(month, year)}`, addLogoToPdf(docPdf, logo));

  docPdf.setFont("helvetica", "normal");
  docPdf.setFontSize(12);

  docPdf.text(`Entrou no caixa: ${numberToMoney(enteredCash)}`, 14, y); y += 8;
  docPdf.text(`Total lançado em recibos: ${numberToMoney(launchedCash)}`, 14, y); y += 8;
  docPdf.text(`Saiu do caixa: ${numberToMoney(out)}`, 14, y); y += 8;

  docPdf.setFont("helvetica", "bold");
  docPdf.text(`Saldo do período: ${numberToMoney(periodBalance)}`, 14, y); y += 10;

  docPdf.setFont("helvetica", "bold");
  docPdf.text("Despesas do mês:", 14, y); y += 8;

  docPdf.setFont("helvetica", "normal");
  docPdf.setFontSize(10);

  if (!expenses.length) {
    docPdf.text("Nenhuma despesa lançada neste mês.", 14, y);
  } else {
    for (const exp of expenses) {
      const line = `${String(exp.day).padStart(2,"0")}/${String(exp.month + 1).padStart(2,"0")}/${exp.year} — ${exp.category} — ${numberToMoney(exp.value)}${exp.description ? " — " + exp.description : ""}`;
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
  const { year } = getHistoryFilter();

  const receipts = state.receipts.filter(r => r.year === year);
  const expenses = state.expenses.filter(e => e.year === year);

  const enteredCash = receipts.reduce((a,r)=> a + Number(r.paidNow || 0), 0);
  const launchedCash = receipts.reduce((a,r)=> a + Number(r.launchedNow || 0), 0);
  const out = expenses.reduce((a,e)=> a + Number(e.value || 0), 0);
  const periodBalance = enteredCash - out;

  const { jsPDF } = window.jspdf;
  const docPdf = new jsPDF({ unit:"mm", format:"a4" });
  const logo = await loadLogoDataUrl();
  let y = pdfHeader(docPdf, `PRESTAÇÃO DE CONTAS — ${year}`, addLogoToPdf(docPdf, logo));

  docPdf.setFont("helvetica", "normal");
  docPdf.setFontSize(12);

  docPdf.text(`Entrou no caixa: ${numberToMoney(enteredCash)}`, 14, y); y += 8;
  docPdf.text(`Total lançado em recibos: ${numberToMoney(launchedCash)}`, 14, y); y += 8;
  docPdf.text(`Saiu do caixa: ${numberToMoney(out)}`, 14, y); y += 8;

  docPdf.setFont("helvetica", "bold");
  docPdf.text(`Saldo do ano: ${numberToMoney(periodBalance)}`, 14, y); y += 10;

  docPdf.setFont("helvetica", "bold");
  docPdf.text("Despesas do ano:", 14, y); y += 8;

  docPdf.setFont("helvetica", "normal");
  docPdf.setFontSize(10);

  if (!expenses.length) {
    docPdf.text("Nenhuma despesa lançada neste ano.", 14, y);
  } else {
    for (const exp of expenses) {
      const line = `${String(exp.day).padStart(2,"0")}/${String(exp.month + 1).padStart(2,"0")}/${exp.year} — ${exp.category} — ${numberToMoney(exp.value)}${exp.description ? " — " + exp.description : ""}`;
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
    "#recApto","#recNome","#recAnoRef","#recAgua","#recPagoAgora","#ckCondo","#ckAgua"
  ].forEach(sel=>{
    qs(sel).addEventListener("input", refreshReceiptPreview);
    qs(sel).addEventListener("change", refreshReceiptPreview);
  });

  qsa(".month-check").forEach(el=>{
    el.addEventListener("change", refreshReceiptPreview);
  });

  qs("#recApto").addEventListener("change", handleApartmentChange);

  qs("#btnProximo").addEventListener("click", ()=>{
    qs("#recNumero").value = consumeNextReceiptNumber();
    refreshReceiptPreview();
  });

  qs("#btnGerarRecibo").addEventListener("click", saveReceipt);
  qs("#btnAddDesp").addEventListener("click", addExpense);
  qs("#btnAplicarFiltro").addEventListener("click", renderHistory);
  qs("#btnPDFMes").addEventListener("click", generateMonthlyStatementPDF);
  qs("#btnPDFAno").addEventListener("click", generateYearStatementPDF);
}

(function boot(){
  ensureInitialData();
  loadDefaults();
  renderApartments();
  renderExpenses();
  renderHistory();
  wireEvents();
})();
