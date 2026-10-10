import { describe, expect, it } from "vitest";
import Papa from "papaparse";
import { criarSeed } from "@/data/seed";
import { aplicarImportacao, mapearColunas, modeloCsv, montarPrevia, normalizarPorte, normalizarTelefone } from "./importacao";

describe("importar clientes por planilha", () => {
  it("acha as colunas pelo cabeçalho, com ou sem acento", () => {
    const m = mapearColunas(["Nome", "Telefone", "E-mail", "Nome do Pet", "Raça", "Tamanho", "OBS"]);
    expect(m).toMatchObject({ tutor: 0, whatsapp: 1, email: 2, pet: 3, raca: 4, porte: 5, observacoes: 6, especie: -1 });
    expect(mapearColunas(["Cliente", "Celular", "Animal", "Espécie"])).toMatchObject({ tutor: 0, whatsapp: 1, pet: 2, especie: 3 });
  });

  it("normaliza telefone e porte", () => {
    expect(normalizarTelefone("(11) 98765-4321")).toBe("5511987654321");
    expect(normalizarTelefone("+55 11 3333-4444")).toBe("551133334444");
    expect(normalizarTelefone("011987654321")).toBe("5511987654321");
    expect(normalizarTelefone("98765-4321")).toBeNull();
    expect(["P", "pequeno", "Médio", "grande", "Gigante", "mini", "x"].map(normalizarPorte)).toEqual(["P", "P", "M", "G", "GG", "P", null]);
  });

  it("o modelo para baixar é lido de volta: mesmo WhatsApp vira um tutor com dois pets", () => {
    const linhas = Papa.parse<string[]>(modeloCsv().replace(/^﻿/, ""), { skipEmptyLines: true }).data;
    const db = criarSeed();
    const p = montarPrevia(db, linhas);
    expect(p.problemas).toEqual([]);
    expect(p.novosTutores).toBe(2);
    expect(p.novosPets).toBe(3);
    const carla = p.tutores.find((t) => t.nome === "Carla Mendes")!;
    expect(carla.whatsapp).toBe("5511987654321");
    expect(carla.pets.map((x) => [x.nome, x.porte, x.especie])).toEqual([
      ["Thor", "G", "cao"],
      ["Mel", "P", "cao"],
    ]);
    expect(p.tutores.find((t) => t.nome === "Rafael Souza")!.pets[0]).toMatchObject({ nome: "Luna", especie: "gato", sexo: "F", raca: "Sem raça definida" });
    expect(carla.pets[1].raca).toBe("Shih-tzu");

    const r = aplicarImportacao(db, p, new Date());
    expect(r.tutores).toHaveLength(2);
    expect(r.pets).toHaveLength(3);
    expect(r.db.tutores).toHaveLength(db.tutores.length + 2);
    expect(r.pets.filter((x) => x.tutorId === r.tutores.find((t) => t.nome === "Carla Mendes")!.id)).toHaveLength(2);
  });

  it("não duplica tutor nem pet que já existem e aponta as linhas com problema", () => {
    const db = criarSeed();
    const existente = db.tutores[0];
    const petExistente = db.pets.find((p) => p.tutorId === existente.id)!;
    const linhas = [
      ["tutor", "whatsapp", "pet", "porte"],
      [existente.nome, existente.whatsapp.slice(2), petExistente.nome, "P"],
      [existente.nome, existente.whatsapp, "Bolinha Nova", ""],
      ["Sem Zap", "123", "Rex", "G"],
      ["", "11999990000", "Toby", "M"],
      ["", "", "", ""],
      ["joão da silva", "11 95555-1234", "", ""],
    ];
    const p = montarPrevia(db, linhas);
    expect(p.petsRepetidos).toBe(1);
    expect(p.novosTutores).toBe(1); // João, sem pet
    expect(p.novosPets).toBe(1); // Bolinha Nova no tutor que já existia
    expect(p.semPorte).toBe(1);
    expect(p.problemas).toEqual([
      { linha: 4, motivo: "WhatsApp inválido (123)" },
      { linha: 5, motivo: "sem nome do tutor" },
    ]);
    expect(p.tutores.find((t) => t.whatsapp === "5511955551234")!.nome).toBe("João da Silva");

    const r = aplicarImportacao(db, p, new Date());
    expect(r.tutores.map((t) => t.nome)).toEqual(["João da Silva"]);
    expect(r.pets).toEqual([expect.objectContaining({ nome: "Bolinha Nova", tutorId: existente.id, porte: "M" })]);
  });

  it("sem as colunas obrigatórias, explica o que falta", () => {
    expect(montarPrevia(criarSeed(), [["Pet", "Raça"], ["Rex", "SRD"]]).problemas[0].motivo).toMatch(/nome do tutor e do WhatsApp/);
  });
});
