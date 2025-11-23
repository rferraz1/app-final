import fs from "fs";

// Caminho base do seu R2 (SEM barras no final)
const BASE = "https://pub-0173b7fd04854be5b34e1727d5fa1798.r2.dev/gifs";

const gifs = JSON.parse(fs.readFileSync("./public/gifs.json", "utf-8"));


const result = {};

for (const categoria in gifs) {
  const arquivos = gifs[categoria];

  // Remove espaços %20 / caracteres especiais automaticamente
  const categoriaEncode = encodeURIComponent(categoria);

  result[categoria] = arquivos.map(arq => {
    const nomeEncode = encodeURIComponent(arq);
    return `${BASE}/${categoriaEncode}/${nomeEncode}`;
  });
}

fs.writeFileSync("./gifsUrls.json", JSON.stringify(result, null, 2));

console.log("✔ gifsUrls.json gerado com sucesso!");
