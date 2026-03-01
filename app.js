/* =========================
   CONFIG
========================= */
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
  endereco: "Rua Glaziou, 30",
  cidade: "Rio de Janeiro",
  emitente: "Gabriel Brito Cirilo"
};

const STORAGE = {
  seq: "glaziou30_recibo_seq",
  hist: "glaziou30_recibo_hist",
  sig: "glaziou30_assinatura_base64"
};

/* =========================
   HELPERS
========================= */
function qs(sel){ return document.querySelector(sel); }
function qsa(sel){ return [...document.querySelectorAll(sel)]; }

function pad(n, size=6){
  const s = String(n);
  return s.length >= size ? s : "0".repeat(size - s.length) + s;
}

function brlToNumber(str){
  if(!str) return 0;
  return Number(String(str).replace(/\./g,"").replace(",",".").replace(/[^\d.]/g,"")) || 0;
}
function numberToBRL(n){
  return n.toLocaleString("pt-BR",{ style:"currency", currency:"BRL" });
}

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

function getSig(){
  return localStorage.getItem(STORAGE.sig) || "";
}

function todayParts(){
  const d = new Date();
  return { dia:d.getDate(), mes:d.getMonth(), ano:d.getFullYear() };
}

/* =========================
   UI INIT
========================= */
function fillSelect(el, items){
  el.innerHTML = "";
  for(const it of items){
    const opt = document.createElement("option");
    opt.value = it.value ?? it;
    opt.textContent = it.label ?? it;
    el.appendChild(opt);
  }
}

function fillMonths(el){
  el.innerHTML = "";
  MESES.forEach((m, idx)=>{
    const opt = document.createElement("option");
    opt.value = String(idx);
    opt.textContent = m;
    el.appendChild(opt);
  });
}

function fillDays(el){
  el.innerHTML = "";
  for(let i=1;i<=31;i++){
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = String(i);
    el.appendChild(opt);
  }
}

/* =========================
   SIDEBAR TABS
========================= */
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

/* =========================
   RECIBO STATE
========================= */
function nextRecibo(){
  const current = Number(localStorage.getItem(STORAGE.seq) || "0");
  const next = current + 1;
  localStorage.setItem(STORAGE.seq, String(next));
  qs("#recNumero").value = pad(next, 6);
  refreshPreview();
}

function calcTotal(){
  const ckCondo = qs("#ckCondo").checked;
  const ckAgua = qs("#ckAgua").checked;

  const vCondo = ckCondo ? brlToNumber(qs("#recValorCondo").value) : 0;
  const vAgua  = ckAgua  ? brlToNumber(qs("#recValorAgua").value)  : 0;

  const total = vCondo + vAgua;
  qs("#recTotal").value = numberToBRL(total);

  // bloqueia campo se desmarcar
  qs("#recValorCondo").disabled = !ckCondo;
  qs("#recValorAgua").disabled = !ckAgua;

  return { vCondo, vAgua, total };
}

function referenteTexto(){
  const ckCondo = qs("#ckCondo").checked;
  const ckAgua  = qs("#ckAgua").checked;

  if(ckCondo && ckAgua) return "Condomínio e Água";
  if(ckCondo) return "Condomínio";
  if(ckAgua) return "Água";
  return "—";
}

function refLabel(){
  const mesIdx = Number(qs("#recMesRef").value);
  const anoRef = Number(qs("#recAnoRef").value);
  return `${MESES[mesIdx]}/${anoRef}`;
}

function emissaoLabel(){
  const dia = Number(qs("#recDia").value);
  const mesIdx = Number(qs("#recMesEmissao").value);
  const ano = Number(qs("#recAnoEmissao").value);
  return `${FIXOS.cidade}, dia ${dia} de ${MESES[mesIdx]} de ${ano}`;
}

function refreshAptoLabel(){
  const ap = qs("#recApto").value;
  qs("#txtApto").textContent = `Apto ${ap}`;
}

function buildPreviewText(){
  const num = qs("#recNumero").value.trim() || "______";
  const nome = qs("#recNome").value.trim() || "__________________________";
  const apto = qs("#recApto").value;
  const { vCondo, vAgua, total } = calcTotal();

  const ref = refLabel();
  const refTxt = referenteTexto();
  const emissao = emissaoLabel();

  const linhasValores = [
    `• Condomínio: ${numberToBRL(vCondo)}`,
    `• Água: ${numberToBRL(vAgua)}`,
    `• Total: ${numberToBRL(total)}`
  ].join("\n");

  return (
`RECIBO Nº ${num}

Recebido de: ${nome}
Endereço: ${FIXOS.endereco} — Apto ${apto}

Referente a: ${refTxt}
Mês/Referência: ${ref}

Valores:
${linhasValores}

${emissao}

Emitente: ${FIXOS.emitente}

Assinatura: ____________________________
`
  );
}

