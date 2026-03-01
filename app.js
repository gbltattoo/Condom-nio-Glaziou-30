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
  seq: "glaziou30_recibo_seq_v7",
  recibos: "glaziou30_recibos_v7",
  despesas: "glaziou30_despesas_v7",
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
function uid(){ return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`; }
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

/* ===== Recibo UI ===== */
function referenteTextoFromValues(vCondo, vAgua){
  if(vCondo > 0 && vAgua > 0) return "Condomínio e Água";
  if(vCondo > 0) return "Condomínio";
  if(vAgua > 0) return "Água";
  return "—";
}

function referenteTexto(){
  const ckCondo = qs("#ckCondo").checked;
  const ckAgua  = qs("#ckAgua").checked;
  if(ckCondo && ckAgua) return "Condomínio e Água";
  if(ckCondo) return "Condomínio";
  if(ckAgua) return "Água";
  return "—";
}

function refLabel(mesIdx, anoRef){
  return `${MESES[mesIdx]}/${anoRef}`;
}

function emissaoLabel(dia, mesIdx, ano){
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

  const refMes = Number(qs("#recMesRef").value);
  const refAno = Number(qs("#recAnoRef").value);

  const emDia = Number(qs("#recDia").value);
  const emMes = Number(qs("#recMesEmissao").value);
  const emAno = Number(qs("#recAnoEmissao").value);

  const { vCondo, vAgua, total } = calcTotal();
  const end = enderecoCompleto(apto);

  return (
`RECIBO Nº ${num}

Recebido de: ${nome}
Endereço: ${end}
CEP: ${FIXOS.cep}

Referente a: ${referenteTexto()}
Mês/Referência: ${refLabel(refMes, refAno)}

Valores:
• Condomínio: ${numberToBRL(vCondo)}
• Água: ${numberToBRL(vAgua)}
• Total: ${numberToBRL(total)}

${emissaoLabel(emDia, emMes, emAno)}

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

/* ===== Histórico: filtros ===== */
function getFiltro(){
  const ano = Number(qs("#histAno").value) || null;
  const mes = Number(qs("#histMes").value); // -1 = todos
  const mesValido = (mes >= 0 && mes <= 11) ? mes : null;
  return { ano, mes: mesValido };
}

function sameRef(r, ano, mes){
  if(ano && r.refAno !== ano) return false;
  if(mes !== null && r.refMes !== mes) return false;
  return true;
}

/* ===== Somatórios ===== */
function sum(arr, key){ return arr.reduce((acc,o)=> acc + (Number(o[key]) || 0), 0); }
function sumCondo(recibos){ return sum(recibos, "vCondo"); }
function sumAgua(recibos){ return sum(recibos, "vAgua"); }
function sumTotal(recibos){ return sum(recibos, "total"); }
function sumDesp(despesas){ return sum(despesas, "valor"); }

/* ===== Caixa acumulado até (ano, mes) =====
   - considera SOMENTE caixa do condomínio: (entradas condomínio - despesas)
*/
function ymKey(ano, mes){ return ano * 12 + mes; }

function saldoAcumuladoAte(ano, mes){
  const recibos = getRecibos().filter(r => r.refAno && r.refMes !== undefined);
  const despesas = getDespesas().filter(d => d.ano && d.mes !== undefined);

  const limite = ymKey(ano, mes);

  const condoAte = recibos
    .filter(r => ymKey(r.refAno, r.refMes) <= limite)
    .reduce((acc,r)=> acc + (r.vCondo || 0), 0);

  const despAte = despesas
    .filter(d => ymKey(d.ano, d.mes) <= limite)
    .reduce((acc,d)=> acc + (d.valor || 0), 0);

  return condoAte - despAte;
}

/* ===== Recibo: salvar ===== */
function salvarReciboHistorico(silent=false){
  if(!qs("#recNumero").value.trim()) setNextNumberOnLoad();

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

  // prepara próximo número
  qs("#recNumero").value = pad(getSeq() + 1, 6);

  renderHistorico();
  refreshAll();

  if(!silent) alert("Recibo salvo no histórico!");
}

/* ===== Gerar PDF do recibo (novo) ===== */
async function gerarPDFReciboNovo(){
  salvarReciboHistorico(true);
  const recibos = getRecibos();
  const last = recibos[recibos.length - 1];
  if(!last){ alert("Não foi possível localizar o recibo salvo."); return; }
  await gerarPDFReciboDeItem(last);
}

/* ===== Gerar PDF do recibo (antigo do histórico) ===== */
async function gerarPDFReciboDeItem(item){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:"mm", format:"a4" });

  const dataUrl = await loadLogoDataURL();
  const { headerY } = addLogoToPdf(doc, dataUrl);

  const end = enderecoCompleto(item.apto);

  let y = pdfHeader(doc, `RECIBO Nº ${item.num}`, headerY);

  const refTxt = referenteTextoFromValues(item.vCondo || 0, item.vAgua || 0);
  const ref = refLabel(item.refMes, item.refAno);
  const emissao = emissaoLabel(item.emDia, item.emMes, item.emAno);

  doc.setFont("helvetica","normal");
  doc.setFontSize(12);
  const lh = 8;

  doc.text(`Recebido de: ${item.nome || "________________________________________"}`, 14, y); y += lh;
  doc.text(`Endereço: ${end}`, 14, y); y += lh;
  doc.text(`CEP: ${FIXOS.cep}`, 14, y); y += lh;

  doc.text(`Referente a: ${refTxt}`, 14, y); y += lh;
  doc.text(`Mês/Referência: ${ref}`, 14, y); y += (lh+2);

  doc.setFont("helvetica","bold");
  doc.text("Valores recebidos:", 14, y); y += lh;

  doc.setFont("helvetica","normal");
  doc.text(`Condomínio: ${numberToBRL(item.vCondo || 0)}`, 14, y); y += lh;
  doc.text(`Água: ${numberToBRL(item.vAgua || 0)}`, 14, y); y += lh;

  doc.setFont("helvetica","bold");
  doc.text(`TOTAL: ${numberToBRL(item.total || 0)}`, 14, y); y += (lh+4);

  doc.setFont("helvetica","normal");
  doc.text(emissao, 14, y); y += (lh+6);

  doc.text(`Emitente: ${FIXOS.emitente}`, 14, y);

  doc.save(`Recibo_${item.num}_Apto_${item.apto}.pdf`);
}

