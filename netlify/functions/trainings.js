const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const TABLE_TREINOS = process.env.SUPABASE_TABLE || "treinos";
const TABLE_ALUNOS = process.env.SUPABASE_STUDENTS_TABLE || "alunos";

const json = (status, body) => ({
  statusCode: status,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  },
  body: JSON.stringify(body),
});

const sbFetch = (path, options = {}) =>
  fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      ...(options.headers || {}),
    },
  });

const ensureAluno = async (nome) => {
  // tenta achar
  const find = await sbFetch(
    `/rest/v1/${TABLE_ALUNOS}?nome=eq.${encodeURIComponent(nome)}&select=id,nome&limit=1`
  );
  if (!find.ok) throw new Error(await find.text());
  const rows = await find.json();
  if (rows.length) return rows[0];

  // cria
  const create = await sbFetch(`/rest/v1/${TABLE_ALUNOS}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ nome }),
  });
  if (!create.ok) throw new Error(await create.text());
  const created = await create.json();
  return created[0];
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return json(200, { ok: true });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return json(500, {
      error: "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars",
    });
  }

  if (event.httpMethod === "POST") {
    try {
      const payload = JSON.parse(event.body || "{}");
      const { aluno, treino } = payload;

      if (!aluno || !treino || !Array.isArray(treino)) {
        return json(400, {
          error: "Payload inválido. Envie { aluno: string, treino: [] }",
        });
      }

      const alunoRow = await ensureAluno(aluno);

      const res = await sbFetch(`/rest/v1/${TABLE_TREINOS}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          aluno_id: alunoRow.id,
          aluno_nome: alunoRow.nome,
          treino,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        return json(res.status, { error: errText });
      }

      const data = await res.json();
      return json(200, { ok: true, data });
    } catch (err) {
      return json(500, { error: err.message || "Erro ao salvar" });
    }
  }

  if (event.httpMethod === "GET") {
    const aluno = event.queryStringParameters?.aluno;
    const filter = aluno ? `&aluno_nome=eq.${encodeURIComponent(aluno)}` : "";

    const res = await sbFetch(
      `/rest/v1/${TABLE_TREINOS}?select=id,aluno_id,aluno_nome,treino,created_at&order=created_at.desc${filter}`
    );

    if (!res.ok) {
      const errText = await res.text();
      return json(res.status, { error: errText });
    }

    const data = await res.json();
    return json(200, { ok: true, data });
  }

  return json(405, { error: "Method not allowed" });
};
