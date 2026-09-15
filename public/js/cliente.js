const urlParams = new URLSearchParams(window.location.search);
const diaSelecionado = urlParams.get('dia');
const opcaoSelecionada = urlParams.get('opcao');

// Executa ao carregar a página mistura.html
if (window.location.pathname.includes('mistura.html')) {
  document.getElementById('titulo-dia').innerText = `Opções para ${diaSelecionado}`;
  
  fetch(`/api/cardapio/${diaSelecionado}`)
    .then(res => res.json())
    .then(data => {
      document.getElementById('btn-opcao-a').innerText = data.mistura_a || 'Opção A';
      document.getElementById('btn-opcao-b').innerText = data.mistura_b || 'Opção B';
    });
}

function selecionarMistura(opcao) {
  window.location.href = `identificacao.html?dia=${diaSelecionado}&opcao=${opcao}`;
}

// Executa ao carregar a página identificacao.html
if (window.location.pathname.includes('identificacao.html')) {
  fetch('/api/auxiliares')
    .then(res => res.json())
    .then(data => {
      const selectSetor = document.getElementById('setor');
      const selectHorario = document.getElementById('horario');

      selectSetor.innerHTML = '<option value="">Selecione seu setor...</option>';
      data.setores.forEach(s => {
        selectSetor.innerHTML += `<option value="${s.id}">${s.nome}</option>`;
      });

      selectHorario.innerHTML = '<option value="">Selecione seu horário...</option>';
      data.horarios.forEach(h => {
        selectHorario.innerHTML += `<option value="${h.id}">${h.horario}</option>`;
      });
    });
}

function salvarEscolha(event) {
  event.preventDefault();

  const payload = {
    dia_semana: diaSelecionado,
    opcao_mistura: opcaoSelecionada,
    nome_colaborador: document.getElementById('nome').value.trim(),
    setor_id: document.getElementById('setor').value,
    horario_id: document.getElementById('horario').value
  };

  fetch('/api/escolhas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  .then(res => res.json())
  .then(data => {
    if (data.sucesso) {
      window.location.href = 'confirmacao.html';
    } else {
      alert('Erro ao salvar escolha: ' + data.erro);
    }
  });
}