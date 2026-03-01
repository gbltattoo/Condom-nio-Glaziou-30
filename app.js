const MESES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
];

const FIXOS = {
  endereco: "Rua Glaziou, 30 — Pilares - RJ",
  cidade: "Rio de Janeiro",
  emitente: "Gabriel Brito Cirilo"
};

const STORAGE = {
  seq: "glaziou30_recibo_seq_v3",
  recibos: "glaziou30_recibos_v3",
  despesas: "glaziou30_despesas_v3"
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

/* ===== Recibos storage ===== */
function getRecibos(){ return loadJSON(STORAGE.recibos, []); }
function setRecibos(arr){ saveJSON(STORAGE.recibos, arr); }

/* ===== Despesas storage ===== */
function getDespesas(){ return loadJSON(STORAGE.despesas, []); }
function setDespesas(arr){ saveJSON(STORAGE.despesas, arr); }

/* ===== Sequência do recibo (auto) ===== */
function getSeq(){ return Number(localStorage.getItem(STORAGE.seq) || "0"); }
function setSeq(n){ localStorage.setItem(STORAGE.seq, String(n)); }

/* Reconhece o maior número de recibo já salvo e ajusta o seq */
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

/* Cria e coloca automaticamente o próximo número no campo */
function setNextNumberOnLoad(){
  syncSeqWithHistory();
  const next = getSeq() + 1;
  qs("#recNumero").value = pad(next, 6);
}

/* botão "Próximo" pula número */
function nextRecibo(){
  syncSeqWithHistory();
  const next = getSeq() + 1;
  setSeq(next);
  qs("#recNumero").value = pad(next, 6);
  refreshAll();
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

  return (
`RECIBO Nº ${num}

Recebido de: ${nome}
Endereço: ${FIXOS.endereco} — Apto ${apto}

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
  qs("#txtApto").textContent = `Apto ${qs("#recApto").value}`;
  qs("#recPreview").textContent = previewText();
}

/* ===== PDF Recibo ===== */
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

function gerarPDFRecibo(){
  // salva automaticamente no histórico antes de gerar
  salvarReciboHistorico(true);

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:"mm", format:"a4" });

  const num = qs("#recNumero").value.trim();
  const nome = qs("#recNome").value.trim();
  const apto = qs("#recApto").value;
  const { vCondo, vAgua, total } = calcTotal();

  pdfHeader(doc, `RECIBO Nº ${num}`);

  doc.setFont("helvetica","normal");
  doc.setFontSize(12);

  let y = 38;
  const lh = 8;

  doc.text(`Recebido de: ${nome || "________________________________________"}`, 14, y); y += lh;
  doc.text(`Endereço: ${FIXOS.endereco} — Apto ${apto}`, 14, y); y += lh;
  doc.text(`Referente a: ${referenteTexto()}`, 14, y); y += lh;
  doc.text(`Mês/Referência: ${refLabel()}`, 14, y); y += (lh+2);

  doc.setFont("helvetica","bold");
  doc.text("Valores recebidos:", 14, y); y += lh;

  doc.setFont("helvetica","normal");
  doc.text(`Condomínio: ${numberToBRL(vCondo)}`, 14, y); y += lh;
  doc.text(`Água: ${numberToBRL(vAgua)}`, 14, y); y += lh;

  doc.setFont("helvetica","bold");
  doc.text(`TOTAL: ${numberToBRL(total)}`, 14, y); y += (lh+4);

  doc.setFont("helvetica","normal");
  doc.text(emissaoLabel(), 14, y); y += (lh+6);

  doc.text(`Emitente: ${FIXOS.emitente}`, 14, y);

  doc.save(`Recibo_${num}_Apto_${apto}.pdf`);
}

/* ===== Histórico Recibos ===== */
function salvarReciboHistorico(silent=false){
  // garante número
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

  // atualiza seq para esse número (se for maior)
  const n = Number(num.replace(/\D/g,"")) || 0;
  if(n > getSeq()) setSeq(n);

  // já coloca o próximo número automaticamente pro próximo recibo
  qs("#recNumero").value = pad(getSeq() + 1, 6);

  renderHistorico();
  refreshAll();

  if(!silent) alert("Recibo salvo no histórico!");
}

function delRecibo(id){
  setRecibos(getRecibos().filter(r => r.id !== id));
  renderHistorico();
}

function sumCondominio(recibos){
  return recibos.reduce((acc,r)=> acc + (r.vCondo || 0), 0);
}
function sumAgua(recibos){
  return recibos.reduce((acc,r)=> acc + (r.vAgua || 0), 0);
}
function sumTotal(recibos){
  return recibos.reduce((acc,r)=> acc + (r.total || 0), 0);
}
function sumDespesas(despesas){
  return despesas.reduce((acc,d)=> acc + (d.valor || 0), 0);
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

  const item = {
    id: uid(),
    dia, mes, ano,
    cat,
    desc,
    valor,
    createdAt: new Date().toISOString()
  };

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

/* ===== PDF prestação anual ===== */
function gerarPDFMensal(){
  const ano = Number(qs("#histAno").value);
  if(!ano || isNaN(ano)){
    alert("Preencha o filtro de ANO no Histórico e clique em Aplicar antes de gerar o PDF.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:"mm", format:"a4" });

  const recibosAno = getRecibos().filter(r=> r.refAno === ano);
  const despesasAno = getDespesas().filter(d=> d.ano === ano);

  const totalCondo = sumCondominio(recibosAno);
  const totalAgua = sumAgua(recibosAno);
  const totalDesp = sumDespesas(despesasAno);
  const caixaCondo = totalCondo - totalDesp;

  doc.setFont("helvetica","bold");
  doc.setFontSize(14);
  doc.text(`PRESTAÇÃO DE CONTAS — ${ano}`, 14, 16);

  doc.setFont("helvetica","normal");
  doc.setFontSize(10);
  doc.text(`${FIXOS.endereco} — ${FIXOS.cidade}/RJ`, 14, 22);
  doc.line(14, 25, 196, 25);

  let y = 36;
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
    despesasAno
      .slice()
      .sort((a,b)=> (a.mes===b.mes ? a.dia-b.dia : a.mes-b.mes))
      .forEach(d=>{
        const linha = `${String(d.dia).padStart(2,"0")}/${String(d.mes+1).padStart(2,"0")}/${d.ano} — ${d.cat} — ${numberToBRL(d.valor)}${d.desc ? " — " + d.desc : ""}`;
        const split = doc.splitTextToSize(linha, 180);
        doc.text(split, 14, y);
        y += split.length * 5;
        if(y > 275){
          doc.addPage();
          y = 20;
        }
      });
  }

  doc.setFontSize(10);
  doc.text(`Emitente: ${FIXOS.emitente}`, 14, 285);

  doc.save(`Prestacao_de_Contas_${ano}.pdf`);
}

/* ===== Events ===== */
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

  // Histórico
  qs("#btnAplicarAno").addEventListener("click", renderHistorico);

  qs("#btnLimparHist").addEventListener("click", ()=>{
    const ok = confirm("Apagar TODO o histórico de recibos deste navegador?");
    if(!ok) return;
    setRecibos([]);
    renderHistorico();
    syncSeqWithHistory();
    setNextNumberOnLoad();
    refreshAll();
  });

  qs("#btnPDFMensal").addEventListener("click", gerarPDFMensal);

  // Despesas
  qs("#btnAddDesp").addEventListener("click", addDespesa);

  qs("#btnLimparDesp").addEventListener("click", ()=>{
    const ok = confirm("Apagar TODAS as despesas deste navegador?");
    if(!ok) return;
    setDespesas([]);
    renderDespesas();
    renderHistorico();
  });
}

document.addEventListener("DOMContentLoaded", ()=>{
  const t = today();

  // datas automáticas (recibo)
  qs("#recDia").value = String(t.dia);
  qs("#recMesEmissao").value = String(t.mes);
  qs("#recAnoEmissao").value = t.ano;

  qs("#recMesRef").value = String(t.mes);
  qs("#recAnoRef").value = t.ano;

  // filtro histórico automático
  qs("#histAno").value = t.ano;

  // despesas automáticas (dia/mês/ano)
  qs("#despDia").value = String(t.dia);
  qs("#despMes").value = String(t.mes);
  qs("#despAno").value = t.ano;

  // número automático baseado no histórico
  setNextNumberOnLoad();

  // render inicial
  refreshAll();
  renderHistorico();
  renderDespesas();

  // eventos
  wireEvents();
});