function refreshPreview(){
  refreshAptoLabel();
  qs("#recPreview").textContent = buildPreviewText();
}

/* =========================
   PDF
========================= */
function pdfHeader(doc, title){
  doc.setFont("helvetica","bold");
  doc.setFontSize(14);
  doc.text(title, 14, 16);

  doc.setFont("helvetica","normal");
  doc.setFontSize(10);
  doc.text(`${FIXOS.endereco} — ${FIXOS.cidade}/RJ`, 14, 22);

  doc.setDrawColor(60);
  doc.line(14, 25, 196, 25);
}

function pdfAddSignature(doc, x, y, w, h){
  const sig = getSig();
  if(!sig) return;

  const isPng = sig.startsWith("data:image/png");
  const isJpg = sig.startsWith("data:image/jpeg") || sig.startsWith("data:image/jpg");
  const fmt = isPng ? "PNG" : (isJpg ? "JPEG" : "PNG");

  try{
    doc.addImage(sig, fmt, x, y, w, h);
  }catch{
    // ignora se falhar
  }
}

function gerarPDF(){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:"mm", format:"a4" });

  // se não tiver número, gera
  if(!qs("#recNumero").value.trim()) nextRecibo();

  const num = qs("#recNumero").value.trim();
  const nome = qs("#recNome").value.trim();
  const apto = qs("#recApto").value;

  const { vCondo, vAgua, total } = calcTotal();
  const refTxt = referenteTexto();
  const ref = refLabel();
  const emissao = emissaoLabel();

  pdfHeader(doc, `RECIBO Nº ${num}`);

  doc.setFont("helvetica","normal");
  doc.setFontSize(12);

  let y = 38;
  const lh = 8;

  doc.text(`Recebido de: ${nome || "________________________________________"}`, 14, y); y += lh;
  doc.text(`Endereço: ${FIXOS.endereco} — Apto ${apto}`, 14, y); y += lh;
  doc.text(`Referente a: ${refTxt}`, 14, y); y += lh;
  doc.text(`Mês/Referência: ${ref}`, 14, y); y += (lh+2);

  doc.setFont("helvetica","bold");
  doc.text("Valores recebidos:", 14, y); y += lh;
  doc.setFont("helvetica","normal");
  doc.text(`Condomínio: ${numberToBRL(vCondo)}`, 14, y); y += lh;
  doc.text(`Água: ${numberToBRL(vAgua)}`, 14, y); y += lh;
  doc.setFont("helvetica","bold");
  doc.text(`TOTAL: ${numberToBRL(total)}`, 14, y); y += (lh+4);

  doc.setFont("helvetica","normal");
  doc.text(emissao, 14, y); y += (lh+6);

  doc.text(`Emitente: ${FIXOS.emitente}`, 14, y); y += (lh+6);

  // assinatura
  doc.line(14, y, 120, y);
  doc.setFontSize(10);
  doc.text("Assinatura", 14, y + 5);

  // imagem assinatura (opcional)
  pdfAddSignature(doc, 14, y - 18, 70, 16);

  doc.save(`Recibo_${num}_Apto_${apto}.pdf`);
}

/* =========================
   HISTÓRICO
========================= */
function getHist(){ return loadJSON(STORAGE.hist, []); }
function setHist(arr){ saveJSON(STORAGE.hist, arr); }

function salvarHistorico(){
  // se não tiver número, gera
  if(!qs("#recNumero").value.trim()) nextRecibo();

  const num = qs("#recNumero").value.trim();
  const nome = qs("#recNome").value.trim();
  const apto = qs("#recApto").value;

  const mesIdx = Number(qs("#recMesRef").value);
  const anoRef = Number(qs("#recAnoRef").value);

  const dia = Number(qs("#recDia").value);
  const mesEm = Number(qs("#recMesEmissao").value);
  const anoEm = Number(qs("#recAnoEmissao").value);

  const { vCondo, vAgua, total } = calcTotal();

  const item = {
    id: crypto.randomUUID(),
    num,
    apto,
    nome,
    refMes: mesIdx,
    refAno: anoRef,
    emDia: dia,
    emMes: mesEm,
    emAno: anoEm,
    vCondo,
    vAgua,
    total,
    createdAt: new Date().toISOString()
  };

  const arr = getHist();
  arr.push(item);
  setHist(arr);
  renderHist();
  alert("Salvo no histórico!");
}

