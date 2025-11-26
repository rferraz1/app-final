import express from "express";
import cors from "cors";
import pkg from "pg";

const { Pool } = pkg;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const PORT = process.env.PORT || 4000;
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL não definido. Configure no ambiente do servidor.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

async function ensureTables() {
  const client = await pool.connect();
  try {
    // habilita extensões de UUID (compatível com Neon/Render)
    await client.query(`create extension if not exists "pgcrypto";`);
    await client.query(`create extension if not exists "uuid-ossp";`);
    await client.query(`
      create table if not exists alunos (
        id uuid primary key default gen_random_uuid(),
        nome text unique not null,
        created_at timestamptz default now()
      );
      create table if not exists treinos (
        id uuid primary key default gen_random_uuid(),
        aluno_id uuid references alunos(id),
        aluno_nome text,
        treino jsonb not null,
        created_at timestamptz default now()
      );
    `);
  } finally {
    client.release();
  }
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/alunos", async (req, res) => {
  const nome = (req.body?.nome || "").trim();
  if (!nome) return res.status(400).json({ error: "Nome obrigatório" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query(
      "select id, nome, created_at from alunos where nome = $1 limit 1",
      [nome]
    );
    if (found.rows.length) {
      await client.query("COMMIT");
      return res.json({ ok: true, data: found.rows[0], existed: true });
    }
    const created = await client.query(
      "insert into alunos (nome) values ($1) returning id, nome, created_at",
      [nome]
    );
    await client.query("COMMIT");
    res.json({ ok: true, data: created.rows[0], existed: false });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Erro ao salvar aluno" });
  } finally {
    client.release();
  }
});

app.get("/alunos", async (_req, res) => {
  try {
    const rows = await pool.query(
      "select id, nome, created_at from alunos order by created_at desc"
    );
    res.json({ ok: true, data: rows.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao listar alunos" });
  }
});

app.put("/alunos/:id", async (req, res) => {
  const nome = (req.body?.nome || "").trim();
  const { id } = req.params;
  if (!nome) return res.status(400).json({ error: "Nome obrigatório" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // evitar duplicados
    const dup = await client.query(
      "select id from alunos where nome = $1 and id <> $2 limit 1",
      [nome, id]
    );
    if (dup.rows.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Já existe aluno com esse nome" });
    }
    const updated = await client.query(
      "update alunos set nome = $1 where id = $2 returning id, nome, created_at",
      [nome, id]
    );
    await client.query("COMMIT");
    if (!updated.rows.length)
      return res.status(404).json({ error: "Aluno não encontrado" });
    res.json({ ok: true, data: updated.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Erro ao atualizar aluno" });
  } finally {
    client.release();
  }
});

app.delete("/alunos/:id", async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("delete from treinos where aluno_id = $1", [id]);
    const del = await client.query("delete from alunos where id = $1", [id]);
    await client.query("COMMIT");
    if (del.rowCount === 0)
      return res.status(404).json({ error: "Aluno não encontrado" });
    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Erro ao excluir aluno" });
  } finally {
    client.release();
  }
});

app.post("/treinos", async (req, res) => {
  const { aluno, treino } = req.body || {};
  const nome = (aluno || "").trim();
  if (!nome || !Array.isArray(treino)) {
    return res
      .status(400)
      .json({ error: "Envie { aluno: string, treino: [] }" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query(
      "select id, nome from alunos where nome = $1 limit 1",
      [nome]
    );
    const alunoRow = found.rows[0]
      ? found.rows[0]
      : (
          await client.query(
            "insert into alunos (nome) values ($1) returning id, nome",
            [nome]
          )
        ).rows[0];

    const inserted = await client.query(
      "insert into treinos (aluno_id, aluno_nome, treino) values ($1, $2, $3) returning id, aluno_id, aluno_nome, treino, created_at",
      [alunoRow.id, alunoRow.nome, treino]
    );
    await client.query("COMMIT");
    res.json({ ok: true, data: inserted.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Erro ao salvar treino:", err);
    res.status(500).json({ error: err.message || "Erro ao salvar treino" });
  } finally {
    client.release();
  }
});

app.get("/treinos", async (req, res) => {
  const aluno = req.query?.aluno;
  const params = [];
  let where = "";
  if (aluno) {
    params.push(aluno);
    where = "where aluno_nome = $1";
  }
  try {
    const rows = await pool.query(
      `select id, aluno_id, aluno_nome, treino, created_at from treinos ${where} order by created_at desc`,
      params
    );
    res.json({ ok: true, data: rows.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao listar treinos" });
  }
});

// IA: gerar treino a partir de prompt
app.post("/ia/gerar-treino", async (req, res) => {
  if (!OPENAI_API_KEY) {
    return res
      .status(400)
      .json({ error: "OPENAI_API_KEY não configurada no servidor." });
  }

  const prompt = (req.body?.prompt || "").trim();
  if (!prompt) {
    return res.status(400).json({ error: "Envie o prompt no corpo da requisição." });
  }

  try {
    const body = {
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content:
            "Você é um gerador de treinos. Responda APENAS com JSON no formato {\"treino\": [{\"nome\":\"...\",\"grupo\":\"...\",\"reps\":\"...\",\"carga\":\"...\",\"conjugado\":false}]}. Máx 12 exercícios. Use grupos comuns (Peito, Costas, Bíceps, Tríceps, Pernas, Ombro, Core, Cardio). Inclua reps/carga sugeridas quando fizer sentido. Campo 'conjugado' é booleano e indica se o exercício deve ser conjugado/sequencial com o anterior.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.4,
      max_tokens: 400,
      response_format: { type: "json_object" },
    };

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("OpenAI error:", text);
      return res
        .status(500)
        .json({ error: "Falha ao chamar o modelo de IA." });
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content || "{}";
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      console.error("Erro ao parsear resposta da IA:", content);
      return res
        .status(500)
        .json({ error: "Resposta da IA em formato inesperado." });
    }

    const treino = Array.isArray(parsed.treino) ? parsed.treino : [];
    res.json({ ok: true, treino });
  } catch (err) {
    console.error("Erro na rota /ia/gerar-treino:", err);
    res.status(500).json({ error: "Erro ao gerar treino com IA." });
  }
});

ensureTables()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`API rodando na porta ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Erro ao preparar tabelas:", err);
    process.exit(1);
  });
