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
    create role service_role nologin;
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
  // Stub do Supabase Storage (buckets, objects e foldername) para as policies das fotos.
  await db.exec(`
    create schema storage;
    create table storage.buckets (id text primary key, name text not null, public boolean not null default false);
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets, name text not null, owner uuid);
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as $$
      select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
    $$;
    grant usage on schema storage to authenticated, anon;
    grant all on storage.objects, storage.buckets to authenticated, anon;
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

  // -------------------------------------------------------------------------
  // 0007: acompanhamento, etapas com foto, leva e traz, acerto de comissões
  // -------------------------------------------------------------------------

  const anon = async <T,>(fn: () => Promise<T>): Promise<T> => {
    await db.exec(`set role anon;`);
    try {
      return await fn();
    } finally {
      await db.exec(`reset role;`);
    }
  };

  it("atendimento nasce com token e o tutor vê a linha do tempo sem login", async () => {
    const id = await agendar(thor, "2026-10-20 14:00-03", 60, [{ servico: banho, nome: "Banho", preco: 80 }]);
    const { token } = await um<{ token: string }>(`select token from atendimentos where id = $1`, [id]);
    expect(token).toMatch(/^[0-9a-f]{32}$/);

    await como(U_BRUNO, async () => {
      await status(id, "em_atendimento");
      await db.query(`insert into atendimento_etapas (petshop_id, atendimento_id, etapa, foto_path, nota) values ($1, $2, 'banho', $3, 'Espuma até as orelhas')`, [A, id, `${A}/etapas/${id}/x.webp`]);
    });
    const e = await um<{ membro_id: string }>(`select membro_id from atendimento_etapas where atendimento_id = $1`, [id]);
    expect(e.membro_id).toBe(bruno); // quem registrou, preenchido pelo banco

    const visto = await anon(() => um<{ a: Record<string, unknown> }>(`select acompanhamento($1) as a`, [token]));
    const a = visto.a as { pet: { nome: string }; petshop: { nome: string }; atendimento: { status: string; itens: string[] }; etapas: { etapa: string; nota: string }[]; eventos: { para: string }[]; em_rota: boolean };
    expect(a.pet.nome).toBe("Thor");
    expect(a.petshop.nome).toBe("Patinhas");
    expect(a.atendimento.status).toBe("em_atendimento");
    expect(a.atendimento.itens).toEqual(["Banho"]);
    expect(a.etapas.map((x) => x.etapa)).toEqual(["banho"]);
    expect(a.eventos.map((x) => x.para)).toEqual(["agendado", "em_atendimento"]);
    expect(a.em_rota).toBe(false);

    expect((await anon(() => um<{ a: unknown }>(`select acompanhamento('nao-existe') as a`))).a).toBeNull();
    // Sem o token, anon não lê nada.
    expect(await anon(async () => (await db.query(`select * from atendimento_etapas`)).rows.length)).toBe(0);
  });

  it("leva e traz: etapas na ordem certa, GPS só na rua e tudo no link do tutor", async () => {
    const tutor = (await um<{ tutor_id: string }>(`select tutor_id from pets where id = $1`, [luna])).tutor_id;
    const diego = (await um<{ id: string }>(`insert into membros (petshop_id, nome, papel) values ($1, 'Diego', 'motorista') returning id`, [A])).id;
    await expect(
      db.query(`insert into atendimentos (petshop_id, pet_id, tutor_id, profissional_id, inicio, fim, valor_total, transporte) values ($1, $2, $3, $4, '2026-10-21 09:00-03', '2026-10-21 10:00-03', 50, 'busca')`, [A, luna, tutor, bruno]),
    ).rejects.toThrow(/atendimentos_transporte_endereco/);
    const id = (
      await um<{ id: string }>(
        `insert into atendimentos (petshop_id, pet_id, tutor_id, profissional_id, inicio, fim, valor_total, transporte, endereco_transporte, motorista_id)
         values ($1, $2, $3, $4, '2026-10-21 09:00-03', '2026-10-21 10:00-03', 50, 'busca_e_entrega', 'Rua das Acácias, 120', $5) returning id`,
        [A, luna, tutor, bruno, diego],
      )
    ).id;
    await db.query(`insert into atendimento_itens (petshop_id, atendimento_id, servico_id, nome, preco, duracao_min) values ($1, $2, $3, 'Banho', 50, 60)`, [A, id, banho]);
    const etapa = (e: string) => db.query(`insert into atendimento_etapas (petshop_id, atendimento_id, etapa) values ($1, $2, $3)`, [A, id, e]);
    const posicao = () => db.query(`insert into rota_posicoes (petshop_id, atendimento_id, lat, lng, precisao) values ($1, $2, -23.6, -46.47, 12)`, [A, id]);

    await expect(posicao()).rejects.toThrow(/não está ativo/);
    await expect(etapa("pet_buscado")).rejects.toThrow(/fora de ordem/);
    await etapa("saiu_para_buscar");
    await posicao();
    expect((await um<{ r: boolean }>(`select em_rota($1) as r`, [id])).r).toBe(true);
    await etapa("pet_buscado");
    expect((await um<{ r: boolean }>(`select em_rota($1) as r`, [id])).r).toBe(false);
    await expect(etapa("saiu_para_entregar")).rejects.toThrow(/fora de ordem/); // só depois de pronto
    await status(id, "em_atendimento");
    await status(id, "finalizado");
    await etapa("saiu_para_entregar");
    await posicao();
    const { token } = await um<{ token: string }>(`select token from atendimentos where id = $1`, [id]);
    const a = (await anon(() => um<{ a: Record<string, unknown> }>(`select acompanhamento($1) as a`, [token]))).a as {
      em_rota: boolean; posicao: { lat: number; lng: number }; atendimento: { transporte: string; motorista: string; endereco: string };
    };
    expect(a.em_rota).toBe(true);
    expect(a.posicao.lat).toBeCloseTo(-23.6);
    expect(a.atendimento).toMatchObject({ transporte: "busca_e_entrega", motorista: "Diego", endereco: "Rua das Acácias, 120" });
    await etapa("entregue");
    await expect(etapa("entregue")).rejects.toThrow(/fora de ordem/);
    expect((await anon(() => um<{ a: { posicao: unknown } }>(`select acompanhamento($1) as a`, [token]))).a.posicao).toBeNull();
  });

  it("motorista vê a operação, não vê dinheiro", async () => {
    const U_DIEGO = "00000000-0000-0000-0000-00000000000e";
    await db.query(`insert into auth.users values ($1, 'diego@patinhas.com')`, [U_DIEGO]);
    await db.query(`insert into membros (petshop_id, user_id, nome, papel) values ($1, $2, 'Diego Motorista', 'motorista')`, [A, U_DIEGO]);
    expect(await como(U_DIEGO, async () => (await db.query(`select * from atendimentos`)).rows.length)).toBeGreaterThan(0);
    expect(await como(U_DIEGO, async () => (await db.query(`select * from lancamentos`)).rows.length)).toBe(0);
    expect(await como(U_DIEGO, async () => (await db.query(`select * from comissoes`)).rows.length)).toBe(0);
  });

  it("acerto de comissões: só o dono; marca pagas, lança a despesa e fecha o período", async () => {
    const pendente = async () => Number((await um<{ v: string }>(`select coalesce(sum(valor), 0) as v from comissoes where membro_id = $1 and status = 'a_pagar'`, [bruno])).v);
    const antes = await pendente();
    expect(antes).toBeGreaterThan(0);
    await expect(como(U_BRUNO, () => db.query(`select registrar_acerto($1, '2026-12-31', 'pix')`, [bruno]))).rejects.toThrow(/Só o dono/);
    await expect(como(U_OUTRO, () => db.query(`select registrar_acerto($1, '2026-12-31', 'pix')`, [bruno]))).rejects.toThrow(/Só o dono/);

    const ac = await como(U_ANA, () => um<{ valor: string; lancamento_id: string; de: Date; ate: Date }>(`select * from registrar_acerto($1, '2026-12-31', 'pix')`, [bruno]));
    expect(Number(ac.valor)).toBe(antes);
    expect(await pendente()).toBe(0);
    const l = await um<{ tipo: string; categoria: string; status: string; valor: string }>(`select tipo, categoria, status, valor from lancamentos where id = $1`, [ac.lancamento_id]);
    expect(l).toMatchObject({ tipo: "despesa", categoria: "Comissões", status: "pago" });
    expect(Number(l.valor)).toBe(antes);
    await expect(como(U_ANA, () => db.query(`select registrar_acerto($1, '2026-12-31', 'pix')`, [bruno]))).rejects.toThrow(/Não há comissão pendente/);
    // O banhista vê o próprio acerto; a recepção não.
    expect(await como(U_BRUNO, async () => (await db.query(`select * from comissao_acertos`)).rows.length)).toBe(1);
  });

  it("fotos: a equipe grava e lista só a pasta do próprio pet shop; de fora ninguém lista", async () => {
    await como(U_ANA, () => db.query(`insert into storage.objects (bucket_id, name) values ('fotos', $1)`, [`${A}/pets/abc.jpg`]));
    await expect(como(U_OUTRO, () => db.query(`insert into storage.objects (bucket_id, name) values ('fotos', $1)`, [`${A}/pets/intruso.jpg`]))).rejects.toThrow(/row-level security/);
    await expect(anon(() => db.query(`insert into storage.objects (bucket_id, name) values ('fotos', $1)`, [`${A}/pets/anon.jpg`]))).rejects.toThrow(/row-level security/);
    expect(await como(U_ANA, async () => (await db.query(`select name from storage.objects where bucket_id = 'fotos'`)).rows.length)).toBe(1);
    expect(await como(U_OUTRO, async () => (await db.query(`select name from storage.objects where bucket_id = 'fotos'`)).rows.length)).toBe(0);
    expect(await anon(async () => (await db.query(`select name from storage.objects where bucket_id = 'fotos'`)).rows.length)).toBe(0);
  });

  // -------------------------------------------------------------------------
  // 0010: assinatura (teste grátis + Asaas), painel do administrador e termos
  // -------------------------------------------------------------------------

  const servico = async <T,>(fn: () => Promise<T>): Promise<T> => {
    await db.exec(`set role service_role;`);
    try {
      return await fn();
    } finally {
      await db.exec(`reset role;`);
    }
  };
  const vencerTeste = (ps: string) => db.query(`update assinaturas set teste_ate = now() - interval '1 day' where petshop_id = $1`, [ps]);
  const minha = <T = Record<string, unknown>>(user: string, ps: string) =>
    como(user, async () => (await um<{ a: T }>(`select minha_assinatura($1) as a`, [ps])).a);

  it("pet shop nasce com 14 dias de teste, R$ 49 e o aceite dos termos", async () => {
    const U_NOVO = "00000000-0000-0000-0000-0000000000f1";
    await db.query(`insert into auth.users values ($1, 'novo@pet.com')`, [U_NOVO]);
    const C = (await como(U_NOVO, () => um<{ id: string }>(`select id from criar_petshop('Novo Pet', 'novo-pet', null, 'Rita')`))).id;
    await como(U_NOVO, () => db.query(`select aceitar_termos($1, '2026-10')`, [C]));
    const a = await um<{ status: string; valor: string; dias: number }>(
      `select status, valor, round(extract(epoch from teste_ate - now()) / 86400)::int as dias from assinaturas where petshop_id = $1`, [C]);
    expect(a).toEqual({ status: "trial", valor: "49.00", dias: 14 });
    const p = await um<{ termos_versao: string; termos_aceitos_por: string }>(`select termos_versao, termos_aceitos_por from petshops where id = $1`, [C]);
    expect(p).toEqual({ termos_versao: "2026-10", termos_aceitos_por: U_NOVO });
    const m = await minha<{ liberado: boolean; status: string; dono: boolean; pagamentos: unknown[] }>(U_NOVO, C);
    expect(m).toMatchObject({ liberado: true, status: "trial", dono: true, pagamentos: [] });
    // Os pet shops dos testes anteriores também ganharam a assinatura.
    expect((await um<{ n: number }>(`select count(*)::int as n from assinaturas where petshop_id in ($1, $2)`, [A, B])).n).toBe(2);
  });

  it("teste vencido fecha a operação; dono e equipe ainda veem o pet shop e a situação", async () => {
    await vencerTeste(B);
    expect(await como(U_OUTRO, async () => (await db.query(`select * from tutores`)).rows.length)).toBe(0);
    expect(await como(U_OUTRO, async () => (await db.query(`select * from petshops`)).rows.length)).toBe(1);
    await expect(como(U_OUTRO, () => db.query(`insert into tutores (petshop_id, nome, whatsapp) values ($1, 'X', '5511900000000')`, [B]))).rejects.toThrow(/row-level security/);
    expect(await minha(U_OUTRO, B)).toMatchObject({ liberado: false, status: "trial", dono: true });

    // Banhista do pet shop A bloqueado: sabe que está suspenso, não vê dados de cobrança.
    await vencerTeste(A);
    const b = await minha<Record<string, unknown>>(U_BRUNO, A);
    expect(b).toMatchObject({ liberado: false, dono: false });
    expect(b).not.toHaveProperty("documento");
    expect(b).not.toHaveProperty("pagamentos");
    expect(await como(U_BRUNO, async () => (await db.query(`select * from atendimentos`)).rows.length)).toBe(0);
    await expect(como(U_ANA, () => db.query(`select fechar_caixa($1, current_date)`, [A]))).rejects.toThrow(/Sem permissão/);
    await expect(minha(U_OUTRO, A)).rejects.toThrow(/Sem acesso/);
    await db.query(`update assinaturas set teste_ate = now() + interval '14 days' where petshop_id = $1`, [A]);
    expect(await como(U_BRUNO, async () => (await db.query(`select * from atendimentos`)).rows.length)).toBeGreaterThan(0);
  });

  it("Asaas: pagamento libera, atraso marca, estorno volta, repetido é ignorado e cancelamento fica registrado", async () => {
    await db.query(`update assinaturas set asaas_customer_id = 'cus_1', asaas_subscription_id = 'sub_1' where petshop_id = $1`, [B]);
    const hoje = (await um<{ d: string }>(`select to_char(current_date, 'YYYY-MM-DD') as d`)).d;
    const evento = (id: string, event: string, status: string, extra: Record<string, unknown> = {}) => ({
      id, event, dateCreated: "2026-10-09 10:00:00",
      payment: { object: "payment", id: "pay_1", customer: "cus_1", subscription: "sub_1", value: 49, dueDate: hoje, status, billingType: "PIX", invoiceUrl: "https://sandbox.asaas.com/i/1", campoNovo: true, ...extra },
    });
    const processar = (e: unknown) => servico(async () => (await um<{ r: string }>(`select asaas_processar_evento($1::jsonb) as r`, [JSON.stringify(e)])).r);

    await expect(como(U_OUTRO, () => db.query(`select asaas_processar_evento('{}'::jsonb)`))).rejects.toThrow(/permission denied/);

    expect(await processar(evento("evt_1", "PAYMENT_CREATED", "PENDING"))).toBe("ok");
    expect(await minha(U_OUTRO, B)).toMatchObject({ liberado: false });

    expect(await processar(evento("evt_2", "PAYMENT_RECEIVED", "RECEIVED", { paymentDate: hoje }))).toBe("ok");
    expect(await processar(evento("evt_2", "PAYMENT_RECEIVED", "RECEIVED"))).toBe("repetido");
    const pago = await minha<{ liberado: boolean; status: string; pago_ate: string; pagamentos: { status: string; link: string; pago_em: string }[] }>(U_OUTRO, B);
    expect(pago).toMatchObject({ liberado: true, status: "ativa", assinada: true });
    expect(pago.pago_ate).toBe((await um<{ d: string }>(`select to_char(current_date + interval '1 month', 'YYYY-MM-DD') as d`)).d);
    expect(pago.pagamentos).toEqual([expect.objectContaining({ status: "RECEIVED", link: "https://sandbox.asaas.com/i/1", pago_em: hoje })]);
    expect(await como(U_OUTRO, async () => (await db.query(`select * from tutores`)).rows.length)).toBe(1);

    expect(await processar(evento("evt_3", "PAYMENT_REFUNDED", "REFUNDED"))).toBe("ok");
    expect(await minha(U_OUTRO, B)).toMatchObject({ liberado: false, pago_ate: null });

    expect(await processar({ ...evento("evt_4", "PAYMENT_OVERDUE", "OVERDUE"), payment: { ...evento("", "", "OVERDUE").payment, id: "pay_2" } })).toBe("ok");
    expect(await minha(U_OUTRO, B)).toMatchObject({ status: "inadimplente" });

    expect(await processar({ ...evento("evt_4b", "PAYMENT_DELETED", "PENDING"), payment: { ...evento("", "", "PENDING").payment, id: "pay_2" } })).toBe("ok");
    expect((await minha<{ pagamentos: { id: string }[] }>(U_OUTRO, B)).pagamentos.map((p) => p.id)).toEqual(["pay_1"]);

    expect(await processar({ id: "evt_5", event: "SUBSCRIPTION_DELETED", subscription: { object: "subscription", id: "sub_1" } })).toBe("ok");
    expect(await minha(U_OUTRO, B)).toMatchObject({ status: "cancelada", assinada: false });
    expect(await processar({ id: "evt_6", event: "PAYMENT_RECEIVED", payment: { id: "pay_x", subscription: "sub_de_outro_sistema" } })).toBe("ignorado");
    // Cobrança de outro negócio na mesma conta do Asaas: não fica guardada (0014).
    expect((await um<{ n: number }>(`select count(*)::int as n from asaas_eventos`)).n).toBe(6);
    expect((await um<{ n: number }>(`select count(*)::int as n from asaas_eventos where id = 'evt_6'`)).n).toBe(0);
  });

  it("painel do administrador: só o admin lista e ajusta", async () => {
    const U_ADMIN = "00000000-0000-0000-0000-0000000000ad";
    await db.query(`insert into auth.users values ($1, 'victor@app.com')`, [U_ADMIN]);
    expect(await como(U_ANA, async () => (await um<{ s: boolean }>(`select sou_admin() as s`)).s)).toBe(false);
    await expect(como(U_ANA, () => db.query(`select admin_petshops()`))).rejects.toThrow(/Só o administrador/);
    await expect(como(U_ANA, () => db.query(`select admin_ajustar_assinatura($1, 'liberar', 30)`, [B]))).rejects.toThrow(/Só o administrador/);
    expect(await como(U_ANA, async () => (await db.query(`select * from plataforma_admins`)).rows.length)).toBe(0);

    await db.query(`insert into plataforma_admins (user_id) values ($1)`, [U_ADMIN]);
    const lista = await como(U_ADMIN, async () => (await um<{ l: { id: string; nome: string; email: string; liberado: boolean; clientes: number; atendimentos_30d: number }[] }>(`select admin_petshops() as l`)).l);
    const a = lista.find((x) => x.id === A)!;
    expect(a).toMatchObject({ nome: "Patinhas", email: "ana@patinhas.com", liberado: true, clientes: 2 });
    expect(lista.find((x) => x.id === B)).toMatchObject({ liberado: false });

    const ajustar = (acao: string, valor: number | null = null) => como(U_ADMIN, () => db.query(`select admin_ajustar_assinatura($1, $2, $3)`, [B, acao, valor]));
    await ajustar("liberar", 30);
    expect(await minha(U_OUTRO, B)).toMatchObject({ liberado: true });
    await ajustar("bloquear");
    expect(await minha(U_OUTRO, B)).toMatchObject({ liberado: false, status: "bloqueada" });
    await ajustar("desbloquear");
    expect(await minha(U_OUTRO, B)).toMatchObject({ liberado: true, status: "cancelada" });
    await ajustar("valor", 39.9);
    expect(await minha(U_OUTRO, B)).toMatchObject({ valor: 39.9 });
    await db.query(`update assinaturas set liberado_ate = null where petshop_id = $1`, [B]);
    await ajustar("estender_teste", 7);
    expect(await minha(U_OUTRO, B)).toMatchObject({ liberado: true, status: "trial" });
    await expect(ajustar("apagar")).rejects.toThrow(/Ação desconhecida/);
  });

  it("termos: só o dono aceita pelo pet shop", async () => {
    await expect(como(U_BRUNO, () => db.query(`select aceitar_termos($1, '2026-10')`, [A]))).rejects.toThrow(/Só o dono/);
    await como(U_ANA, () => db.query(`select aceitar_termos($1, '2026-10')`, [A]));
    expect((await um<{ v: string }>(`select termos_versao as v from petshops where id = $1`, [A])).v).toBe("2026-10");
  });

  // -------------------------------------------------------------------------
  // 0011: produtos e estoque, vacinas, fidelidade, agendamento online, sinal e correções
  // -------------------------------------------------------------------------

  it("venda de produto: receita no caixa, itens e baixa no estoque; banhista não vende", async () => {
    const shampoo = (await um<{ id: string }>(`insert into produtos (petshop_id, nome, categoria, preco_venda, estoque_minimo) values ($1, 'Shampoo neutro', 'Higiene', 39.9, 2) returning id`, [A])).id;
    await como(U_ANA, () => db.query(`select registrar_entrada_estoque($1::jsonb, $2::jsonb)`, [
      JSON.stringify({ petshop_id: A, produto_id: shampoo, quantidade: 10, custo_unitario: 18 }),
      JSON.stringify({ petshop_id: A, tipo: "despesa", categoria: "Compra de produtos", descricao: "Shampoo x10", valor: 180, forma_pagamento: "pix", status: "pago", competencia: "2026-10-09", pago_em: "2026-10-09T12:00:00Z" }),
    ]));
    expect(await um(`select estoque::int as estoque, custo::float as custo from produtos where id = $1`, [shampoo])).toEqual({ estoque: 10, custo: 18 });

    const venda = await como(U_ANA, () => um<{ v: string }>(`select registrar_venda($1::jsonb, $2::jsonb, $3::jsonb) as v`, [
      JSON.stringify({ petshop_id: A, total: 79.8, status: "pago", forma_pagamento: "dinheiro" }),
      JSON.stringify([{ produto_id: shampoo, nome: "Shampoo neutro", quantidade: 2, preco: 39.9 }]),
      JSON.stringify({ petshop_id: A, tipo: "receita", categoria: "Produtos", descricao: "Venda: Shampoo neutro x2", valor: 79.8, forma_pagamento: "dinheiro", status: "pago", competencia: "2026-10-09", pago_em: "2026-10-09T13:00:00Z" }),
    ]));
    expect(await um(`select estoque::int as estoque from produtos where id = $1`, [shampoo])).toEqual({ estoque: 8 });
    const v = await um<{ total: string; lancamento_id: string; membro_id: string }>(`select total, lancamento_id, membro_id from vendas where id = $1`, [venda.v]);
    expect(Number(v.total)).toBe(79.8);
    expect(v.lancamento_id).toBeTruthy();
    expect((await um<{ n: number }>(`select count(*)::int as n from estoque_movimentos where produto_id = $1`, [shampoo])).n).toBe(2);

    await expect(como(U_BRUNO, () => db.query(`select registrar_venda($1::jsonb, '[]'::jsonb, null)`, [JSON.stringify({ petshop_id: A, total: 1 })]))).rejects.toThrow(/row-level security/);
    expect(await como(U_BRUNO, async () => (await db.query(`select * from produtos`)).rows.length)).toBeGreaterThan(0); // vê o catálogo
    await expect(como(U_BRUNO, () => db.query(`update produtos set preco_venda = 1 where id = $1`, [shampoo]))).resolves.toMatchObject({ affectedRows: 0 });
  });

  it("plano vencido com saldo não trava a venda de um plano novo", async () => {
    const tutor = (await um<{ tutor_id: string }>(`select tutor_id from pets where id = $1`, [luna])).tutor_id;
    await db.query(`update planos_pet set status = 'cancelado' where pet_id = $1 and status = 'ativo'`, [luna]);
    const velho = (await um<{ id: string }>(
      `insert into planos_pet (petshop_id, nome, pet_id, tutor_id, servico_ids, total_usos, preco, inicio, vencimento) values ($1, 'Antigo', $2, $3, array[$4]::uuid[], 4, 200, current_date - 60, current_date - 30) returning id`,
      [A, luna, tutor, banho],
    )).id;
    await como(U_ANA, () => db.query(`select vender_plano($1::jsonb, $2::jsonb)`, [
      JSON.stringify({ id: "00000000-0000-0000-0000-0000000000e1", petshop_id: A, nome: "Novo", pet_id: luna, tutor_id: tutor, servico_ids: [banho], total_usos: 4, preco: 200, inicio: "2026-10-09", vencimento: "2026-11-08" }),
      JSON.stringify({ id: "00000000-0000-0000-0000-0000000000e2", petshop_id: A, tipo: "receita", categoria: "Planos", descricao: "Novo", valor: 200, forma_pagamento: "pix", status: "pago", competencia: "2026-10-09", pago_em: "2026-10-09T12:00:00Z" }),
    ]));
    expect((await um<{ status: string }>(`select status from planos_pet where id = $1`, [velho])).status).toBe("vencido");
    expect((await um<{ n: number }>(`select count(*)::int as n from planos_pet where pet_id = $1 and status = 'ativo'`, [luna])).n).toBe(1);
  });

  it("finalizar: desconta o sinal pago e quem é 'sem comissão' não recebe", async () => {
    await db.query(`update membros set sem_comissao = true where id = $1`, [bruno]);
    const id = await agendar(thor, "2026-10-25 09:00-03", 60, [{ servico: banho, nome: "Banho", preco: 100 }]);
    await db.query(`update atendimentos set sinal_valor = 30, sinal_pago = true where id = $1`, [id]);
    await status(id, "em_atendimento");
    await status(id, "finalizado");
    const r = await um<{ valor: string }>(`select valor from lancamentos where atendimento_id = $1 and categoria = 'Serviços'`, [id]);
    expect(Number(r.valor)).toBe(70);
    expect((await um<{ n: number }>(`select count(*)::int as n from comissoes c join atendimento_itens i on i.id = c.atendimento_item_id where i.atendimento_id = $1`, [id])).n).toBe(0);
    await db.query(`update membros set sem_comissao = false where id = $1`, [bruno]);
  });

  it("fidelidade: conta selos e zera depois do resgate; o tutor vê no link", async () => {
    await db.query(`update petshops set fidelidade_ativa = true, fidelidade_meta = 5 where id = $1`, [A]);
    const selos = async () => (await um<{ s: number }>(`select fidelidade_selos($1) as s`, [thor])).s;
    const antes = await selos();
    expect(antes).toBeGreaterThan(0);
    const id = await agendar(thor, "2026-10-26 09:00-03", 60, [{ servico: banho, nome: "Banho", preco: 80 }]);
    await status(id, "em_atendimento");
    await status(id, "finalizado");
    expect(await selos()).toBe(antes + 1);
    const { token } = await um<{ token: string }>(`select token from atendimentos where id = $1`, [id]);
    const a = (await anon(() => um<{ a: { fidelidade: { meta: number; selos: number } } }>(`select acompanhamento($1) as a`, [token]))).a;
    expect(a.fidelidade).toMatchObject({ meta: 5, selos: antes + 1 });
    await db.query(`insert into fidelidade_resgates (petshop_id, pet_id, em) values ($1, $2, '2026-10-27 12:00-03')`, [A, thor]);
    expect(await selos()).toBe(0);
  });

  it("agendamento online: anon vê horários, agenda com sinal, cria tutor e pet; limites e desligado", async () => {
    await db.query(`insert into servico_precos (petshop_id, servico_id, porte, preco, duracao_min) values ($1, $2, 'P', 50, 60), ($1, $2, 'M', 60, 60), ($1, $2, 'G', 80, 60), ($1, $2, 'GG', 100, 60) on conflict do nothing`, [A, banho]);
    await db.query(`update petshops set slug = 'patinhas', agendamento_online = false, pix_chave = 'pix@patinhas.com', pix_cidade = 'SAO PAULO', sinal_pct = 20, dias_abertos = '{0,1,2,3,4,5,6}', abre = '08:00', fecha = '18:00' where id = $1`, [A]);
    expect((await anon(() => um<{ a: unknown }>(`select agenda_publica('patinhas') as a`))).a).toBeNull();
    await db.query(`update petshops set agendamento_online = true where id = $1`, [A]);
    const ag = (await anon(() => um<{ a: { petshop: { nome: string; sinal_pct: number }; servicos: { nome: string; precos: Record<string, { preco: number }> }[]; equipe: string[] } }>(`select agenda_publica('patinhas') as a`))).a;
    expect(ag.petshop).toMatchObject({ nome: "Patinhas", sinal_pct: 20 });
    expect(ag.servicos.find((s) => s.nome === "Banho")!.precos.P.preco).toBe(50);
    expect(ag.equipe.length).toBeGreaterThan(0);

    const dia = (await um<{ d: string }>(`select to_char(current_date + 3, 'YYYY-MM-DD') as d`)).d;
    const pedido = (extra: Record<string, unknown> = {}) => JSON.stringify({ nome: "maria clara", whatsapp: "(11) 97777-1234", pet: "bolinha", porte: "P", especie: "cao", servicos: [banho], data: dia, hora: "10:00", aceite: true, ...extra });
    const r = (await anon(() => um<{ r: { token: string; total: number; sinal: number; pix_chave: string } }>(`select agendar_online('patinhas', $1::jsonb) as r`, [pedido()]))).r;
    expect(r).toMatchObject({ total: 50, sinal: 10, pix_chave: "pix@patinhas.com" });
    expect(r.token).toMatch(/^[0-9a-f]{32}$/);
    const atd = await um<{ origem: string; status: string; nome: string; tutor: string; consent: boolean; sinal: string }>(
      `select a.origem, a.status, p.nome, t.nome as tutor, t.consentimento_whatsapp_em is not null as consent, a.sinal_valor as sinal
       from atendimentos a join pets p on p.id = a.pet_id join tutores t on t.id = a.tutor_id where a.token = $1`, [r.token]);
    expect(atd).toMatchObject({ origem: "portal", status: "agendado", nome: "Bolinha", tutor: "Maria Clara", consent: true });

    // Mesmo WhatsApp e mesmo pet: não duplica.
    await anon(() => db.query(`select agendar_online('patinhas', $1::jsonb)`, [pedido({ hora: "13:00" })]));
    expect((await um<{ n: number }>(`select count(*)::int as n from tutores where whatsapp = '5511977771234'`)).n).toBe(1);
    expect((await um<{ n: number }>(`select count(*)::int as n from pets p join tutores t on t.id = p.tutor_id where t.whatsapp = '5511977771234'`)).n).toBe(1);

    await expect(anon(() => db.query(`select agendar_online('patinhas', $1::jsonb)`, [pedido({ aceite: false })]))).rejects.toThrow(/autorize/);
    await expect(anon(() => db.query(`select agendar_online('patinhas', $1::jsonb)`, [pedido({ hora: "17:30" })]))).rejects.toThrow(/fechamento/);
    await expect(anon(() => db.query(`select agendar_online('patinhas', $1::jsonb)`, [pedido({ whatsapp: "123" })]))).rejects.toThrow(/WhatsApp/);
    await anon(() => db.query(`select agendar_online('patinhas', $1::jsonb)`, [pedido({ hora: "15:00" })]));
    await expect(anon(() => db.query(`select agendar_online('patinhas', $1::jsonb)`, [pedido({ hora: "16:00" })]))).rejects.toThrow(/3 agendamentos/);
    // anon continua sem ler tabelas.
    expect(await anon(async () => (await db.query(`select * from tutores`)).rows.length)).toBe(0);
  });

  it("vacinas: equipe do pet shop grava e lê; outro pet shop não vê", async () => {
    await como(U_BRUNO, () => db.query(`insert into pet_vacinas (petshop_id, pet_id, tipo, nome, aplicada_em, proxima_em) values ($1, $2, 'vacina', 'V10', '2025-10-01', '2026-10-01')`, [A, thor]));
    expect(await como(U_ANA, async () => (await db.query(`select * from pet_vacinas`)).rows.length)).toBe(1);
    expect(await como(U_OUTRO, async () => (await db.query(`select * from pet_vacinas`)).rows.length)).toBe(0);
  });

  it("venda a receber fica paga junto com a receita; estorno do recebimento reabre venda e atendimento", async () => {
    const petisco = (await um<{ id: string }>(`insert into produtos (petshop_id, nome, preco_venda, estoque) values ($1, 'Petisco', 10, 0) returning id`, [A])).id;
    await db.query(`insert into estoque_movimentos (petshop_id, produto_id, tipo, quantidade) values ($1, $2, 'entrada', 5)`, [A, petisco]);
    const lanc = "00000000-0000-0000-0000-0000000000f1";
    const venda = await como(U_ANA, () => um<{ v: string }>(`select registrar_venda($1::jsonb, $2::jsonb, $3::jsonb) as v`, [
      JSON.stringify({ petshop_id: A, total: 20, status: "pendente" }),
      JSON.stringify([{ produto_id: petisco, nome: "Petisco", quantidade: 2, preco: 10 }]),
      JSON.stringify({ id: lanc, petshop_id: A, tipo: "receita", categoria: "Produtos", descricao: "Petisco x2", valor: 20, status: "pendente", competencia: "2026-10-09" }),
    ]));
    await como(U_ANA, () => db.query(`update lancamentos set status = 'pago', forma_pagamento = 'pix', pago_em = now() where id = $1`, [lanc]));
    expect(await um(`select status, forma_pagamento from vendas where id = $1`, [venda.v])).toEqual({ status: "pago", forma_pagamento: "pix" });
    await como(U_ANA, () => db.query(`update lancamentos set status = 'pendente', forma_pagamento = null, pago_em = null where id = $1`, [lanc]));
    expect((await um<{ status: string }>(`select status from vendas where id = $1`, [venda.v])).status).toBe("pendente");

    const id = await agendar(thor, "2026-10-28 09:00-03", 60, [{ servico: banho, nome: "Banho", preco: 90 }]);
    await status(id, "em_atendimento");
    await status(id, "finalizado");
    await como(U_ANA, () => db.query(`update lancamentos set status = 'pago', forma_pagamento = 'pix', pago_em = now() where atendimento_id = $1`, [id]));
    expect((await um<{ pago: boolean }>(`select pago from atendimentos where id = $1`, [id])).pago).toBe(true);
    await como(U_ANA, () => db.query(`update lancamentos set status = 'pendente', forma_pagamento = null, pago_em = null where atendimento_id = $1`, [id]));
    expect((await um<{ pago: boolean }>(`select pago from atendimentos where id = $1`, [id])).pago).toBe(false);
  });

  it("configuração do Asaas (impressão do token do webhook) só o servidor lê", async () => {
    await db.query(`insert into plataforma_config (chave, valor) values ('asaas_webhook_token_sha256', 'abc')`);
    expect(await como(U_ANA, async () => (await db.query(`select * from plataforma_config`)).rows.length)).toBe(0);
    expect(await anon(async () => (await db.query(`select * from plataforma_config`)).rows.length)).toBe(0);
    await expect(como(U_ANA, () => db.query(`insert into plataforma_config (chave, valor) values ('x', 'y')`))).rejects.toThrow(/row-level security/);
  });

  it("slug do link de agendamento só aceita letras minúsculas, números e hífen", async () => {
    await expect(db.query(`update petshops set slug = 'Meu Pet!' where id = $1`, [A])).rejects.toThrow(/petshops_slug_formato/);
  });
});
