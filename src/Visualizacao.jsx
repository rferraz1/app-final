import React, { useState } from "react";
import { salvarTreino as salvarTreinoFB, salvarAluno } from "./firebase";

export default function Visualizacao({
  selecionados = [],
  nomeAluno = "",
  alunoId = "",
  voltar = () => {},
  onSalvar = () => {},
  editarReps = () => {},
  editarCarga = () => {}
}) {
  const [obs, setObs] = useState(selecionados.map(() => ""));
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const GIFS_REMOTE_BASE = "https://pub-0173b7fd04854be5b34e1727d5fa1798.r2.dev";

  // ==========================================================
  // 🔥 GERA O HTML FINAL PARA DOWNLOAD (usa URL remota da GIF)
  // ==========================================================
  const gerarHTML = async () => {
    const absolutizar = (url) => {
      if (!url) return "";
      if (/^https?:\/\//i.test(url)) return url;
      // GIFs antigos podem ter ficado salvos como "/gifs/...". Como o arquivo
      // baixado é aberto em file://, convertemos para a URL pública para manter a animação.
      if (url.startsWith("/gifs/")) {
        return `${GIFS_REMOTE_BASE}${url}`;
      }
      try {
        return new URL(url, window.location.origin).toString();
      } catch {
        return url;
      }
    };

    const dataUrlCache = {};

    const baixarComoDataUrl = async (exercicio) => {
      // 1) tenta o caminho local (igual ao build antigo: /gifs/grupo/arquivo.gif)
      // 2) se falhar, usa a URL remota original
      // 3) sempre converte para dataURL para ficar offline e animado
      const caminhoLocal = (() => {
        // se já vier um caminho /gifs, respeita
        if (exercicio.file?.startsWith("/gifs/")) return exercicio.file;
        // tenta transformar URL remota do R2 em caminho local
        try {
          const u = new URL(exercicio.file);
          if (u.pathname.startsWith("/gifs/")) {
            return decodeURIComponent(u.pathname);
          }
        } catch (_) {
          // não é URL absoluta, ignora
        }
        // fallback: monta pelo grupo/nome do arquivo informado
        return `/gifs/${encodeURIComponent(exercicio.grupo)}/${encodeURIComponent(
          exercicio.file
        )}`;
      })();

      if (dataUrlCache[caminhoLocal]) return dataUrlCache[caminhoLocal];

      // tenta primeiro a URL original (R2), depois o caminho local
      const fontes = [exercicio.file, caminhoLocal].filter(Boolean);

      for (const fonte of fontes) {
        try {
          const resp = await fetch(fonte, { mode: "cors", referrerPolicy: "no-referrer" });
          if (!resp.ok) continue;
          const blob = await resp.blob();
          const dataUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result || fonte);
            reader.onerror = () => resolve(fonte);
            reader.readAsDataURL(blob); // mantém animação do GIF
          });
          dataUrlCache[caminhoLocal] = dataUrl;
          return dataUrl;
        } catch (err) {
          console.warn("Falha ao embutir GIF:", fonte, err);
        }
      }

      return exercicio.file || caminhoLocal; // último recurso
    };

    const blocos = await Promise.all(
      selecionados.map(async (ex, idx) => {
        const inline = await baixarComoDataUrl(ex); // data URL animada
        const urlAbs = absolutizar(ex.file); // fallback remoto em caso extremo

        return `
          <section style="margin-bottom:40px;text-align:center;">
            <div style="display:flex;justify-content:center;align-items:center;gap:12px;margin-bottom:8px;">
              <div style="
                width:32px;height:32px;border-radius:50%;
                background:#e0e7ff;color:#4338ca;font-weight:700;
                display:flex;justify-content:center;align-items:center;
              ">
                ${idx + 1}
              </div>

              <h3 style="font-size:22px;font-weight:600;">
                ${ex.nome}
              </h3>
            </div>

            ${
              obs[idx]
                ? `<p style="font-size:14px;color:#555;margin-bottom:16px;">${obs[idx]}</p>`
                : ""
            }

            <img 
              src="${inline}" 
              data-fallback="${urlAbs}"
              onerror="if(this.dataset.fallback && this.src!==this.dataset.fallback){this.src=this.dataset.fallback;}" 
              style="
                width:290px;height:290px;object-fit:contain;
                border-radius:14px;padding:10px;
                background:#fafafa;border:1px solid #eee;"
            />
          </section>
        `;
      })
    );
    const bloco = blocos.join("\n");

    const finalHTML = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Treino - ${nomeAluno}</title>
