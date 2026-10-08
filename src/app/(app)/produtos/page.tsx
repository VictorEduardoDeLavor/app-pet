"use client";

import { ShoppingBag } from "lucide-react";
import { TituloVoltar, Vazio } from "@/components/ui";

export default function Produtos() {
  return (
    <div>
      <TituloVoltar voltarPara="/">Produtos</TituloVoltar>
      <Vazio
        icone={<ShoppingBag className="h-6 w-6" />}
        titulo="Venda de produtos chega na V3"
        texto="Cadastro de produtos, estoque e venda no balcão junto com o atendimento. Por enquanto, compras de produtos entram como despesa no Financeiro."
      />
    </div>
  );
}