function delHist(id){
  setHist(getHist().filter(x=>x.id !== id));
  renderHist();
}

function renderHist(){
  const tbody = qs("#tbodyHist");
  const arr = getHist().slice().sort((a,b)=> a.num.localeCompare(b.num));

  tbody.innerHTML = "";
  for(const h of arr){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${h.num}</td>
      <td>${MESES[h.refMes]}/${h.refAno}</td>
      <td>${h.apto}</td>
      <td>${h.nome || ""}</td>
      <td>${numberToBRL(h.vCondo)}</td>
      <td>${numberToBRL(h.vAgua)}</td>
      <td><b>${numberToBRL(h.total)}</b></td>
      <td>${h.emDia}/${String(h.emMes+1).padStart(2,"0")}/${h.emAno}</td>
      <td class="actions">
        <button class="linkbtn" data-del="${h.id}">Excluir</button>
      </td>
    `;
    tbody.appendChild(tr);
  }

  tbody.querySelectorAll("[data-del]").forEach(btn=>{
    btn.addEventListener("click", ()=> delHist(btn.dataset.del));
  });
}

/* =========================
   ASSINATURA
========================= */
function fileToBase64(file){
  return new Promise((resolve, reject)=>{
    const r = new FileReader();
    r.onload = ()=> resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function initAssinatura(){
  const img = qs("#sigPreview");
  img.src = getSig() || "";

  qs("#sigFile").addEventListener("change", async (e)=>{
    const file = e.target.files?.[0];
    if(!file) return;

    const base64 = await fileToBase64(file);
    localStorage.setItem(STORAGE.sig, base64);
    img.src = base64;
    alert("Assinatura salva! Ela vai aparecer no PDF.");
    e.target.value = "";
  });

  qs("#btnRemoverSig").addEventListener("click", ()=>{
    localStorage.removeItem(STORAGE.sig);
    img.src = "";
    alert("Assinatura removida.");
  });
}

/* =========================
   EVENTS
========================= */
function initEvents(){
  // total recalcula
  ["#recValorCondo","#recValorAgua","#ckCondo","#ckAgua"].forEach(sel=>{
    qs(sel).addEventListener("input", ()=>{ calcTotal(); refreshPreview(); });
    qs(sel).addEventListener("change", ()=>{ calcTotal(); refreshPreview(); });
  });

  // preview geral
  ["#recNumero","#recNome","#recApto","#recMesRef","#recAnoRef","#recDia","#recMesEmissao","#recAnoEmissao"].forEach(sel=>{
    qs(sel).addEventListener("input", refreshPreview);
    qs(sel).addEventListener("change", refreshPreview);
  });

  qs("#btnProximo").addEventListener("click", nextRecibo);
  qs("#btnGerarPDF").addEventListener("click", gerarPDF);
  qs("#btnSalvarHist").addEventListener("click", salvarHistorico);

  qs("#btnLimparHist").addEventListener("click", ()=>{
    const ok = confirm("Tem certeza que deseja limpar TODO o histórico deste navegador?");
    if(!ok) return;
    setHist([]);
    renderHist();
    alert("Histórico limpo.");
  });
}

/* =========================
   BOOT
========================= */
(function boot(){
  initTabs();

  // selects
  fillSelect(qs("#recApto"), APTOS);
  fillMonths(qs("#recMesRef"));
  fillMonths(qs("#recMesEmissao"));
  fillDays(qs("#recDia"));

  // defaults (hoje)
  const t = todayParts();
  qs("#recDia").value = String(t.dia);
  qs("#recMesEmissao").value = String(t.mes);
  qs("#recAnoEmissao").value = t.ano;

  qs("#recMesRef").value = String(t.mes);
  qs("#recAnoRef").value = t.ano;

  // placeholder número
  const seq = Number(localStorage.getItem(STORAGE.seq) || "0");
  qs("#recNumero").placeholder = `Sugestão: ${pad(seq+1, 6)}`;

  // init
  calcTotal();
  initEvents();
  initAssinatura();
  renderHist();
  refreshPreview();
})();
