import React, { useEffect, useMemo, useState } from "react";
import Visualizacao from "./Visualizacao.jsx";
import {
  listarAlunos,
  listarTreinos,
  renomearAluno,
  excluirAluno,
  salvarAluno,
} from "./firebase";

export default function App() {
  const [busca, setBusca] = useState("");
  const [gifsMap, setGifsMap] = useState({});
  const [resultados, setResultados] = useState([]);
  const [selecionados, setSelecionados] = useState([]);
  const [visualizando, setVisualizando] = useState(false);
  const [nomeAluno, setNomeAluno] = useState("");
  const [salvos, setSalvos] = useState([]);
  const [carregandoSalvos, setCarregandoSalvos] = useState(false);
  const [erroSalvos, setErroSalvos] = useState("");
  const [salvandoAluno, setSalvandoAluno] = useState(false);
  const [msgAluno, setMsgAluno] = useState("");
  const [alunos, setAlunos] = useState([]);
  const [carregandoAlunos, setCarregandoAlunos] = useState(false);
  const [erroAlunos, setErroAlunos] = useState("");
  const [alunoSelecionadoId, setAlunoSelecionadoId] = useState("");
  const [treinosExpandidos, setTreinosExpandidos] = useState({});
  const [destinoTreino, setDestinoTreino] = useState({});
  const [promptIA, setPromptIA] = useState("");
  const [gerandoIA, setGerandoIA] = useState(false);
  const [erroIA, setErroIA] = useState("");

  // REMOVE ACENTOS / NORMALIZA
  function normalizar(texto) {
    return texto
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[_-]/g, " ")
      .toLowerCase();
  }

  const procurarGif = (nome, grupo = "") => {
    const alvo = normalizar(nome || "");
    // tenta dentro do grupo indicado
    if (grupo && gifsMap[grupo]) {
      const hit = gifsMap[grupo].find(
        (ex) => normalizar(ex.nome) === alvo || normalizar(ex.nome).includes(alvo)
      );
      if (hit) return hit.url;
    }
    // busca em todos
    for (const lista of Object.values(gifsMap)) {
      const hit = lista.find(
        (ex) => normalizar(ex.nome) === alvo || normalizar(ex.nome).includes(alvo)
      );
      if (hit) return hit.url;
    }
    // fallback: primeiro gif do grupo, senão algum genérico
    if (grupo && gifsMap[grupo]?.[0]) return gifsMap[grupo][0].url;
    const qualquerGrupo = Object.values(gifsMap)[0];
    return qualquerGrupo?.[0]?.url || "";
  };

  // CARREGA O ARQUIVO DE GIFS (usa caminhos locais /gifs/... para permitir embed offline)
  useEffect(() => {
    fetch("/gifs.json")
      .then((res) => res.json())
      .then((data) => setGifsMap(data))
      .catch((err) => console.error("Erro carregando gifs.json:", err));
  }, []);

  // FILTRO DE BUSCA — USA O NOME NORMALIZADO JÁ LIMPO DO JSON
  useEffect(() => {
    if (!busca.trim()) {
      setResultados([]);
      return;
    }

    const q = normalizar(busca);
    const out = [];

    Object.entries(gifsMap).forEach(([grupo, lista]) => {
      lista.forEach((ex) => {
        const nomeNormalizado = normalizar(ex.nome);

        if (nomeNormalizado.includes(q)) {
          out.push({
            key: `${grupo}::${ex.nome}`,
            grupo,
            file: ex.url,
            nome: ex.nome,
          });
        }
      });
    });

    setResultados(out);
  }, [busca, gifsMap]);

  // AÇÕES
  const adicionar = (item) => {
    const id = `${item.grupo}::${item.file}`;
    if (selecionados.find((s) => s.id === id)) return;

    setSelecionados((p) => [
      ...p,
      {
        id,
        grupo: item.grupo,
        file: item.file,
        nome: item.nome,
        reps: "",
        carga: "",
        conjugado: false,
      },
    ]);
  };

  const remover = (id) =>
    setSelecionados((p) => p.filter((s) => s.id !== id));

  const editarNome = (id, novo) =>
    setSelecionados((p) =>
      p.map((s) => (s.id === id ? { ...s, nome: novo } : s))
    );

  const editarReps = (id, novo) =>
    setSelecionados((p) =>
      p.map((s) => (s.id === id ? { ...s, reps: novo } : s))
    );

  const editarCarga = (id, novo) =>
    setSelecionados((p) =>
      p.map((s) => (s.id === id ? { ...s, carga: novo } : s))
    );

  const toggleConjugado = (id) =>
    setSelecionados((p) =>
      p.map((s) => (s.id === id ? { ...s, conjugado: !s.conjugado } : s))
    );

  const mover = (index, dir) => {
    setSelecionados((p) => {
      const c = [...p];
      const alvo = index + dir;
      if (alvo < 0 || alvo >= c.length) return c;
      [c[index], c[alvo]] = [c[alvo], c[index]];
      return c;
    });
  };

  // CARREGA ALUNOS E TREINOS (Firestore)
  const carregarAlunos = async () => {
    setCarregandoAlunos(true);
    setErroAlunos("");
    try {
      const lista = await listarAlunos();
      setAlunos(lista);
    } catch (err) {
      console.error(err);
      setErroAlunos("Não foi possível carregar alunos.");
    } finally {
      setCarregandoAlunos(false);
    }
  };

  const carregarTreinos = async (alunoId) => {
    if (!alunoId) return;
    setCarregandoSalvos(true);
    setErroSalvos("");
    try {
      const lista = await listarTreinos(alunoId);
      setSalvos(lista);
    } catch (err) {
      console.error(err);
      setErroSalvos("Não foi possível carregar treinos salvos.");
    } finally {
      setCarregandoSalvos(false);
    }
  };

  useEffect(() => {
    carregarAlunos();
  }, []);

  useEffect(() => {
    if (!alunoSelecionadoId && alunos.length) {
      setAlunoSelecionadoId(alunos[0].id);
      setNomeAluno((prev) => prev || alunos[0].nome);
    }
    if (alunoSelecionadoId) {
      carregarTreinos(alunoSelecionadoId);
    }
  }, [alunos, alunoSelecionadoId]);

  const treinosDoSelecionado = useMemo(() => salvos, [salvos]);

  const aplicarTreinoSalvo = (treino) => {
    if (!treino) return;
    setNomeAluno(
      (curr) =>
        curr || treino.alunoNome || treino.aluno_nome || treino.aluno || ""
    );
    setSelecionados(
      (treino.treino || []).map((ex, idx) => ({
        ...ex,
        conjugado: !!ex.conjugado,
        id: ex.id || `${ex.nome || "ex"}-${idx}`,
      }))
    );
  };

  const toggleTreinoExpand = (id) =>
    setTreinosExpandidos((prev) => ({ ...prev, [id]: !prev[id] }));

  const setDestino = (treinoId, alunoId) =>
    setDestinoTreino((prev) => ({ ...prev, [treinoId]: alunoId }));

  const gerarTreinoIA = async () => {
    if (!promptIA.trim()) {
      setErroIA("Descreva o treino que deseja gerar.");
      return;
    }
    setErroIA("");
    setGerandoIA(true);
    try {
      const base = import.meta.env.VITE_API_URL || "";
      const resp = await fetch(`${base}/ia/gerar-treino`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptIA }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) {
        throw new Error(data.error || "Erro ao gerar treino");
      }
      const lista = Array.isArray(data.treino) ? data.treino : [];
      const agora = Date.now();
      const montados = lista.map((ex, idx) => ({
        id: `${agora}-${idx}`,
        nome: ex.nome || `Exercício ${idx + 1}`,
        grupo: ex.grupo || "Geral",
        reps: ex.reps || "",
        carga: ex.carga || "",
        conjugado: !!ex.conjugado,
        file: procurarGif(ex.nome || "", ex.grupo),
      }));
      setSelecionados(montados);
      setMsgAluno("Treino gerado pela IA. Revise antes de salvar.");
    } catch (err) {
      console.error(err);
      setErroIA("Não foi possível gerar o treino. Verifique a API.");
    } finally {
      setGerandoIA(false);
    }
  };

  const aposSalvarTreino = async (idSalvo, nomeSalvo) => {
    const id = idSalvo || alunoSelecionadoId;
    if (!id) return;
    await carregarAlunos();
    await carregarTreinos(id);
    setAlunoSelecionadoId(id);
    if (nomeSalvo) {
      setNomeAluno(nomeSalvo);
    }
    setVisualizando(false);
  };

  // TELA DE VISUALIZAÇÃO
  if (visualizando) {
    return (
      <Visualizacao
        selecionados={selecionados}
        nomeAluno={nomeAluno}
        alunoId={alunoSelecionadoId}
        voltar={() => setVisualizando(false)}
        onSalvar={aposSalvarTreino}
        editarReps={(idx, val) => {
          const id = selecionados[idx]?.id;
          if (id) editarReps(id, val);
        }}
        editarCarga={(idx, val) => {
          const id = selecionados[idx]?.id;
          if (id) editarCarga(id, val);
        }}
      />
    );
  }

  // TELA PRINCIPAL
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50">
      <header className="bg-white/80 backdrop-blur border-b border-gray-200 px-6 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-gray-500">
            Studio Ferraz
          </p>
          <h1 className="text-2xl font-semibold text-gray-900">
            Criador de Treinos
          </h1>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative">
            <input
              list="alunos-salvos"
              className="border border-gray-200 px-4 py-2.5 rounded-xl text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500 min-w-[240px]"
              placeholder="Nome do aluno (ou escolha abaixo)"
              value={nomeAluno}
              onChange={(e) => {
                const val = e.target.value;
                setNomeAluno(val);
                const encontrado = alunos.find((a) => a.nome === val);
                setAlunoSelecionadoId(encontrado ? encontrado.id : "");
              }}
            />
            <datalist id="alunos-salvos">
              {alunos.map((a) => (
                <option key={a.id} value={a.nome} />
              ))}
            </datalist>
          </div>
          <button
            onClick={async () => {
              if (!nomeAluno.trim()) {
                setMsgAluno("Informe um nome.");
                return;
              }
              setMsgAluno("");
              setSalvandoAluno(true);
              try {
                const resp = await salvarAluno(nomeAluno);
                setMsgAluno(
                  resp.existed
                    ? "Aluno já existia (ok)."
                    : "Aluno salvo com sucesso."
                );
                await carregarAlunos();
                setAlunoSelecionadoId(resp.id);
              } catch (err) {
                setMsgAluno("Erro ao salvar aluno.");
              } finally {
                setSalvandoAluno(false);
              }
            }}
            className="px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm shadow-sm hover:bg-black transition disabled:opacity-50"
            disabled={salvandoAluno}
          >
            {salvandoAluno ? "Salvando..." : "Salvar aluno"}
          </button>
        </div>
      </header>
      {msgAluno && (
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <p className="text-sm text-gray-600 mt-1">{msgAluno}</p>
        </div>
      )}

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[1.8fr_1fr] gap-8 p-6 lg:p-10">
        {/* BUSCA */}
        <section className="bg-white/80 backdrop-blur border border-gray-200 rounded-3xl shadow-sm p-6 lg:p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
                Biblioteca
              </p>
              <h2 className="text-xl font-semibold text-gray-900">
                Buscar exercícios
              </h2>
            </div>
          </div>

          <div className="mt-5 flex flex-col sm:flex-row gap-3">
            <input
              className="border border-gray-200 px-4 py-3 rounded-2xl flex-1 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500 transition"
              placeholder="Digite 'rosca', 'supino', 'agachamento'..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>

          {/* RESULTADOS */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
            {resultados.map((ex) => (
              <div
                key={ex.key}
                className="group cursor-pointer border border-gray-200 p-3 rounded-2xl shadow-sm hover:shadow-lg transition bg-white"
                onClick={() => adicionar(ex)}
              >
                <div className="h-36 w-full flex items-center justify-center overflow-hidden rounded-xl bg-gray-100">
                  <img src={ex.file} alt={ex.nome} className="max-h-full" />
                </div>

                <h3 className="mt-3 text-sm font-semibold text-gray-900 line-clamp-2 leading-5">
                  {ex.nome}
                </h3>
                <p className="text-xs text-gray-500 mt-1">{ex.grupo}</p>
              </div>
            ))}
          </div>
        </section>

        {/* TREINO + LISTA SALVA */}
        <section className="bg-white/80 backdrop-blur border border-gray-200 rounded-3xl shadow-sm p-6 lg:p-7 lg:sticky lg:top-6 self-start space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
                Montagem
              </p>
              <h2 className="text-xl font-semibold text-gray-900">
                Treino Selecionado
              </h2>
            </div>
            <span className="text-sm text-gray-500">
              {selecionados.length} itens
            </span>
          </div>

          <div className="mt-5 space-y-4">
            <div className="border border-blue-100 bg-blue-50/60 rounded-2xl p-3 shadow-inner">
              <p className="text-sm font-semibold text-gray-900 mb-2">
                Gerar treino com IA
              </p>
              <textarea
                className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500 mb-3"
                placeholder="Ex.: Treino de hipertrofia para iniciante, 5x na semana, dividir em A/B e incluir core."
                value={promptIA}
                onChange={(e) => setPromptIA(e.target.value)}
                rows={3}
              />
              <div className="flex items-center gap-3">
                <button
                  onClick={gerarTreinoIA}
                  disabled={gerandoIA}
                  className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm shadow-sm hover:bg-blue-700 transition disabled:opacity-60"
                >
                  {gerandoIA ? "Gerando..." : "Gerar com IA"}
                </button>
                {erroIA && <span className="text-xs text-red-600">{erroIA}</span>}
              </div>
            </div>

            {selecionados.map((s, i) => (
              <div
                key={s.id}
                className="border border-gray-200 rounded-2xl p-3 shadow-sm bg-gray-50/80"
              >
                <div className="flex items-center gap-3">
                  <img
                    className="w-20 h-20 rounded-xl object-contain bg-white border border-gray-200"
                    src={s.file}
                    alt={s.nome}
                  />

                  <div className="flex-1">
                    <input
                      className="w-full border border-gray-200 px-3 py-2 rounded-xl mb-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500"
                      value={s.nome}
                      onChange={(e) => editarNome(s.id, e.target.value)}
                    />

                    <div className="flex gap-2 flex-wrap">
                      <input
                        className="border border-gray-200 px-3 py-2 rounded-xl w-24 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500"
                        placeholder="Reps"
                        value={s.reps}
                        onChange={(e) => editarReps(s.id, e.target.value)}
                      />
                      <input
                        className="border border-gray-200 px-3 py-2 rounded-xl w-24 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500"
                        placeholder="Carga"
                        value={s.carga}
                        onChange={(e) => editarCarga(s.id, e.target.value)}
                      />
                    </div>
                    <label className="inline-flex items-center gap-2 text-xs text-gray-700 mt-2">
                      <input
                        type="checkbox"
                        checked={s.conjugado}
                        onChange={() => toggleConjugado(s.id)}
                        className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-400"
                      />
                      <span>Marcar como conjugado</span>
                    </label>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-700 hover:border-gray-300 transition"
                      onClick={() => mover(i, -1)}
                    >
                      ↑
                    </button>
                    <button
                      className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-700 hover:border-gray-300 transition"
                      onClick={() => mover(i, 1)}
                    >
                      ↓
                    </button>
                    <button
                      className="px-2.5 py-1.5 bg-red-500 text-white rounded-lg shadow-sm hover:bg-red-600 transition"
                      onClick={() => remover(s.id)}
                    >
                      X
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            disabled={!selecionados.length}
            className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-2xl font-semibold transition disabled:opacity-50 shadow-lg shadow-blue-500/10"
            onClick={() => setVisualizando(true)}
          >
            Finalizar Treino
          </button>

          {/* Alunos e seus treinos */}
          <div className="pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
                  Alunos
                </p>
                <h3 className="text-lg font-semibold text-gray-900">
                    Alunos e treinos
                </h3>
              </div>
              <button
                onClick={() => {
                  carregarAlunos();
                  if (alunoSelecionadoId) carregarTreinos(alunoSelecionadoId);
                }}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                {carregandoAlunos || carregandoSalvos
                  ? "Atualizando..."
                  : "Atualizar"}
              </button>
            </div>

            {erroAlunos && (
              <p className="text-sm text-red-600 mb-2">{erroAlunos}</p>
            )}
            {erroSalvos && (
              <p className="text-sm text-red-600 mb-2">{erroSalvos}</p>
            )}

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {alunos.map((a) => (
                <div
                  key={a.id}
                  className={`p-3 border rounded-xl cursor-pointer transition ${
                    alunoSelecionadoId === a.id
                      ? "border-blue-500 bg-blue-50/60"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => {
                    setAlunoSelecionadoId(a.id);
                    setNomeAluno(a.nome);
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">
                        {a.nome}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {a.created_at
                          ? new Date(a.created_at).toLocaleDateString("pt-BR")
                          : ""}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="text-xs px-2 py-1 border border-gray-200 rounded-lg hover:border-gray-300"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const novo = prompt("Novo nome do aluno:", a.nome);
                          if (!novo || !novo.trim()) return;
                          try {
                            await renomearAluno(a.id, novo.trim());
                            await carregarAlunos();
                            if (alunoSelecionadoId === a.id) {
                              setNomeAluno(novo.trim());
                            }
                            setMsgAluno("Aluno atualizado.");
                          } catch {
                            setMsgAluno("Erro ao atualizar aluno.");
                          }
                        }}
                      >
                        Editar
                      </button>
                      <button
                        className="text-xs px-2 py-1 border border-red-200 text-red-600 rounded-lg hover:border-red-300"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const ok = confirm(
                            "Excluir aluno e treinos vinculados?"
                          );
                          if (!ok) return;
                          try {
                            await excluirAluno(a.id);
                            await carregarAlunos();
                            setSalvos([]);
                            if (alunoSelecionadoId === a.id) {
                              setAlunoSelecionadoId("");
                              setNomeAluno("");
                            }
                            setMsgAluno("Aluno excluído.");
                          } catch {
                            setMsgAluno("Erro ao excluir aluno.");
                          }
                        }}
                      >
                        Excluir
                      </button>
                    </div>
                  </div>

                </div>
              ))}

              {!carregandoAlunos && !alunos.length && (
                <p className="text-sm text-gray-500">Nenhum aluno cadastrado.</p>
              )}
            </div>
            {/* Treinos do aluno selecionado */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
                    Histórico
                  </p>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Treinos do aluno selecionado
                  </h3>
                </div>
              </div>

              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {treinosDoSelecionado.map((t, idx) => {
                  const exercicios = Array.isArray(t.treino) ? t.treino : [];
                  const expandido = treinosExpandidos[t.id];
                  const alunoDestino = destinoTreino[t.id] || t.alunoId || "";
                  return (
                    <div
                      key={t.id}
                      className="p-3 border border-gray-200 rounded-xl hover:border-gray-300 transition bg-white/60"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {idx + 1} - {t.alunoNome || t.aluno_nome || "Treino"}
                          </p>
                          <p className="text-[11px] text-gray-500">
                            {t.created_at
                              ? new Date(t.created_at).toLocaleDateString("pt-BR")
                              : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            className="text-xs px-3 py-1 border border-gray-200 rounded-lg hover:border-gray-300"
                            onClick={() => toggleTreinoExpand(t.id)}
                          >
                            {expandido ? "Recolher" : "Ver exercícios"}
                          </button>
                          <select
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white"
                            value={alunoDestino}
                            onChange={(e) => setDestino(t.id, e.target.value)}
                          >
                            <option value={t.alunoId || ""}>
                              Aplicar em {t.alunoNome || "aluno"}
                            </option>
                            {alunos
                              .filter((a) => a.id !== t.alunoId)
                              .map((a) => (
                                <option key={a.id} value={a.id}>
                                  Aplicar em {a.nome}
                                </option>
                              ))}
                          </select>
                          <button
                            className="text-xs px-3 py-1 border border-gray-200 rounded-lg hover:border-gray-300"
                            onClick={() => {
                              const alvoId = alunoDestino || t.alunoId || alunoSelecionadoId;
                              if (alvoId) setAlunoSelecionadoId(alvoId);
                              const aluno = alunos.find((a) => a.id === alvoId);
                              if (aluno) setNomeAluno(aluno.nome);
                              aplicarTreinoSalvo(t);
                            }}
                          >
                            Aplicar treino
                          </button>
                        </div>
                      </div>

                      {expandido && (
                        <ul className="mt-3 text-xs text-gray-700 list-disc list-inside space-y-1">
                          {exercicios.map((ex, i) => (
                            <li key={`${t.id}-ex-${i}`}>
                              {ex.nome || `Exercício ${i + 1}`}
                              {ex.reps ? ` — ${ex.reps}` : ""}
                              {ex.carga ? ` (${ex.carga})` : ""}
                              {ex.conjugado ? " [Conjugado]" : ""}
                            </li>
                          ))}
                          {!exercicios.length && (
                            <li className="text-gray-400">Sem exercícios cadastrados</li>
                          )}
                        </ul>
                      )}
                    </div>
                  );
                })}

                {!treinosDoSelecionado.length && (
                  <p className="text-sm text-gray-500">
                    Nenhum treino salvo para este aluno.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
