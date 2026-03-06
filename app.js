const MESES = [
"Janeiro","Fevereiro","Março","Abril","Maio","Junho",
"Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
]

const APARTAMENTOS = [
"101",
"101 Fundos",
"201",
"201 Sala",
"201 Fundos",
"301",
"301 Sala",
"301 Fundos"
]

const TAXA_CONDOMINIO = 160

function qs(e){return document.querySelector(e)}
function qsa(e){return [...document.querySelectorAll(e)]}

function salvar(chave,valor){
localStorage.setItem(chave,JSON.stringify(valor))
}

function carregar(chave){
let d=localStorage.getItem(chave)
return d?JSON.parse(d):[]
}

function dinheiro(n){
return Number(n||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})
}

function dinheiroNumero(v){
if(!v)return 0
return Number(v.replace(/\./g,"").replace(",",".").replace(/[^\d.]/g,""))||0
}

let recibos = carregar("recibos")
let apartamentos = carregar("apartamentos")

if(apartamentos.length===0){
apartamentos=APARTAMENTOS.map(a=>({
nome:a,
saldo:0,
isento:a==="101 Fundos"
}))
salvar("apartamentos",apartamentos)
}

function preencherApartamentos(){

let select=qs("#recApto")
let selectRetro=qs("#retroApto")

select.innerHTML=""
selectRetro.innerHTML=""

apartamentos.forEach(a=>{
let o=document.createElement("option")
o.value=a.nome
o.textContent=a.nome
select.appendChild(o)

let o2=document.createElement("option")
o2.value=a.nome
o2.textContent=a.nome
selectRetro.appendChild(o2)
})
}

function preencherMeses(){

qsa("#recMesRef,#recMesEmissao,#retroMesInicio,#retroMesFim,#histMes").forEach(sel=>{
sel.innerHTML=""
MESES.forEach((m,i)=>{
let o=document.createElement("option")
o.value=i
o.textContent=m
sel.appendChild(o)
})
})

}

function proximoRecibo(){
let n=recibos.length+1
qs("#recNumero").value=String(n).padStart(6,"0")
}

function atualizarSaldo(){

let apt=apartamentos.find(a=>a.nome===qs("#recApto").value)

let saldoAnterior=apt.saldo

let cond=apt.isento?0:dinheiroNumero(qs("#recCondominio").value)
let agua=dinheiroNumero(qs("#recAgua").value)
let extra=dinheiroNumero(qs("#recExtra").value)
let desconto=dinheiroNumero(qs("#recDescontoObra").value)
let pago=dinheiroNumero(qs("#recPagoAgora").value)

let total=saldoAnterior+cond+agua+extra-desconto-pago

qs("#recSaldoAnterior").value=dinheiro(saldoAnterior)
qs("#recSaldoRestante").value=dinheiro(total)
qs("#recTotalReferencia").value=dinheiro(cond+agua+extra)

qs("#recSituacao").value=total<=0?"Quitado":"Em aberto"

}

function salvarRecibo(){

let apt=apartamentos.find(a=>a.nome===qs("#recApto").value)

let cond=apt.isento?0:dinheiroNumero(qs("#recCondominio").value)
let agua=dinheiroNumero(qs("#recAgua").value)
let extra=dinheiroNumero(qs("#recExtra").value)
let desconto=dinheiroNumero(qs("#recDescontoObra").value)
let pago=dinheiroNumero(qs("#recPagoAgora").value)

let saldoAnterior=apt.saldo
let saldoNovo=saldoAnterior+cond+agua+extra-desconto-pago

apt.saldo=saldoNovo

salvar("apartamentos",apartamentos)

let r={
numero:qs("#recNumero").value,
apto:apt.nome,
nome:qs("#recNome").value,
mes:qs("#recMesRef").value,
ano:qs("#recAnoRef").value,
saldo:saldoNovo,
pago:pago,
data:new Date().toLocaleDateString()
}

recibos.push(r)

salvar("recibos",recibos)

renderHistorico()

proximoRecibo()

alert("Recibo salvo")
}

function renderHistorico(){

let tbody=qs("#tbodyHistorico")

if(!tbody)return

tbody.innerHTML=""

recibos.forEach(r=>{

let tr=document.createElement("tr")

tr.innerHTML=`
<td>${r.numero}</td>
<td>${MESES[r.mes]}/${r.ano}</td>
<td>${r.apto}</td>
<td>${r.nome}</td>
<td>${dinheiro(r.pago)}</td>
<td>${dinheiro(r.saldo)}</td>
<td>${r.data}</td>
`

tbody.appendChild(tr)

})

}

function gerarPDF(){

const {jsPDF}=window.jspdf

let doc=new jsPDF()

doc.text("Recibo Condomínio",20,20)

doc.text("Recebido de: "+qs("#recNome").value,20,40)

doc.text("Apartamento: "+qs("#recApto").value,20,50)

doc.text("Referente: "+MESES[qs("#recMesRef").value]+" / "+qs("#recAnoRef").value,20,60)

doc.text("Valor pago: "+qs("#recPagoAgora").value,20,70)

doc.save("recibo.pdf")

}

function iniciar(){

preencherApartamentos()

preencherMeses()

proximoRecibo()

qs("#recCondominio").value="160,00"

qs("#btnGerarRecibo").onclick=salvarRecibo

qs("#btnProximo").onclick=proximoRecibo

qsa("input").forEach(i=>{
i.oninput=atualizarSaldo
})

renderHistorico()

}

document.addEventListener("DOMContentLoaded",iniciar)
