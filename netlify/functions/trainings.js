const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_TABLE = process.env.SUPABASE_TABLE || "treinos";

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

      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}`,
        {
          method: "POST",
          headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            aluno,
            treino,
          }),
        }
      );

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
    const filter = aluno ? `&aluno=eq.${encodeURIComponent(aluno)}` : "";

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?select=*&order=created_at.desc${filter}`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      }
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
