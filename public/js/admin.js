// Alternar Abas
function mudarAba(idAba, elemento) {
  document.querySelectorAll('.conteudo-aba').forEach(el => el.classList.remove('ativa'));
  document.querySelectorAll('.aba').forEach(el => el.classList.remove('ativa'));
  document.getElementById(idAba).classList.add('ativa');
  elemento.classList.add('ativa');
  
  if (idAba === 'aba-cardapio') carregarCardapioAdmin();
  if (idAba === 'aba-relatorios') gerarRelatorio();
}

// ================= ABA CARDÁPIO =================
function carregarCardapioAdmin() {
  const dia = document.getElementById('admin-dia').value;
  fetch(`/api/cardapio/${dia}`)
    .then(res => res.json())
    .then(data => {
      document.getElementById('admin-mistura-a').value = data.mistura_a || '';
      document.getElementById('admin-mistura-b').value = data.mistura_b || '';
    });
}

function salvarCardapio() {
  const payload = {
    dia_semana: document.getElementById('admin-dia').value,
    mistura_a: document.getElementById('admin-mistura-a').value.trim(),
    mistura_b: document.getElementById('admin-mistura-b').value.trim()
  };

  fetch('/api/cardapio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(() => {
    alert('✅ Misturas salvas com sucesso!');
  });
}

function limparCardapio() {
  const dia = document.getElementById('admin-dia').value;
  if(confirm(`Tem certeza que deseja limpar as misturas de ${dia}?`)) {
    fetch(`/api/cardapio/${dia}`, { method: 'DELETE' })
      .then(() => {
        document.getElementById('admin-mistura-a').value = '';
        document.getElementById('admin-mistura-b').value = '';
        alert('🗑️ Cardápio limpo!');
      });
  }
}

// ================= ABA RELATÓRIOS =================
let dadosGlobaisParaExcel = ''; // Guarda o HTML para exportar

