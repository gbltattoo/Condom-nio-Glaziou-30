const MESES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
];

const FIXOS = {
  rua: "Rua Glaziou, 30",
  bairroUf: "Pilares - RJ",
  cep: "20750-010",
  cidade: "Rio de Janeiro",
  emitente: "Gabriel Brito Cirilo",
  logoPath: "logo.png"
};

const STORAGE = {
  seq: "glaziou30_recibo_seq_v6",
  recibos: "glaziou30_recibos_v6",
  despesas: "glaziou30_despesas_v6",
  logoDataUrl: "glaziou30_logo_dataurl_v1"
};

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
function saveJSON(key, value){ localStorage.setItem(key, JSON.stringify(value)); }
function loadJSON(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  }catch{
    return fallback;
  }
}
function uid(){
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
function today(){
  const d = new Date();
  return { dia:d.getDate(), mes:d.getMonth(), ano:d.getFullYear() };
}

/* ===== Tabs ===== */
function initTabs(){
  qsa(".sidebtn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      qsa(".sidebtn").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");

      qsa(".panel").forEach(p=>p.classList.add("hidden"));
      const panel = qs(`#tab-${btn.dataset.tab}`);
      if(panel) panel.classList.remove("hidden");
    });
  });
}

/* ===== Storage ===== */
function getRecibos(){ return loadJSON(STORAGE.recibos, []); }
function setRecibos(arr){ saveJSON(STORAGE.recibos, arr); }
function getDespesas(){ return loadJSON(STORAGE.despesas, []); }
function setDespesas(arr){ saveJSON(STORAGE.despesas, arr); }

/* ===== Sequência ===== */
function getSeq(){ return Number(localStorage.getItem(STORAGE.seq) || "0"); }
function setSeq(n){ localStorage.setItem(STORAGE.seq, String(n)); }

function syncSeqWithHistory(){
  const recibos = getRecibos();
  let maxNum = 0;
  for(const r of recibos){
    const n = Number(String(r.num || "").replace(/\D/g,"")) || 0;
    if(n > maxNum) maxNum = n;
  }
  const seq = getSeq();
  if(maxNum > seq) setSeq(maxNum);
}

function setNextNumberOnLoad(){
  syncSeqWithHistory();
  const next = getSeq() + 1;
  qs("#recNumero").value = pad(next, 6);
}

function nextRecibo(){
  syncSeqWithHistory();
  const next = getSeq() + 1;
  setSeq(next);
  qs("#recNumero").value = pad(next, 6);
  refreshAll();
}

/* ===== Endereço ===== */
function enderecoCompleto(apto){
  return `${FIXOS.rua} - Apto ${apto} / ${FIXOS.bairroUf}`;
}

/* ===== Recibo ===== */
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

function calcTotal(){
  const ckCondo = qs("#ckCondo").checked;
  const ckAgua  = qs("#ckAgua").checked;

  const vCondo = ckCondo ? brlToNumber(qs("#recValorCondo").value) : 0;
  const vAgua  = ckAgua  ? brlToNumber(qs("#recValorAgua").value)  : 0;

  qs("#recValorCondo").disabled = !ckCondo;
  qs("#recValorAgua").disabled = !ckAgua;

  const total = vCondo + vAgua;
  qs("#recTotal").value = numberToBRL(total);
  return { vCondo, vAgua, total };
}

function previewText(){
  const num = qs("#recNumero").value.trim() || "______";
  const nome = qs("#recNome").value.trim() || "__________________________";
  const apto = qs("#recApto").value;
  const { vCondo, vAgua, total } = calcTotal();

  const end = enderecoCompleto(apto);

  return (
`RECIBO Nº ${num}

Recebido de: ${nome}
Endereço: ${end}
CEP: ${FIXOS.cep}

Referente a: ${referenteTexto()}
Mês/Referência: ${refLabel()}

Valores:
• Condomínio: ${numberToBRL(vCondo)}
• Água: ${numberToBRL(vAgua)}
• Total: ${numberToBRL(total)}

${emissaoLabel()}

Emitente: ${FIXOS.emitente}
`
  );
}

