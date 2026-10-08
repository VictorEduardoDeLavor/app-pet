// Valida a migration num Postgres embutido (PGlite), sem precisar de projeto Supabase.
// Stubs mínimos do Supabase: schema auth, auth.uid() e o papel "authenticated".

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";

const db = new PGlite({ extensions: { btree_gist } });

const U_ANA = "00000000-0000-0000-0000-00000000000a"; // dona do pet shop A
const U_BRUNO = "00000000-0000-0000-0000-00000000000b"; // banhista do pet shop A
const U_OUTRO = "00000000-0000-0000-0000-00000000000c"; // dono do pet shop B
const U_NOVA = "00000000-0000-0000-0000-00000000000d"; // recém-cadastrada, entra por convite

async function como<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${userId}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}

const um = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];

let A: string, B: string, bruno: string, thor: string, luna: string, banho: string, banhoTosa: string, plano: string;

beforeAll(async () => {
  await db.exec(`
    create role authenticated nologin;
    create role anon nologin;
    create schema extensions;
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;
    insert into auth.users values ('${U_ANA}', 'ana@patinhas.com'), ('${U_BRUNO}', 'bruno@patinhas.com'), ('${U_OUTRO}', 'dono@outro.com'), ('${U_NOVA}', 'camila@patinhas.com');
  `);
  // Como no Supabase: tabelas e funções novas do schema public já nascem liberadas para os papéis da API.
  await db.exec(`
    grant usage on schema public to authenticated, anon;
    alter default privileges in schema public grant all on tables to authenticated, anon;
    alter default privileges in schema public grant all on sequences to authenticated, anon;
    alter default privileges in schema public grant execute on functions to authenticated, anon;
  `);
  const pasta = path.join(__dirname, "migrations");
  for (const arquivo of readdirSync(pasta).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(path.join(pasta, arquivo), "utf8"));
  }

  // Onboarding pelo RPC, como cada dono.
  A = (await como(U_ANA, () => um<{ id: string }>(`select id from criar_petshop('Patinhas', 'patinhas', '5511999990000', 'Ana Martins')`))).id;
  B = (await como(U_OUTRO, () => um<{ id: string }>(`select id from criar_petshop('Outro Pet', 'outro')`))).id;

  // Dados base do pet shop A (como superusuário, só para montar o cenário).
  bruno = (await um<{ id: string }>(`insert into membros (petshop_id, user_id, nome, papel, comissao_pct) values ($1, $2, 'Bruno', 'banhista', 40) returning id`, [A, U_BRUNO])).id;
  const carlos = (await um<{ id: string }>(`insert into tutores (petshop_id, nome, whatsapp) values ($1, 'Carlos Lima', '5511988776655') returning id`, [A])).id;
  const ana = (await um<{ id: string }>(`insert into tutores (petshop_id, nome, whatsapp) values ($1, 'Ana Souza', '5511991234567') returning id`, [A])).id;
  thor = (await um<{ id: string }>(`insert into pets (petshop_id, tutor_id, nome, raca, porte) values ($1, $2, 'Thor', 'Golden', 'G') returning id`, [A, carlos])).id;
  luna = (await um<{ id: string }>(`insert into pets (petshop_id, tutor_id, nome, raca, porte) values ($1, $2, 'Luna', 'Maltês', 'P') returning id`, [A, ana])).id;
  banho = (await um<{ id: string }>(`insert into servicos (petshop_id, nome, categoria, comissao_pct) values ($1, 'Banho', 'banho', 40) returning id`, [A])).id;
  banhoTosa = (await um<{ id: string }>(`insert into servicos (petshop_id, nome, categoria, comissao_pct) values ($1, 'Banho e tosa', 'tosa', 40) returning id`, [A])).id;
  plano = (await um<{ id: string }>(
    `insert into planos_pet (petshop_id, nome, pet_id, tutor_id, servico_ids, total_usos, preco, inicio, vencimento)
     values ($1, 'Pacote 4 banhos', $2, $3, array[$4]::uuid[], 2, 240, current_date - 5, current_date + 25) returning id`,
    [A, thor, carlos, banho],
  )).id;
  await db.query(`insert into tutores (petshop_id, nome, whatsapp) values ($1, 'Cliente do B', '5521999998888')`, [B]);
});

