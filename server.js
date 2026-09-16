const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// CONEXÃO COM O MONGODB
const mongoURI = process.env.MONGO_URI; 
mongoose.connect(mongoURI)
  .then(() => {
    console.log('Conectado ao MongoDB com sucesso!');
    inicializarDados();
  })
  .catch(err => console.error('Erro ao conectar ao MongoDB:', err));

// SCHEMAS (Estrutura do Banco)
const SetorSchema = new mongoose.Schema({ nome: String });
const Setor = mongoose.model('Setor', SetorSchema);

const HorarioSchema = new mongoose.Schema({ horario: String });
const Horario = mongoose.model('Horario', HorarioSchema);

const CardapioSchema = new mongoose.Schema({
  dia_semana: { type: String, unique: true },
  mistura_a: String,
  mistura_b: String
});
const Cardapio = mongoose.model('Cardapio', CardapioSchema);

const EscolhaSchema = new mongoose.Schema({
  data: String,
  dia_semana: String,
  nome_colaborador: String,
  setor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Setor' },
  horario_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Horario' },
  opcao_mistura: String,
  criado_em: { type: Date, default: Date.now }
});
const Escolha = mongoose.model('Escolha', EscolhaSchema);

// INICIALIZAR DADOS PADRÃO (Se não existirem)
async function inicializarDados() {
  const setores = await Setor.countDocuments();
  if (setores === 0) {
    await Setor.insertMany([
      { nome: 'Embalagem de Manga' }, { nome: 'Campo / Colheita' },
      { nome: 'Qualidade' }, { nome: 'Controladoria' }, { nome: 'RH' }, { nome: 'Financeiro' }
    ]);
  }
  const horarios = await Horario.countDocuments();
  if (horarios === 0) {
    await Horario.insertMany([
      { horario: '11:30' }, { horario: '11:50' }, { horario: '12:10' },
      { horario: '12:30' }, { horario: '18:00' }, { horario: '18:30' }
    ]);
  }
}

// --- ROTAS DA API ---

app.get('/api/auxiliares', async (req, res) => {
  try {
    const setores = await Setor.find().sort({ nome: 1 }).lean();
    const horarios = await Horario.find().sort({ horario: 1 }).lean();
    // Transforma _id em id para o frontend entender
    res.json({
      setores: setores.map(s => ({ id: s._id, nome: s.nome })),
      horarios: horarios.map(h => ({ id: h._id, horario: h.horario }))
    });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.get('/api/cardapio/:dia', async (req, res) => {
  try {
    const cardapio = await Cardapio.findOne({ dia_semana: req.params.dia });
    res.json(cardapio || { mistura_a: 'Opção A', mistura_b: 'Opção B' });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.post('/api/cardapio', async (req, res) => {
  try {
    const { dia_semana, mistura_a, mistura_b } = req.body;
    await Cardapio.findOneAndUpdate(
      { dia_semana },
      { mistura_a, mistura_b },
      { upsert: true, new: true }
    );
    res.json({ sucesso: true });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.delete('/api/cardapio/:dia', async (req, res) => {
  try {
    await Cardapio.findOneAndDelete({ dia_semana: req.params.dia });
    res.json({ sucesso: true });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.post('/api/escolhas', async (req, res) => {
  try {
    const { dia_semana, nome_colaborador, setor_id, horario_id, opcao_mistura } = req.body;
    const dataHoje = new Date().toISOString().split('T')[0];
    
    const novaEscolha = await Escolha.create({
      data: dataHoje, dia_semana, nome_colaborador, setor_id, horario_id, opcao_mistura
    });
    res.json({ sucesso: true, id: novaEscolha._id });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.get('/api/relatorio/:dia', async (req, res) => {
  try {
    const escolhas = await Escolha.find({ dia_semana: req.params.dia })
      .populate('setor_id')
      .populate('horario_id')
      .lean();

    const formatado = escolhas.map(e => ({
      id: e._id,
      nome_colaborador: e.nome_colaborador,
      opcao_mistura: e.opcao_mistura,
      setor: e.setor_id ? e.setor_id.nome : 'Sem setor',
      horario: e.horario_id ? e.horario_id.horario : 'Sem horário'
    }));

    // Ordena por horário e depois por nome
    formatado.sort((a, b) => {
      if (a.horario === b.horario) return a.nome_colaborador.localeCompare(b.nome_colaborador);
      return a.horario.localeCompare(b.horario);
    });

    res.json(formatado);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.delete('/api/relatorio/:dia', async (req, res) => {
  try {
    const result = await Escolha.deleteMany({ dia_semana: req.params.dia });
    res.json({ sucesso: true, apagados: result.deletedCount });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});