function refreshAll(){
  const apto = qs("#recApto").value;
  const end = enderecoCompleto(apto);
  const endEl = qs("#enderecoLinha");
  if(endEl) endEl.textContent = end;
  qs("#recPreview").textContent = previewText();
}

/* ===== Logo DataURL (jsPDF) ===== */
async function loadLogoDataURL(){
  const cached = localStorage.getItem(STORAGE.logoDataUrl);
  if(cached && cached.startsWith("data:image/")) return cached;

  try{
    const res = await fetch(FIXOS.logoPath, { cache: "no-store" });
    if(!res.ok) return "";
    const blob = await res.blob();

    const dataUrl = await new Promise((resolve, reject)=>{
      const r = new FileReader();
      r.onload = ()=> resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });

    if(typeof dataUrl === "string" && dataUrl.startsWith("data:image/")){
      localStorage.setItem(STORAGE.logoDataUrl, dataUrl);
      return dataUrl;
    }
    return "";
  }catch{
    return "";
  }
}

function addLogoToPdf(doc, dataUrl){
  if(!dataUrl) return { headerY: 18 };

  const pageWidth = doc.internal.pageSize.getWidth();
  const logoW = 28;
  const logoH = 28;
  const x = (pageWidth - logoW) / 2;
  const y = 10;

  const isPng = dataUrl.startsWith("data:image/png");
  const isJpg = dataUrl.startsWith("data:image/jpeg") || dataUrl.startsWith("data:image/jpg");
  const fmt = isPng ? "PNG" : (isJpg ? "JPEG" : "PNG");

  try{
    doc.addImage(dataUrl, fmt, x, y, logoW, logoH);
    return { headerY: y + logoH + 6 };
  }catch{
    return { headerY: 18 };
  }
}

/* ===== Histórico (Recibos) ===== */
function salvarReciboHistorico(silent=false){
  if(!qs("#recNumero").value.trim()){
    setNextNumberOnLoad();
  }

  const num = qs("#recNumero").value.trim();
  const nome = qs("#recNome").value.trim();
  const apto = qs("#recApto").value;

  const refMes = Number(qs("#recMesRef").value);
  const refAno = Number(qs("#recAnoRef").value);

  const emDia = Number(qs("#recDia").value);
  const emMes = Number(qs("#recMesEmissao").value);
  const emAno = Number(qs("#recAnoEmissao").value);

  const { vCondo, vAgua, total } = calcTotal();

  const item = {
    id: uid(),
    num, nome, apto,
    refMes, refAno,
    emDia, emMes, emAno,
    vCondo, vAgua, total,
    createdAt: new Date().toISOString()
  };

  const arr = getRecibos();
  arr.push(item);
  setRecibos(arr);

  const n = Number(num.replace(/\D/g,"")) || 0;
  if(n > getSeq()) setSeq(n);

  // prepara o próximo número automaticamente
  qs("#recNumero").value = pad(getSeq() + 1, 6);

  renderHistorico();
  refreshAll();

  if(!silent) alert("Recibo salvo no histórico!");
}

function delRecibo(id){
  setRecibos(getRecibos().filter(r => r.id !== id));
  renderHistorico();
}

function sumCondominio(recibos){ return recibos.reduce((acc,r)=> acc + (r.vCondo || 0), 0); }
function sumAgua(recibos){ return recibos.reduce((acc,r)=> acc + (r.vAgua || 0), 0); }
function sumTotal(recibos){ return recibos.reduce((acc,r)=> acc + (r.total || 0), 0); }
function sumDespesas(despesas){ return despesas.reduce((acc,d)=> acc + (d.valor || 0), 0); }

