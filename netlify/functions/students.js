const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
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

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return json(500, { error: "Missing SUPABASE env vars" });
  }

  if (event.httpMethod === "POST") {
    try {
      const payload = JSON.parse(event.body || "{}");
      const nome = (payload.nome || "").trim();
      if (!nome) return json(400, { error: "Nome obrigatório" });

      const find = await sbFetch(
        `/rest/v1/${TABLE_ALUNOS}?nome=eq.${encodeURIComponent(nome)}&select=id,nome&limit=1`
      );
      if (!find.ok) throw new Error(await find.text());
      const rows = await find.json();
      if (rows.length) return json(200, { ok: true, data: rows[0], existed: true });

      const create = await sbFetch(`/rest/v1/${TABLE_ALUNOS}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({ nome }),
      });
      if (!create.ok) throw new Error(await create.text());
      const data = await create.json();
      return json(200, { ok: true, data: data[0], existed: false });
    } catch (err) {
      return json(500, { error: err.message || "Erro ao salvar aluno" });
    }
  }

  if (event.httpMethod === "GET") {
    const res = await sbFetch(
      `/rest/v1/${TABLE_ALUNOS}?select=id,nome,created_at&order=created_at.desc`
    );
    if (!res.ok) return json(res.status, { error: await res.text() });
    const data = await res.json();
    return json(200, { ok: true, data });
  }

  return json(405, { error: "Method not allowed" });
};
