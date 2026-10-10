import { describe, expect, it } from "vitest";
import { lerViaCep, limparCep, mascararCep, montarEndereco } from "./cep";

describe("endereço pelo CEP", () => {
  it("aceita só CEP completo e mascara enquanto digita", () => {
    expect(limparCep("01310-100")).toBe("01310100");
    expect(limparCep("0131010")).toBe("");
    expect(mascararCep("013101")).toBe("01310-1");
    expect(mascararCep("01310100999")).toBe("01310-100");
  });

  it("lê a resposta do ViaCEP e monta o texto do endereço", () => {
    const l = lerViaCep({ cep: "01310-100", logradouro: "Avenida Paulista", bairro: "Bela Vista", localidade: "São Paulo", uf: "SP" })!;
    expect(montarEndereco(l, "1000", "01310100")).toBe("Avenida Paulista, 1000 · Bela Vista, São Paulo/SP · CEP 01310-100");
    expect(montarEndereco(l, "", "01310100")).toBe("Avenida Paulista, s/n · Bela Vista, São Paulo/SP · CEP 01310-100");
    expect(lerViaCep({ erro: true })).toBeNull();
    expect(lerViaCep({ erro: "true" })).toBeNull();
  });

  it("CEP de cidade pequena, sem rua nem bairro", () => {
    const l = lerViaCep({ logradouro: "", bairro: "", localidade: "Lindoia", uf: "SP" })!;
    expect(montarEndereco(l, "12", "13950000")).toBe("12 · Lindoia/SP · CEP 13950-000");
  });
});