/* ===== PDF Recibo ===== */
function pdfHeader(doc, title, headerY){
  doc.setFont("helvetica","bold");
  doc.setFontSize(14);
  doc.text(title, 14, headerY);

  doc.setFont("helvetica","normal");
  doc.setFontSize(10);
  doc.text(`${FIXOS.rua} / ${FIXOS.bairroUf} — CEP ${FIXOS.cep} — ${FIXOS.cidade}/RJ`, 14, headerY + 6);

  doc.setDrawColor(60);
  doc.line(14, headerY + 9, 196, headerY + 9);

  return headerY + 22;
}

async function gerarPDFRecibo(){
  // salva no histórico automaticamente
  salvarReciboHistorico(true);

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:"mm", format:"a4" });

  const dataUrl = await loadLogoDataURL();
  const { headerY } = addLogoToPdf(doc, dataUrl);

  // pega o último recibo salvo
  const recibos = getRecibos();
  const last = recibos[recibos.length - 1];

  const num = last?.num || "000000";
  const nome = last?.nome || "";
  const apto = last?.apto || qs("#recApto").value;

  const vCondo = last?.vCondo || 0;
  const vAgua  = last?.vAgua || 0;
  const total  = last?.total || 0;

  const refTxt = (vCondo>0 && vAgua>0) ? "Condomínio e Água" : (vCondo>0 ? "Condomínio" : "Água");
  const ref = `${MESES[last?.refMes ?? 0]}/${last?.refAno ?? new Date().getFullYear()}`;
  const emissao = `${FIXOS.cidade}, dia ${last?.emDia ?? 1} de ${MESES[last?.emMes ?? 0]} de ${last?.emAno ?? new Date().getFullYear()}`;

  const end = enderecoCompleto(apto);

  let y = pdfHeader(doc, `RECIBO Nº ${num}`, headerY);

  doc.setFont("helvetica","normal");
  doc.setFontSize(12);

  const lh = 8;

  doc.text(`Recebido de: ${nome || "________________________________________"}`, 14, y); y += lh;
  doc.text(`Endereço: ${end}`, 14, y); y += lh;
  doc.text(`CEP: ${FIXOS.cep}`, 14, y); y += lh;

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

  doc.text(`Emitente: ${FIXOS.emitente}`, 14, y);

  doc.save(`Recibo_${num}_Apto_${apto}.pdf`);
}