<style>
  body {
    background:white;
    padding:30px;
    max-width:900px;
    margin:auto;
    font-family:Arial, sans-serif;
  }
  h1 {
    text-align:center;
    font-size:28px;
    margin-bottom:30px;
    font-weight:600;
  }
</style>
</head>
<body>

<h1>Treino de ${nomeAluno}</h1>

${bloco}

<footer style="text-align:center;margin-top:40px;font-size:12px;color:#aaa;">
  Treino criado por Rodolfo Ferraz
</footer>

</body>
</html>
    `;

    // força download direto para evitar bloqueio de popup
    try {
      const blob = new Blob([finalHTML], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Treino-${nomeAluno || "Aluno"}.html`;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 0);
    } catch (err) {
      console.error("Falha no download direto, usando fallback:", err);
      const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(
        finalHTML
      )}`;
      window.location.href = dataUrl;
    }
  };

  // ==========================================================
  // 🔥 SALVA NO BACKEND (Netlify Function + Supabase REST)
  // ==========================================================
  const salvarTreino = async () => {
    if (!nomeAluno.trim()) {
      setSaveMsg("Informe o nome do aluno antes de salvar.");
      return;
    }
    if (!selecionados.length) {
      setSaveMsg("Adicione exercícios antes de salvar.");
      return;
    }
    setSaving(true);
    setSaveMsg("");
    try {
      let alunoTargetId = alunoId;
      if (!alunoTargetId) {
        const respAluno = await salvarAluno(nomeAluno);
        alunoTargetId = respAluno.id;
      }

      const treinoSalvo = selecionados.map((ex, idx) => ({
        ...ex,
        observacao: obs[idx] || "",
      }));

      await salvarTreinoFB(
        alunoTargetId,
        nomeAluno,
        treinoSalvo
      );

      setSaveMsg("Treino salvo com sucesso ✅");
      await Promise.resolve(onSalvar(alunoTargetId, nomeAluno, treinoSalvo));
    } catch (err) {
      console.error(err);
      setSaveMsg("Erro ao salvar treino. Verifique configuração do backend.");
    } finally {
      setSaving(false);
    }
  };

  // ==========================================================
  // 🔥 3 — VISUALIZAÇÃO NA TELA
  // ==========================================================
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50 py-10">
      <div className="max-w-4xl mx-auto bg-white/85 backdrop-blur border border-gray-200 shadow-sm rounded-3xl p-8">
        <div className="text-center mb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
            Treino personalizado
          </p>
          <h2 className="text-3xl font-semibold text-gray-900">
            {nomeAluno || "Aluno"}
          </h2>
        </div>

        <div className="space-y-6">
          {selecionados.map((ex, idx) => (
            <div
              key={ex.id}
              className="p-5 border border-gray-200 rounded-2xl shadow-md bg-white/90"
            >
              <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 flex items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-bold">
                  {idx + 1}
                </div>

                <div className="text-lg font-semibold text-gray-900">{ex.nome}</div>
                {ex.conjugado && (
                  <span className="text-xs px-2 py-1 rounded-lg bg-purple-100 text-purple-700 border border-purple-200">
                    Conjugado
                  </span>
                )}
              </div>

                <input
                  type="text"
                  defaultValue={ex.reps || "3x10 rep"}
                  onChange={(e) => editarReps(idx, e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-28 text-center focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500"
                />
              </div>

              <textarea
                placeholder="Observações para o aluno..."
                value={obs[idx]}
                onChange={(e) => {
                  const novas = [...obs];
                  novas[idx] = e.target.value;
                  setObs(novas);
                }}
                className="w-full border border-gray-200 rounded-xl p-3 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500"
                rows={2}
              />

              <div className="flex justify-center">
                <img
                  src={ex.file}
                  alt={ex.nome}
                  className="w-28 h-28 object-contain border border-gray-200 rounded-xl bg-gray-50"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-center gap-4 mt-8">
          <button
            onClick={voltar}
            className="px-6 py-3 text-sm bg-gray-100 border border-gray-200 rounded-xl hover:bg-gray-200 transition"
          >
            Voltar
          </button>

          <button
            onClick={salvarTreino}
            disabled={saving || !selecionados.length}
            className="px-6 py-3 text-sm bg-gray-900 text-white rounded-xl shadow-sm hover:bg-black transition disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar treino"}
          </button>

          <button
            onClick={gerarHTML}
            className="px-6 py-3 text-sm bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/15 hover:bg-blue-700 transition"
          >
            Exportar treino
          </button>
        </div>

        {saveMsg && (
          <p className="text-center text-sm text-gray-600 mt-4">{saveMsg}</p>
        )}
      </div>
    </div>
  );
}