async function agendar(petId: string, inicio: string, duracaoMin: number, itens: { servico: string; nome: string; preco: number; coberto?: boolean }[], planoId?: string) {
  const pet = await um<{ tutor_id: string }>(`select tutor_id from pets where id = $1`, [petId]);
  const valor = itens.filter((i) => !i.coberto).reduce((s, i) => s + i.preco, 0);
  const atd = await um<{ id: string }>(
    `insert into atendimentos (petshop_id, pet_id, tutor_id, profissional_id, inicio, fim, valor_total, plano_pet_id)
     values ($1, $2, $3, $4, $5::timestamptz, $5::timestamptz + make_interval(mins => $6), $7, $8) returning id`,
    [A, petId, pet.tutor_id, bruno, inicio, duracaoMin, valor, planoId ?? null],
  );
  for (const i of itens)
    await db.query(
      `insert into atendimento_itens (petshop_id, atendimento_id, servico_id, nome, preco, duracao_min, coberto_por_plano) values ($1, $2, $3, $4, $5, 60, $6)`,
      [A, atd.id, i.servico, i.nome, i.preco, !!i.coberto],
    );
  return atd.id;
}

const status = (id: string, s: string) => db.query(`update atendimentos set status = $2 where id = $1`, [id, s]);

describe("schema Supabase", () => {
  it("criador do pet shop vira dono", async () => {
    const m = await um<{ papel: string; nome: string }>(`select papel, nome from membros where petshop_id = $1 and user_id = $2`, [A, U_ANA]);
    expect(m).toEqual({ papel: "dono", nome: "Ana Martins" });
    const outro = await um<{ nome: string }>(`select nome from membros where petshop_id = $1`, [B]);
    expect(outro.nome).toBe("dono@outro.com");
  });

  it("pet shop só nasce pelo RPC e anon não executa funções", async () => {
    await expect(como(U_ANA, () => db.query(`insert into petshops (nome, slug) values ('X', 'x')`))).rejects.toThrow(/row-level security/);
    await db.exec(`set role anon;`);
    try {
      await expect(db.query(`select criar_petshop('Y', 'y')`)).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec(`reset role;`);
    }
  });

  it("API expõe só os RPCs: anon não chama convite e ninguém chama função de trigger", async () => {
    await db.exec(`set role anon;`);
    try {
      await expect(db.query(`select aceitar_convite('ABC234')`)).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec(`reset role;`);
    }
    await expect(como(U_ANA, () => db.query(`select atendimento_mudou_status()`))).rejects.toThrow(/permission denied/);
  });

  it("criar_atendimento grava atendimento e itens juntos, respeitando RLS", async () => {
    const atd = {
      id: "11111111-1111-4111-8111-111111111111", petshop_id: A, pet_id: luna,
      tutor_id: (await um<{ tutor_id: string }>(`select tutor_id from pets where id = $1`, [luna])).tutor_id,
      profissional_id: bruno, inicio: "2026-10-20T09:00:00-03:00", fim: "2026-10-20T10:00:00-03:00", valor_total: 80,
    };
    const itens = [{ servico_id: banhoTosa, nome: "Banho e tosa", preco: 80, duracao_min: 60, coberto_por_plano: false }];
    const id = await como(U_ANA, async () => (await um<{ id: string }>(`select criar_atendimento($1::jsonb, $2::jsonb) as id`, [JSON.stringify(atd), JSON.stringify(itens)])).id);
    expect(id).toBe(atd.id);
    expect((await um<{ n: number }>(`select count(*)::int as n from atendimento_itens where atendimento_id = $1`, [id])).n).toBe(1);
    await expect(
      como(U_OUTRO, () => db.query(`select criar_atendimento($1::jsonb, $2::jsonb)`, [JSON.stringify({ ...atd, id: "22222222-2222-4222-8222-222222222222", inicio: "2026-10-21T09:00:00-03:00", fim: "2026-10-21T10:00:00-03:00" }), JSON.stringify(itens)])),
    ).rejects.toThrow(/row-level security/);
  });

  it("RLS isola os pet shops", async () => {
    const nomes = await como(U_ANA, async () => (await db.query<{ nome: string }>(`select nome from tutores order by nome`)).rows.map((r) => r.nome));
    expect(nomes).toEqual(["Ana Souza", "Carlos Lima"]);
    const doOutro = await como(U_OUTRO, async () => (await db.query(`select * from tutores`)).rows.length);
    expect(doOutro).toBe(1);
    await expect(
      como(U_OUTRO, () => db.query(`insert into tutores (petshop_id, nome, whatsapp) values ($1, 'Intruso', '5511900000000')`, [A])),
    ).rejects.toThrow(/row-level security/);
  });

  it("bloqueia conflito de horário do mesmo profissional", async () => {
    await agendar(luna, "2026-10-07 09:00-03", 60, [{ servico: banhoTosa, nome: "Banho e tosa", preco: 80 }]);
    await expect(agendar(thor, "2026-10-07 09:30-03", 60, [{ servico: banho, nome: "Banho", preco: 80 }])).rejects.toThrow(/atendimentos_sem_conflito/);
  });

  it("cancelado libera o horário", async () => {
    const id = await agendar(luna, "2026-10-08 10:00-03", 60, [{ servico: banho, nome: "Banho", preco: 50 }]);
    await status(id, "cancelado");
    await expect(agendar(thor, "2026-10-08 10:00-03", 60, [{ servico: banho, nome: "Banho", preco: 80 }])).resolves.toBeTypeOf("string");
  });

  it("não pula etapas", async () => {
    const id = await agendar(luna, "2026-10-09 08:00-03", 60, [{ servico: banho, nome: "Banho", preco: 50 }]);
    await expect(status(id, "finalizado")).rejects.toThrow(/Não é possível passar de agendado para finalizado/);
  });

  it("finalizar com plano: baixa 1 uso, sem receita, pago, comissão e última visita", async () => {
    const id = await agendar(thor, "2026-10-06 10:00-03", 60, [{ servico: banho, nome: "Banho", preco: 80, coberto: true }], plano);
    await como(U_BRUNO, async () => {
      await status(id, "em_atendimento");
      await status(id, "finalizado");
    });
    expect((await um<{ s: number }>(`select saldo_plano($1) as s`, [plano])).s).toBe(1);
    expect((await um<{ n: number }>(`select count(*)::int as n from lancamentos where atendimento_id = $1`, [id])).n).toBe(0);
    expect((await um<{ pago: boolean }>(`select pago from atendimentos where id = $1`, [id])).pago).toBe(true);
    expect(Number((await um<{ valor: string }>(`select valor from comissoes c join atendimento_itens i on i.id = c.atendimento_item_id where i.atendimento_id = $1`, [id])).valor)).toBe(32);
    expect(String((await um<{ u: Date }>(`select ultima_visita as u from pets where id = $1`, [thor])).u.toISOString().slice(0, 10))).toBe("2026-10-06");
    const evs = (await db.query<{ para: string }>(`select para from atendimento_eventos where atendimento_id = $1 order by id`, [id])).rows.map((r) => r.para);
    expect(evs).toEqual(["agendado", "em_atendimento", "finalizado"]);
  });

  it("último uso encerra o plano", async () => {
    const id = await agendar(thor, "2026-10-12 10:00-03", 60, [{ servico: banho, nome: "Banho", preco: 80, coberto: true }], plano);
    await status(id, "em_atendimento");
    await status(id, "finalizado");
    const p = await um<{ status: string; saldo: number; status_efetivo: string }>(`select status, saldo, status_efetivo from planos_pet_saldo where id = $1`, [plano]);
    expect(p).toMatchObject({ status: "finalizado", saldo: 0, status_efetivo: "finalizado" });
  });

  it("finalizar sem plano: receita pendente; pagar marca o atendimento e fecha o caixa", async () => {
    const id = await agendar(luna, "2026-10-13 09:00-03", 60, [{ servico: banhoTosa, nome: "Banho e tosa", preco: 80 }]);
    await status(id, "em_atendimento");
    await status(id, "finalizado");
    const l = await um<{ id: string; valor: string; status: string; competencia: Date }>(`select * from lancamentos where atendimento_id = $1`, [id]);
    expect(l.status).toBe("pendente");
    expect(Number(l.valor)).toBe(80);

    await como(U_ANA, () => db.query(`update lancamentos set status = 'pago', forma_pagamento = 'pix', pago_em = '2026-10-13 10:30-03' where id = $1`, [l.id]));
    expect((await um<{ pago: boolean }>(`select pago from atendimentos where id = $1`, [id])).pago).toBe(true);

    const cx = await como(U_ANA, () => um<{ entradas: string; saldo_final: string }>(`select * from fechar_caixa($1, '2026-10-13')`, [A]));
    expect(Number(cx.entradas)).toBe(80);
    expect(Number(cx.saldo_final)).toBe(80);
  });

  it("banhista não vê o financeiro nem fecha caixa", async () => {
    const n = await como(U_BRUNO, async () => (await db.query(`select * from lancamentos`)).rows.length);
    expect(n).toBe(0);
    await expect(como(U_BRUNO, () => db.query(`select fechar_caixa($1, '2026-10-14')`, [A]))).rejects.toThrow(/Sem permissão/);
    const minhas = await como(U_BRUNO, async () => (await db.query(`select * from comissoes`)).rows.length);
    expect(minhas).toBeGreaterThan(0);
  });

  it("vender_plano cria plano e receita paga; estorno reabre plano encerrado", async () => {
    const tutor = (await um<{ tutor_id: string }>(`select tutor_id from pets where id = $1`, [thor])).tutor_id;
    const plano2 = {
      id: "33333333-3333-4333-8333-333333333333", petshop_id: A, nome: "Pacote 2 banhos", pet_id: thor, tutor_id: tutor,
      servico_ids: [banho], total_usos: 1, preco: 130, inicio: "2026-10-14", vencimento: "2026-11-13",
    };
    const lanc = {
      id: "44444444-4444-4444-8444-444444444444", petshop_id: A, tipo: "receita", categoria: "Planos", descricao: "Venda de plano · Thor",
      valor: 130, forma_pagamento: "pix", status: "pago", competencia: "2026-10-14", pago_em: "2026-10-14T09:00:00-03:00",
    };
    await como(U_ANA, () => db.query(`select vender_plano($1::jsonb, $2::jsonb)`, [JSON.stringify(plano2), JSON.stringify(lanc)]));
    const l = await um<{ plano_pet_id: string; status: string }>(`select plano_pet_id, status from lancamentos where id = $1`, [lanc.id]);
    expect(l).toEqual({ plano_pet_id: plano2.id, status: "pago" });

    const uso = (await como(U_ANA, () => um<{ id: string }>(`insert into plano_usos (petshop_id, plano_pet_id) values ($1, $2) returning id`, [A, plano2.id]))).id;
    expect((await um<{ status: string }>(`select status from planos_pet where id = $1`, [plano2.id])).status).toBe("finalizado");
    await como(U_ANA, () => db.query(`update plano_usos set estornado = true where id = $1`, [uso]));
    expect((await um<{ status: string }>(`select status from planos_pet where id = $1`, [plano2.id])).status).toBe("ativo");
  });

  it("comissão: % da pessoa vale sobre a % do serviço", async () => {
    const comissao = async (id: string) =>
      Number((await um<{ v: string }>(`select sum(valor) as v from comissoes c join atendimento_itens i on i.id = c.atendimento_item_id where i.atendimento_id = $1`, [id])).v);
    await db.query(`update membros set comissao_pct = 50 where id = $1`, [bruno]);
    const comPct = await agendar(luna, "2026-10-15 09:00-03", 60, [{ servico: banhoTosa, nome: "Banho e tosa", preco: 80 }]);
    await status(comPct, "em_atendimento");
    await status(comPct, "finalizado");
    expect(await comissao(comPct)).toBe(40);

    await db.query(`update membros set comissao_pct = 0 where id = $1`, [bruno]);
    const pelaTabela = await agendar(luna, "2026-10-16 09:00-03", 60, [{ servico: banhoTosa, nome: "Banho e tosa", preco: 80 }]);
    await status(pelaTabela, "em_atendimento");
    await status(pelaTabela, "finalizado");
    expect(await comissao(pelaTabela)).toBe(32);
  });

  it("convite: só o dono gera; a pessoa entra com o papel combinado e o código some", async () => {
    const camila = (await um<{ id: string }>(`insert into membros (petshop_id, nome, papel) values ($1, 'Camila', 'banhista') returning id`, [A])).id;
    await expect(como(U_BRUNO, () => db.query(`select gerar_convite($1)`, [camila]))).rejects.toThrow(/Só o dono/);
    await expect(como(U_OUTRO, () => db.query(`select gerar_convite($1)`, [camila]))).rejects.toThrow(/Só o dono/);

    const conv = await como(U_ANA, () => um<{ codigo: string; petshop_id: string }>(`select * from gerar_convite($1)`, [camila]));
    expect(conv.codigo).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
    expect(conv.petshop_id).toBe(A);
    const renovado = await como(U_ANA, () => um<{ codigo: string }>(`select * from gerar_convite($1)`, [camila]));
    expect((await um<{ n: number }>(`select count(*)::int as n from convites where membro_id = $1`, [camila])).n).toBe(1);

    // Só o dono lê os códigos; quem ainda não entrou não vê nada do pet shop.
    expect(await como(U_BRUNO, async () => (await db.query(`select * from convites`)).rows.length)).toBe(0);
    expect(await como(U_ANA, async () => (await db.query(`select * from convites`)).rows.length)).toBe(1);
    expect(await como(U_NOVA, async () => (await db.query(`select * from tutores`)).rows.length)).toBe(0);

    await expect(como(U_NOVA, () => db.query(`select aceitar_convite('ZZZZZZ')`))).rejects.toThrow(/inválido ou vencido/);
    await expect(como(U_NOVA, () => db.query(`select aceitar_convite($1)`, [conv.codigo]))).rejects.toThrow(/inválido ou vencido/); // o antigo foi trocado
    const digitado = `${renovado.codigo.slice(0, 3).toLowerCase()}-${renovado.codigo.slice(3)}`;
    const ps = await como(U_NOVA, () => um<{ ps: string }>(`select aceitar_convite($1) as ps`, [digitado]));
    expect(ps.ps).toBe(A);
    expect(await um(`select user_id, papel from membros where id = $1`, [camila])).toEqual({ user_id: U_NOVA, papel: "banhista" });
    expect(await como(U_NOVA, async () => (await db.query(`select * from tutores`)).rows.length)).toBe(2);
    expect(await como(U_NOVA, async () => (await db.query(`select * from lancamentos`)).rows.length)).toBe(0);
    expect(await um(`select usado_por from convites where membro_id = $1`, [camila])).toEqual({ usado_por: U_NOVA });
    expect((await um<{ n: number }>(`select count(*)::int as n from convites where usado_em is null and membro_id = $1`, [camila])).n).toBe(0);

    await expect(como(U_NOVA, () => db.query(`select aceitar_convite($1)`, [renovado.codigo]))).rejects.toThrow(/inválido ou vencido/);
    await expect(como(U_ANA, () => db.query(`select gerar_convite($1)`, [camila]))).rejects.toThrow(/já entra no app/);
  });

  it("convite vencido não vale", async () => {
    const rita = (await um<{ id: string }>(`insert into membros (petshop_id, nome, papel) values ($1, 'Rita', 'recepcao') returning id`, [A])).id;
    const conv = await como(U_ANA, () => um<{ codigo: string }>(`select * from gerar_convite($1)`, [rita]));
    await db.query(`update convites set expira_em = now() - interval '1 minute' where codigo = $1`, [conv.codigo]);
    await expect(como(U_OUTRO, () => db.query(`select aceitar_convite($1)`, [conv.codigo]))).rejects.toThrow(/inválido ou vencido/);
  });

  it("um pet só tem um plano ativo", async () => {
    const tutor = (await um<{ tutor_id: string }>(`select tutor_id from pets where id = $1`, [luna])).tutor_id;
    const ins = () =>
      db.query(
        `insert into planos_pet (petshop_id, nome, pet_id, tutor_id, servico_ids, total_usos, preco, inicio, vencimento) values ($1, 'P', $2, $3, array[$4]::uuid[], 4, 200, current_date, current_date + 30)`,
        [A, luna, tutor, banho],
      );
    await ins();
    await expect(ins()).rejects.toThrow(/planos_pet_um_ativo/);
  });
});
