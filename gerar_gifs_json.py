import os
import json
import unicodedata

BASE = "public/gifs"
OUTFILE = "public/gifs.json"

def normalizar_nome(nome):
    # Remove acentos, transforma em ASCII
    nome = unicodedata.normalize("NFD", nome)
    nome = nome.encode("ascii", "ignore").decode("utf-8")
    nome = nome.replace("_", " ")
    nome = nome.replace("-", " ")
    nome = nome.replace("  ", " ")
    return nome.lower().strip()

def main():
    if not os.path.isdir(BASE):
        print(f"❌ Pasta {BASE} nao encontrada!")
        return

    resultado = {}

    # Lista todas as categorias dentro de public/gifs/
    for categoria in sorted(os.listdir(BASE)):
        caminho_cat = os.path.join(BASE, categoria)

        if not os.path.isdir(caminho_cat):
            continue

        # Lista apenas GIFs dentro da categoria
        gifs = [
            f for f in os.listdir(caminho_cat)
            if f.lower().endswith(".gif") and not f.startswith("._")
        ]

        lista = []
        for gif in gifs:
            nome_limpo = os.path.splitext(gif)[0]
            nome_normalizado = normalizar_nome(nome_limpo)

            lista.append({
                "nome": nome_normalizado,
                "url": f"/gifs/{categoria}/{gif}"
            })

        if lista:
            resultado[categoria] = sorted(lista, key=lambda x: x["nome"])

    # Salva como JSON bonito
    with open(OUTFILE, "w", encoding="utf-8") as f:
        json.dump(resultado, f, ensure_ascii=False, indent=2)

    print("✔ gifs.json gerado com sucesso!")
    print(f"Pastas encontradas: {len(resultado)}")
    print(f"Arquivo salvo em: {OUTFILE}")

if __name__ == "__main__":
    main()
