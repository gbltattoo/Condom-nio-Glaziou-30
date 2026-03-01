function mostrarAba(id) {
  const abas = document.querySelectorAll(".aba");
  abas.forEach(aba => aba.style.display = "none");

  document.getElementById(id).style.display = "block";
}

/* ===================== RECIBO PDF ===================== */
function gerarPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const numero = document.getElementById("numeroRecibo").value;
  const valor = document.getElementById("valorRecibo").value;
  const recebido = document.getElementById("recebidoDe").value;
  const apto = document.getElementById("apartamento").value;
  const referente = document.getElementById("referente").value;

  doc.setFontSize(16);
  doc.text("RECIBO", 20, 20);

  doc.setFontSize(12);
  doc.text("Nº Recibo: " + numero, 20, 40);
  doc.text("Valor: R$ " + valor, 20, 50);
  doc.text("Recebido de: " + recebido, 20, 60);
  doc.text("Endereço: Rua Glaziou, 30 - Apto " + apto, 20, 70);
  doc.text("Referente a: " + referente, 20, 80);

  doc.text("Emitido por: Gabriel Brito Cirilo", 20, 110);

  doc.save("Recibo_" + numero + ".pdf");
}

/* ===================== ÁGUA ===================== */
function calcularAgua() {
  const bloco1 = parseFloat(document.getElementById("bloco1").value) || 0;
  const bloco2 = parseFloat(document.getElementById("bloco2").value) || 0;

  const valorBloco1 = bloco1 / 5;
  const valorBloco2 = bloco2 / 3;

  document.getElementById("resultadoAgua").innerHTML =
    "<p>Bloco 1 (5 aptos): R$ " + valorBloco1.toFixed(2) + " por apartamento</p>" +
    "<p>Bloco 2 (3 aptos): R$ " + valorBloco2.toFixed(2) + " por apartamento</p>";
}

/* ===================== MANUTENÇÃO ===================== */
let manutencoes = [];
let graficoManut;

function adicionarManutencao() {
  const descricao = document.getElementById("descricaoManut").value;
  const valor = parseFloat(document.getElementById("valorManut").value);

  if (!descricao || !valor) {
    alert("Preencha todos os campos!");
    return;
  }

  manutencoes.push(valor);

  atualizarGraficoManut();
}

function atualizarGraficoManut() {
  const ctx = document.getElementById("graficoManut");

  if (graficoManut) {
    graficoManut.destroy();
  }

  graficoManut = new Chart(ctx, {
    type: "bar",
    data: {
      labels: manutencoes.map((_, i) => "Registro " + (i + 1)),
      datasets: [{
        label: "Valores de Manutenção",
        data: manutencoes
      }]
    }
  });
}