/* ===== Histórico: render ===== */
function delRecibo(id){
  setRecibos(getRecibos().filter(r => r.id !== id));
  renderHistorico();
}

function renderHistorico(){
  const { ano, mes } = getFiltro();

  const recibosAll = getRecibos();
  const recibosFiltrados = recibosAll.filter(r => sameRef(r, ano, mes));

  const despesasAll = getDespesas();
  const despesasFiltradas = despesasAll.filter(d => {
    if(ano && d.ano !== ano) return false;
    if(mes !== null && d.mes !== mes) return false;
    return true;
  });

  const totalCondo = sumCondo(recibosFiltrados);
  const totalAgua = sumAgua(recibosFiltrados);
  const totalGeral = sumTotal(recibosFiltrados);
  const totalDespesas = sumDesp(despesasFiltradas);

  const saldoMes = totalCondo - totalDespesas;

  let saldoAcum = null;
  if(ano && mes !== null){
    saldoAcum = saldoAcumuladoAte(ano, mes);
  }

  qs("#histTotais").innerHTML = `
    <div><b>Entrou (Condomínio):</b> ${numberToBRL(totalCondo)}</div>
    <div><b>Entrou (Água):</b> ${numberToBRL(totalAgua)}</div>
    <div><b>Total geral (Condomínio + Água):</b> ${numberToBRL(totalGeral)}</div>
    <div style="margin-top:6px;"><b>Saiu (Despesas do condomínio):</b> ${numberToBRL(totalDespesas)}</div>
    <div><b>Saldo do mês (Condomínio - Despesas):</b> ${numberToBRL(saldoMes)}</div>
    ${ (saldoAcum !== null) ? `<div><b>Caixa acumulado até este mês:</b> ${numberToBRL(saldoAcum)}</div>` : `<div class="muted">Para ver “Caixa acumulado”, selecione um mês específico.</div>` }
  `;

  const tbody = qs("#tbodyHist");
  tbody.innerHTML = "";

  recibosFiltrados
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
          <button class="linkbtn" data-pdf="${r.id}">Baixar PDF</button>
          <button class="linkbtn" data-del="${r.id}">Excluir</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

  tbody.querySelectorAll("[data-del]").forEach(btn=>{
    btn.addEventListener("click", ()=> delRecibo(btn.dataset.del));
  });

  tbody.querySelectorAll("[data-pdf]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const id = btn.dataset.pdf;
      const item = getRecibos().find(r => r.id === id);
      if(!item){ alert("Recibo não encontrado."); return; }
      await gerarPDFReciboDeItem(item);
    });
  });
}

