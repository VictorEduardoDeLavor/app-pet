import { describe, expect, it } from "vitest";
import { RACAS, SEM_RACA, buscarRacas, normalizarRaca, racaDaLista } from "./racas";
import { ALERGIA_SEM_DETALHE, SEM_ALERGIA, avisoDoPet, ehBravo, normalizarAlergia, normalizarFicha, temAlergia, temAlerta, tituloAlergia } from "./ficha-pet";
import { criarPet } from "./rules";
import { criarSeed } from "@/data/seed";
import { montarPrevia } from "./importacao";

const nomes = (q: string, especie?: "cao" | "gato") => buscarRacas(q, especie).map((r) => r.nome);

describe("lista de raças", () => {
  it("não repete nome dentro da mesma espécie", () => {
    for (const especie of ["cao", "gato"] as const) {
      const lista = RACAS.filter((r) => r.especie === especie).map((r) => r.nome);
      expect(new Set(lista).size).toBe(lista.length);
    }
  });

  it("campo vazio mostra as mais comuns, com SRD primeiro", () => {
    expect(nomes("", "cao").slice(0, 3)).toEqual([SEM_RACA, "Shih-tzu", "Spitz Alemão (Lulu da Pomerânia)"]);
    expect(nomes("", "gato")[0]).toBe(SEM_RACA);
    expect(nomes("", "gato")).toContain("Persa");
  });

  it("acha pela primeira ou segunda letra, sem acento e pelo apelido", () => {
    expect(nomes("shi", "cao")[0]).toBe("Shih-tzu");
    expect(nomes("shitzu", "cao")[0]).toBe("Shih-tzu");
    expect(nomes("lulu", "cao")[0]).toBe("Spitz Alemão (Lulu da Pomerânia)");
    expect(nomes("york", "cao")[0]).toBe("Yorkshire Terrier");
    expect(nomes("srd", "cao")[0]).toBe(SEM_RACA);
    expect(nomes("vira", "cao")[0]).toBe(SEM_RACA);
    expect(nomes("maltes", "cao")[0]).toBe("Maltês");
    expect(nomes("pastor", "cao")[0]).toBe("Pastor Alemão");
    expect(nomes("siames", "gato")[0]).toBe("Siamês");
    expect(nomes("cocker", "cao")).toEqual(expect.arrayContaining(["Cocker Spaniel Americano", "Cocker Spaniel Inglês"]));
  });

  it("perdoa um erro de digitação", () => {
    expect(nomes("labador", "cao")[0]).toBe("Labrador Retriever");
    expect(nomes("yokshire", "cao")[0]).toBe("Yorkshire Terrier");
  });

  it("separa cães e gatos", () => {
    expect(nomes("pers", "cao")).not.toContain("Persa");
    expect(nomes("pers", "gato")[0]).toBe("Persa");
  });

  it("troca apelido e grafia pelo nome da lista e mantém o que não conhece", () => {
    expect(normalizarRaca("Shitzu", "cao")).toBe("Shih-tzu");
    expect(normalizarRaca("  shih tzu ", "cao")).toBe("Shih-tzu");
    expect(normalizarRaca("SRD", "gato")).toBe(SEM_RACA);
    expect(normalizarRaca("Vira-lata", "cao")).toBe(SEM_RACA);
    expect(normalizarRaca("lulu da pomerania", "cao")).toBe("Spitz Alemão (Lulu da Pomerânia)");
    expect(normalizarRaca("Mestiço de poodle", "cao")).toBe("Mestiço de poodle");
    expect(normalizarRaca("", "cao")).toBe("");
    expect(racaDaLista("Shih-tzu", "cao")).toBe(true);
    expect(racaDaLista("Shitzu", "cao")).toBe(false);
  });
});

describe("alergia, temperamento e alertas", () => {
  it("padroniza não, sim e o texto da alergia", () => {
    expect(["não", "Nao", "nenhuma", "-", "sem alergia"].map(normalizarAlergia)).toEqual(Array(5).fill(SEM_ALERGIA));
    expect(normalizarAlergia("Sim")).toBe(ALERGIA_SEM_DETALHE);
    expect(normalizarAlergia(" perfume ")).toBe("perfume");
    expect(normalizarAlergia("")).toBeUndefined();
  });

  it("'Não tem' não vira alerta; alergia, cuidado e pet bravo viram", () => {
    expect(temAlergia({ alergias: SEM_ALERGIA })).toBe(false);
    expect(temAlerta({ alergias: "não" })).toBe(false);
    expect(temAlergia({ alergias: "perfume" })).toBe(true);
    expect(tituloAlergia({ alergias: "perfume" })).toBe("Alergia a perfume");
    expect(tituloAlergia({ alergias: "Sim" })).toMatch(/Tem alergia/);
    expect(ehBravo({ temperamento: "Bravo" })).toBe(true);
    expect(ehBravo({ temperamento: "morde no secador" })).toBe(true);
    expect(ehBravo({ temperamento: "Tranquilo" })).toBe(false);
    expect(temAlerta({ cuidados: "Secador baixo" })).toBe(true);
    expect(avisoDoPet({ alergias: "perfume", temperamento: "Bravo", cuidados: "Focinheira" })).toEqual({
      titulo: "Alergia a perfume · Bravo: cuidado ao manusear",
      texto: "Focinheira",
    });
    expect(avisoDoPet({ alergias: SEM_ALERGIA, temperamento: "Tranquilo" })).toBeUndefined();
  });

  it("a ficha é arrumada ao gravar", () => {
    const f = normalizarFicha({ raca: "shitzu", especie: "cao", pelagem: "  ", temperamento: " Agitado ", alergias: "não", cuidados: "" });
    expect(f).toMatchObject({ raca: "Shih-tzu", pelagem: undefined, temperamento: "Agitado", alergias: SEM_ALERGIA, cuidados: undefined });
    expect(normalizarFicha({ raca: "", especie: "gato" }).raca).toBe(SEM_RACA);
  });

  it("cadastrar pet já grava a raça da lista", () => {
    const db = criarSeed();
    const { pet } = criarPet(db, { tutorId: db.tutores[0].id, nome: "Nick", especie: "cao", raca: "Shitzu", porte: "P", alergias: "nao" });
    expect(pet.raca).toBe("Shih-tzu");
    expect(pet.alergias).toBe(SEM_ALERGIA);
  });

  it("a importação por planilha corrige raça e alergia", () => {
    const p = montarPrevia(criarSeed(), [
      ["Tutor", "WhatsApp", "Pet", "Espécie", "Raça", "Alergias"],
      ["Maria Souza", "11 98888-7777", "Nick", "cão", "shitzu", "não"],
      ["Maria Souza", "11 98888-7777", "Mimi", "gato", "siames", "sim"],
    ]);
    expect(p.tutores[0].pets.map((x) => [x.raca, x.alergias])).toEqual([
      ["Shih-tzu", SEM_ALERGIA],
      ["Siamês", ALERGIA_SEM_DETALHE],
    ]);
  });
});
