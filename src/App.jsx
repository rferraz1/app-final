import React, { useEffect, useState } from "react";
import Visualizacao from "./Visualizacao.jsx";

export default function App() {
  const [busca, setBusca] = useState("");
  const [gifsMap, setGifsMap] = useState({});
  const [resultados, setResultados] = useState([]);
  const [selecionados, setSelecionados] = useState([]);
  const [visualizando, setVisualizando] = useState(false);
  const [nomeAluno, setNomeAluno] = useState("");

  // REMOVE ACENTOS / NORMALIZA
  function normalizar(texto) {
    return texto
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[_-]/g, " ")
      .toLowerCase();
  }

  // CARREGA O ARQUIVO DE GIFS (versão com URLs remotas em public/gifsRemote.json)
  useEffect(() => {
    fetch("/gifsRemote.json")
      .then((res) => res.json())
      .then((data) => setGifsMap(data))
      .catch((err) => console.error("Erro carregando gifsRemote.json:", err));
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

  const mover = (index, dir) => {
    setSelecionados((p) => {
      const c = [...p];
      const alvo = index + dir;
      if (alvo < 0 || alvo >= c.length) return c;
      [c[index], c[alvo]] = [c[alvo], c[index]];
      return c;
    });
  };

  // TELA DE VISUALIZAÇÃO
  if (visualizando) {
    return (
      <Visualizacao
        selecionados={selecionados}
        nomeAluno={nomeAluno}
        voltar={() => setVisualizando(false)}
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

        <input
          className="border border-gray-200 px-4 py-2.5 rounded-xl text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500 min-w-[240px]"
          placeholder="Nome do aluno"
          value={nomeAluno}
          onChange={(e) => setNomeAluno(e.target.value)}
        />
      </header>

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

        {/* TREINO */}
        <section className="bg-white/80 backdrop-blur border border-gray-200 rounded-3xl shadow-sm p-6 lg:p-7">
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

                    <div className="flex gap-2">
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
        </section>
      </main>
    </div>
  );
}