/* ===== PDF Prestação de Contas (Ano) ===== */
async function gerarPDFPrestacaoAno(){
  const ano = Number(qs("#histAno").value);
  if(!ano || isNaN(ano)){
    alert("Preencha o ANO no Histórico e clique em Aplicar antes de gerar o PDF.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:"mm", format:"a4" });

  const dataUrl = await loadLogoDataURL();
  const { headerY } = addLogoToPdf(doc, dataUrl);

  const recibosAno = getRecibos().filter(r => r.refAno === ano);
  const despesasAno = getDespesas().filter(d => d.ano === ano);

  const totalCondo = sumCondominio(recibosAno);
  const totalAgua = sumAgua(recibosAno);
  const totalDesp = sumDespesas(despesasAno);
  const caixaCondo = totalCondo - totalDesp;

  let y = pdfHeader(doc, `PRESTAÇÃO DE CONTAS — ${ano}`, headerY);

  doc.setFont("helvetica","normal");
  doc.setFontSize(12);

  doc.text(`Total arrecadado (Condomínio): ${numberToBRL(totalCondo)}`, 14, y); y += 8;
  doc.text(`Total arrecadado (Água): ${numberToBRL(totalAgua)}`, 14, y); y += 8;
  doc.text(`Total de despesas (Condomínio): ${numberToBRL(totalDesp)}`, 14, y); y += 8;

  doc.setFont("helvetica","bold");
  doc.text(`CAIXA do Condomínio: ${numberToBRL(caixaCondo)}`, 14, y); y += 10;

  doc.setFont("helvetica","bold");
  doc.text("Despesas do ano:", 14, y); y += 8;

  doc.setFont("helvetica","normal");
  doc.setFontSize(10);

  if(despesasAno.length === 0){
    doc.text("Nenhuma despesa cadastrada neste ano.", 14, y);
  } else {
    const sorted = despesasAno.slice().sort((a,b)=>{
      if(a.mes !== b.mes) return a.mes - b.mes;
      if(a.dia !== b.dia) return a.dia - b.dia;
      return (a.cat || "").localeCompare(b.cat || "");
    });

    for(const d of sorted){
      const linha =
        `${String(d.dia).padStart(2,"0")}/${String(d.mes+1).padStart(2,"0")}/${d.ano} — ` +
        `${d.cat} — ${numberToBRL(d.valor)}${d.desc ? " — " + d.desc : ""}`;

      const split = doc.splitTextToSize(linha, 180);
      doc.text(split, 14, y);
      y += split.length * 5;

      if(y > 275){
        doc.addPage();
        y = 20;
      }
    }
  }

  doc.setFontSize(10);
  doc.text(`Emitente: ${FIXOS.emitente}`, 14, 285);

  doc.save(`Prestacao_de_Contas_${ano}.pdf`);
}

/* ===== Despesas ===== */
function addDespesa(){
  const dia = Number(qs("#despDia").value);
  const mes = Number(qs("#despMes").value);
  const ano = Number(qs("#despAno").value);

  const cat = qs("#despCat").value;
  const valor = brlToNumber(qs("#despValor").value);
  const desc = qs("#despDesc").value.trim();

  if(!ano || isNaN(ano)){ alert("Ano inválido."); return; }
  if(!valor){ alert("Preencha um valor válido."); return; }

  const item = { id: uid(), dia, mes, ano, cat, desc, valor, createdAt: new Date().toISOString() };

  const arr = getDespesas();
  arr.push(item);
  setDespesas(arr);

  qs("#despValor").value = "";
  qs("#despDesc").value = "";

  renderDespesas();
  renderHistorico();
}

function delDespesa(id){
  setDespesas(getDespesas().filter(d => d.id !== id));
  renderDespesas();
  renderHistorico();
}

function renderDespesas(){
  const despesas = getDespesas();
  const tbody = qs("#tbodyDesp");
  tbody.innerHTML = "";

  despesas
    .slice()
    .sort((a,b)=> (a.ano===b.ano ? (a.mes===b.mes ? a.dia-b.dia : a.mes-b.mes) : a.ano-b.ano))
    .forEach(d=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${String(d.dia).padStart(2,"0")}/${String(d.mes+1).padStart(2,"0")}/${d.ano}</td>
        <td>${d.cat}</td>
        <td>${d.desc || ""}</td>
        <td>${numberToBRL(d.valor || 0)}</td>
        <td class="actions">
          <button class="linkbtn" data-ddel="${d.id}">Excluir</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

  tbody.querySelectorAll("[data-ddel]").forEach(btn=>{
    btn.addEventListener("click", ()=> delDespesa(btn.dataset.ddel));
  });

  const totalDesp = despesas.reduce((acc,d)=> acc + (d.valor || 0), 0);
  qs("#despTotais").innerHTML = `<div><b>Total de despesas cadastradas:</b> ${numberToBRL(totalDesp)}</div>`;
}

function renderHistorico(){
  const anoFiltro = Number(qs("#histAno").value) || null;

  const recibosAll = getRecibos();
  const recibos = anoFiltro ? recibosAll.filter(r=> r.refAno === anoFiltro) : recibosAll;

  const despesasAll = getDespesas();
  const despesas = anoFiltro ? despesasAll.filter(d=> d.ano === anoFiltro) : despesasAll;

  const totalCondo = sumCondominio(recibos);
  const totalAgua = sumAgua(recibos);
  const totalGeral = sumTotal(recibos);

  const totalDesp = sumDespesas(despesas);
  const caixaCondo = totalCondo - totalDesp;

  qs("#histTotais").innerHTML = `
    <div><b>Total arrecadado (somente Condomínio):</b> ${numberToBRL(totalCondo)}</div>
    <div><b>Total arrecadado (Água):</b> ${numberToBRL(totalAgua)}</div>
    <div><b>Total geral (Condomínio + Água):</b> ${numberToBRL(totalGeral)}</div>
    <div style="margin-top:6px;"><b>Total de despesas (Condomínio):</b> ${numberToBRL(totalDesp)}</div>
    <div><b>Caixa do Condomínio (Condomínio - Despesas):</b> ${numberToBRL(caixaCondo)}</div>
  `;

  const tbody = qs("#tbodyHist");
  tbody.innerHTML = "";

  recibos
    .slice()
    .sort((a,b)=> a.num.localeCompare(b.num))
    .forEach(r=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.num}</td>
        <td>${MESES[r.refMes]}/${r.refAno}</td>
        <td>${r.apto}</td>
        <td>${r.nome || ""}</td>
        <td>${numberToBRL(r.vCondo || 0)}</td>
        <td>${numberToBRL(r.vAgua || 0)}</td>
        <td><b>${numberToBRL(r.total || 0)}</b></td>
        <td>${String(r.emDia).padStart(2,"0")}/${String(r.emMes+1).padStart(2,"0")}/${r.emAno}</td>
        <td class="actions">
          <button class="linkbtn" data-del="${r.id}">Excluir</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

  tbody.querySelectorAll("[data-del]").forEach(btn=>{
    btn.addEventListener("click", ()=> delRecibo(btn.dataset.del));
  });
}

/* ===== Eventos ===== */
function wireEvents(){
  initTabs();

  [
    "#recNumero","#recNome","#recApto","#recMesRef","#recAnoRef",
    "#recDia","#recMesEmissao","#recAnoEmissao",
    "#ckCondo","#ckAgua","#recValorCondo","#recValorAgua"
  ].forEach(sel=>{
    const el = qs(sel);
    if(!el) return;
    el.addEventListener("input", refreshAll);
    el.addEventListener("change", refreshAll);
  });

  qs("#btnProximo").addEventListener("click", nextRecibo);
  qs("#btnGerarPDF").addEventListener("click", gerarPDFRecibo);

  qs("#btnAplicarAno").addEventListener("click", renderHistorico);

  qs("#btnPDFPrestacao").addEventListener("click", gerarPDFPrestacaoAno);

  qs("#btnLimparHist").addEventListener("click", ()=>{
    const ok = confirm("Apagar TODO o histórico de recibos deste navegador?");
    if(!ok) return;
    setRecibos([]);
    renderHistorico();
    syncSeqWithHistory();
    setNextNumberOnLoad();
    refreshAll();
  });

  qs("#btnAddDesp").addEventListener("click", addDespesa);

  qs("#btnLimparDesp").addEventListener("click", ()=>{
    const ok = confirm("Apagar TODAS as despesas deste navegador?");
    if(!ok) return;
    setDespesas([]);
    renderDespesas();
    renderHistorico();
  });
}

/* ===== Boot ===== */
document.addEventListener("DOMContentLoaded", ()=>{
  const t = today();

  qs("#recDia").value = String(t.dia);
  qs("#recMesEmissao").value = String(t.mes);
  qs("#recAnoEmissao").value = t.ano;

  qs("#recMesRef").value = String(t.mes);
  qs("#recAnoRef").value = t.ano;

  qs("#histAno").value = t.ano;

  qs("#despDia").value = String(t.dia);
  qs("#despMes").value = String(t.mes);
  qs("#despAno").value = t.ano;

  setNextNumberOnLoad();

  refreshAll();
  renderHistorico();
  renderDespesas();

  wireEvents();
});