async function gerarRelatorio() {
  const dia = document.getElementById('relatorio-dia').value;
  const area = document.getElementById('area-tabelas');
  area.innerHTML = '<p>Carregando relatórios...</p>';

  // Busca os nomes de quem escolheu e o cardápio do dia
  const resNomes = await fetch(`/api/relatorio/${dia}`);
  const escolhas = await resNomes.json();
  
  const resCardapio = await fetch(`/api/cardapio/${dia}`);
  const cardapio = await resCardapio.json();
  
  const nomeMisturaA = cardapio.mistura_a || 'Mistura A';
  const nomeMisturaB = cardapio.mistura_b || 'Mistura B';

  // Agrupa os dados por horário
  const porHorario = {};
  escolhas.forEach(esc => {
    if (!porHorario[esc.horario]) porHorario[esc.horario] = { A: [], B: [] };
    if (esc.opcao_mistura === 'A') porHorario[esc.horario].A.push(esc);
    if (esc.opcao_mistura === 'B') porHorario[esc.horario].B.push(esc);
  });

  let htmlFinal = '';

  // Desenha as caixas lado a lado para cada horário
  for (const horario in porHorario) {
    const listaA = porHorario[horario].A;
    const listaB = porHorario[horario].B;

    let linhasTabelaHTML = '';
    const maxLinhas = Math.max(listaA.length, listaB.length);

    for (let i = 0; i < maxLinhas; i++) {
      const pessoaA = listaA[i] || { nome_colaborador: '', setor: '' };
      const pessoaB = listaB[i] || { nome_colaborador: '', setor: '' };

      linhasTabelaHTML += `
        <tr>
          <td>${pessoaA.nome_colaborador}</td>
          <td>${pessoaA.setor}</td>
          <td>${pessoaB.nome_colaborador}</td>
          <td>${pessoaB.setor}</td>
        </tr>
      `;
    }

    htmlFinal += `
      <div class="bloco-horario" id="tabela-excel-${horario}">
        <div class="titulo-horario">HORÁRIO: ${horario}</div>
        <div class="duas-colunas">
          <!-- CAIXA MISTURA A -->
          <div class="coluna-mistura">
            <div class="header-mistura">${nomeMisturaA} (Total: ${listaA.length})</div>
            <table>
              <thead><tr><th>Nome</th><th>Setor</th></tr></thead>
              <tbody>
                ${listaA.map(p => `<tr><td>${p.nome_colaborador}</td><td>${p.setor}</td></tr>`).join('')}
                ${listaA.length === 0 ? '<tr><td colspan="2" style="text-align:center">Nenhum pedido</td></tr>' : ''}
              </tbody>
            </table>
          </div>
          <!-- CAIXA MISTURA B -->
          <div class="coluna-mistura">
            <div class="header-mistura">${nomeMisturaB} (Total: ${listaB.length})</div>
            <table>
              <thead><tr><th>Nome</th><th>Setor</th></tr></thead>
              <tbody>
                ${listaB.map(p => `<tr><td>${p.nome_colaborador}</td><td>${p.setor}</td></tr>`).join('')}
                ${listaB.length === 0 ? '<tr><td colspan="2" style="text-align:center">Nenhum pedido</td></tr>' : ''}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  if (htmlFinal === '') {
    area.innerHTML = '<p style="text-align:center; color:#777;">Nenhuma refeição marcada para este dia ainda.</p>';
  } else {
    area.innerHTML = htmlFinal;
  }
}


// Exportar para Excel
async function exportarExcel() {
  const dia = document.getElementById('relatorio-dia').value;
  
  // 1. Busca os dados novamente para ter certeza que está atualizado
  const resNomes = await fetch(`/api/relatorio/${dia}`);
  const escolhas = await resNomes.json();
  
  const resCardapio = await fetch(`/api/cardapio/${dia}`);
  const cardapio = await resCardapio.json();
  
  const nomeMisturaA = cardapio.mistura_a || 'Mistura A';
  const nomeMisturaB = cardapio.mistura_b || 'Mistura B';

  if (escolhas.length === 0) {
    alert("Nenhum pedido para exportar neste dia.");
    return;
  }

  // 2. Monta a tabela em formato "puro" que o Excel adora
  let tabelaHTML = `
    <table border="1">
      <thead>
        <tr>
          <th colspan="3" style="font-size: 18px; font-weight: bold; background-color: #d9e1f2;">Relatório de Pedidos - ${dia}</th>
        </tr>
      </thead>
      <tbody>
  `;

  // 3. Agrupa por Horário para separar bonitinho
  const porHorario = {};
  escolhas.forEach(esc => {
    if (!porHorario[esc.horario]) porHorario[esc.horario] = [];
    porHorario[esc.horario].push(esc);
  });

  // 4. Preenche as linhas da tabela separando pelos horários
  for (const horario in porHorario) {
    // Linha de Cabeçalho do Horário
    tabelaHTML += `
      <tr>
        <th colspan="3" style="background-color: #c6e0b4; font-weight: bold;">⏰ HORÁRIO: ${horario}</th>
      </tr>
      <tr>
        <th style="background-color: #f2f2f2;">Nome</th>
        <th style="background-color: #f2f2f2;">Setor</th>
        <th style="background-color: #f2f2f2;">Mistura Escolhida</th>
      </tr>
    `;

    // Linhas dos funcionários
    porHorario[horario].forEach(pessoa => {
      const nomeMistura = pessoa.opcao_mistura === 'A' ? nomeMisturaA : nomeMisturaB;
      tabelaHTML += `
        <tr>
          <td>${pessoa.nome_colaborador}</td>
          <td>${pessoa.setor}</td>
          <td>${nomeMistura}</td>
        </tr>
      `;
    });
    
    // Linha em branco para dar um respiro visual entre os horários
    tabelaHTML += `<tr><td colspan="3"></td></tr>`;
  }

  tabelaHTML += `</tbody></table>`;

  // 5. Monta o arquivo e força o download
  const excelFormat = `
    <html xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head>
        <meta charset="utf-8">
      </head>
      <body>
        ${tabelaHTML}
      </body>
    </html>
  `;

  const blob = new Blob([excelFormat], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Relatorio_Refeitorio_${dia}.xls`;
  a.click();
}

// Iniciar carregando a aba padrão
window.onload = carregarCardapioAdmin;

// ================= RESETAR REGISTROS DE FUNCIONÁRIOS =================
function limparRegistrosDoDia() {
  const dia = document.getElementById('relatorio-dia').value;
  
  if (confirm(`⚠️ ATENÇÃO: Tem certeza que deseja apagar TODOS os pedidos de almoço/janta registrados para ${dia}? Esta ação não pode ser desfeita.`)) {
    fetch(`/api/relatorio/${dia}`, { method: 'DELETE' })
      .then(res => res.json())
      .then(data => {
        if (data.sucesso) {
          alert(`✅ Todos os registros de ${dia} foram apagados com sucesso!`);
          gerarRelatorio(); // Recarrega a tela para mostrar vazio
        } else {
          alert('❌ Erro ao apagar os registros.');
        }
      })
      .catch(err => {
        console.error("Erro:", err);
        alert('❌ Erro de conexão com o servidor.');
      });
  }
}
