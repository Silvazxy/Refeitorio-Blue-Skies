const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

const dbFolder = path.join(__dirname, 'database');
if (!fs.existsSync(dbFolder)) {
  fs.mkdirSync(dbFolder);
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const dbPath = path.join(dbFolder, 'refeitorio.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erro ao conectar ao SQLite:', err.message);
  } else {
    console.log('Conectado ao banco de dados SQLite com sucesso.');
    inicializarBanco();
  }
});

function inicializarBanco() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS setores (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL)`);

    db.get(`SELECT COUNT(*) as total FROM setores`, (err, row) => {
      if (row && row.total === 0) {
        const setoresIniciais = ['Embalagem de Manga', 'Campo / Colheita', 'Qualidade', 'Controladoria', 'RH', 'Financeiro'];
        const stmt = db.prepare(`INSERT INTO setores (nome) VALUES (?)`);
        setoresIniciais.forEach(s => stmt.run(s));
        stmt.finalize();
      }
    });

    db.run(`CREATE TABLE IF NOT EXISTS horarios (id INTEGER PRIMARY KEY AUTOINCREMENT, horario TEXT NOT NULL)`);

    db.get(`SELECT COUNT(*) as total FROM horarios`, (err, row) => {
      if (row && row.total === 0) {
        const horariosIniciais = ['11:30', '11:50', '12:10', '12:30', '18:00', '18:30'];
        const stmt = db.prepare(`INSERT INTO horarios (horario) VALUES (?)`);
        horariosIniciais.forEach(h => stmt.run(h));
        stmt.finalize();
      }
    });

    db.run(`CREATE TABLE IF NOT EXISTS cardapios (id INTEGER PRIMARY KEY AUTOINCREMENT, dia_semana TEXT NOT NULL UNIQUE, mistura_a TEXT, mistura_b TEXT)`);

    db.run(`CREATE TABLE IF NOT EXISTS escolhas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data TEXT NOT NULL,
      dia_semana TEXT NOT NULL,
      nome_colaborador TEXT NOT NULL,
      setor_id INTEGER,
      horario_id INTEGER,
      opcao_mistura TEXT NOT NULL,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (setor_id) REFERENCES setores(id),
      FOREIGN KEY (horario_id) REFERENCES horarios(id)
    )`);
  });
}

// --- ROTAS DA API ---

// 1. Buscar Setores e Horários para os Dropdowns
app.get('/api/auxiliares', (req, res) => {
  db.all(`SELECT * FROM setores ORDER BY nome ASC`, [], (err, setores) => {
    if (err) return res.status(500).json({ erro: err.message });
    db.all(`SELECT * FROM horarios ORDER BY horario ASC`, [], (err, horarios) => {
      if (err) return res.status(500).json({ erro: err.message });
      res.json({ setores, horarios });
    });
  });
});

// 2. Buscar Cardápio do Dia
app.get('/api/cardapio/:dia', (req, res) => {
  const { dia } = req.params;
  db.get(`SELECT * FROM cardapios WHERE dia_semana = ?`, [dia], (err, row) => {
    if (err) return res.status(500).json({ erro: err.message });
    res.json(row || { mistura_a: 'Opção A', mistura_b: 'Opção B' });
  });
});

// 3. Salvar/Atualizar Cardápio (Admin)
app.post('/api/cardapio', (req, res) => {
  const { dia_semana, mistura_a, mistura_b } = req.body;
  const sql = `INSERT INTO cardapios (dia_semana, mistura_a, mistura_b) 
               VALUES (?, ?, ?) 
               ON CONFLICT(dia_semana) DO UPDATE SET mistura_a = ?, mistura_b = ?`;
  db.run(sql, [dia_semana, mistura_a, mistura_b, mistura_a, mistura_b], function(err) {
    if (err) return res.status(500).json({ erro: err.message });
    res.json({ sucesso: true });
  });
});

// 4. Limpar Cardápio do Dia (Admin)
app.delete('/api/cardapio/:dia', (req, res) => {
  const { dia } = req.params;
  db.run(`DELETE FROM cardapios WHERE dia_semana = ?`, [dia], function(err) {
    if (err) return res.status(500).json({ erro: err.message });
    res.json({ sucesso: true });
  });
});

// 5. Salvar Escolha do Colaborador
app.post('/api/escolhas', (req, res) => {
  const { dia_semana, nome_colaborador, setor_id, horario_id, opcao_mistura } = req.body;
  const dataHoje = new Date().toISOString().split('T')[0];

  const sql = `INSERT INTO escolhas (data, dia_semana, nome_colaborador, setor_id, horario_id, opcao_mistura)
               VALUES (?, ?, ?, ?, ?, ?)`;
  db.run(sql, [dataHoje, dia_semana, nome_colaborador, setor_id, horario_id, opcao_mistura], function(err) {
    if (err) return res.status(500).json({ erro: err.message });
    res.json({ sucesso: true, id: this.lastID });
  });
});

// 6. Relatório Ordenado (Admin) - Separa por Horário e Nome A-Z
app.get('/api/relatorio/:dia', (req, res) => {
  const { dia } = req.params;
  const sql = `
    SELECT 
      e.id,
      e.nome_colaborador,
      e.opcao_mistura,
      s.nome AS setor,
      h.horario
    FROM escolhas e
    JOIN setores s ON e.setor_id = s.id
    JOIN horarios h ON e.horario_id = h.id
    WHERE e.dia_semana = ?
    ORDER BY h.horario ASC, e.nome_colaborador ASC
  `;
  db.all(sql, [dia], (err, rows) => {
    if (err) return res.status(500).json({ erro: err.message });
    res.json(rows);
  });
});

//Limpar todos os registros de colaboradores de um dia específico 
app.delete('/api/relatorio/:dia', (req, res) => {
  const { dia } = req.params;
  
  // Apaga as escolhas daquele dia específico
  db.run(`DELETE FROM escolhas WHERE dia_semana = ?`, [dia], function(err) {
    if (err) return res.status(500).json({ erro: err.message });
    res.json({ sucesso: true, apagados: this.changes });
  });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});