/* ===== PDF Prestação do MÊS ===== */
async function gerarPDFPrestacaoMes(){
  const ano = Number(qs("#histAno").value);
  const mes = Number(qs("#histMes").value);

  if(!ano || isNaN(ano)){ alert("Preencha o ANO no histórico."); return; }
  if(!(mes >= 0 && mes <= 11)){ alert("Selecione um MÊS (não pode ser 'Todos')."); return; }

  const recibosMes = getRecibos().filter(r => r.refAno === ano && r.refMes === mes);
  const despesasMes = getDespesas().filter(d => d.ano === ano && d.mes === mes);

  const entrouCondo = sumCondo(recibosMes);
  const entrouAgua = sumAgua(recibosMes);
  const totalGeral = sumTotal(recibosMes);
  const saiuDesp = sumDesp(despesasMes);

  const saldoMes = entrouCondo - saiuDesp;
  const saldoAcum = saldoAcumuladoAte(ano, mes);

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:"mm", format:"a4" });

  const dataUrl = await loadLogoDataURL();
  const { headerY } = addLogoToPdf(doc, dataUrl);

  let y = pdfHeader(doc, `PRESTAÇÃO DE CONTAS — ${MESES[mes]}/${ano}`, headerY);

  doc.setFont("helvetica","normal");
  doc.setFontSize(12);

  doc.text(`Entrou (Condomínio): ${numberToBRL(entrouCondo)}`, 14, y); y += 8;
  doc.text(`Entrou (Água): ${numberToBRL(entrouAgua)}`, 14, y); y += 8;
  doc.text(`Total geral: ${numberToBRL(totalGeral)}`, 14, y); y += 8;

  doc.text(`Saiu (Despesas do condomínio): ${numberToBRL(saiuDesp)}`, 14, y); y += 8;

  doc.setFont("helvetica","bold");
  doc.text(`Saldo do mês (Condomínio - Despesas): ${numberToBRL(saldoMes)}`, 14, y); y += 10;
  doc.text(`Caixa acumulado até este mês: ${numberToBRL(saldoAcum)}`, 14, y); y += 10;

  doc.setFont("helvetica","bold");
  doc.text("Despesas do mês:", 14, y); y += 8;

  doc.setFont("helvetica","normal");
  doc.setFontSize(10);

  if(despesasMes.length === 0){
    doc.text("Nenhuma despesa cadastrada neste mês.", 14, y);
  } else {
    const sorted = despesasMes.slice().sort((a,b)=>{
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

  doc.save(`Prestacao_${MESES[mes]}_${ano}.pdf`);
}

/* ===== PDF Prestação do ANO ===== */
async function gerarPDFPrestacaoAno(){
  const ano = Number(qs("#histAno").value);
  if(!ano || isNaN(ano)){
    alert("Preencha o ANO no Histórico antes de gerar o PDF.");
    return;
  }

  const recibosAno = getRecibos().filter(r => r.refAno === ano);
  const despesasAno = getDespesas().filter(d => d.ano === ano);

  const totalCondo = sumCondo(recibosAno);
  const totalAgua = sumAgua(recibosAno);
  const totalGeral = sumTotal(recibosAno);
  const totalDesp = sumDesp(despesasAno);

  const caixaAno = totalCondo - totalDesp;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:"mm", format:"a4" });

  const dataUrl = await loadLogoDataURL();
  const { headerY } = addLogoToPdf(doc, dataUrl);

  let y = pdfHeader(doc, `PRESTAÇÃO DE CONTAS — ${ano}`, headerY);

  doc.setFont("helvetica","normal");
  doc.setFontSize(12);

  doc.text(`Entrou (Condomínio): ${numberToBRL(totalCondo)}`, 14, y); y += 8;
  doc.text(`Entrou (Água): ${numberToBRL(totalAgua)}`, 14, y); y += 8;
  doc.text(`Total geral: ${numberToBRL(totalGeral)}`, 14, y); y += 8;

  doc.text(`Saiu (Despesas do condomínio): ${numberToBRL(totalDesp)}`, 14, y); y += 8;

  doc.setFont("helvetica","bold");
  doc.text(`Caixa do ano (Condomínio - Despesas): ${numberToBRL(caixaAno)}`, 14, y); y += 10;

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

  doc.save(`Prestacao_Ano_${ano}.pdf`);
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
  qs("#btnGerarPDF").addEventListener("click", gerarPDFReciboNovo);

  qs("#btnAplicarFiltro").addEventListener("click", renderHistorico);

  qs("#btnPDFMes").addEventListener("click", gerarPDFPrestacaoMes);
  qs("#btnPDFAno").addEventListener("click", gerarPDFPrestacaoAno);

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
  qs("#histMes").value = "-1"; // todos

  qs("#despDia").value = String(t.dia);
  qs("#despMes").value = String(t.mes);
  qs("#despAno").value = t.ano;

  setNextNumberOnLoad();

  refreshAll();
  renderHistorico();
  renderDespesas();

  wireEvents();
});
