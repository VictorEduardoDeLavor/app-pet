import type { Especie } from "./types";

/**
 * Lista de raças em português, como os pet shops falam no balcão.
 * `apelidos` cobre grafias comuns ("Shitzu"), nomes populares ("Lulu") e siglas ("SRD"):
 * a busca encontra a raça por eles e `normalizarRaca` troca o apelido pelo nome da lista.
 */
export interface Raca {
  nome: string;
  especie: Especie;
  apelidos?: string[];
}

export const SEM_RACA = "Sem raça definida";

const cao = (nome: string, ...apelidos: string[]): Raca => ({ nome, especie: "cao", apelidos });
const gato = (nome: string, ...apelidos: string[]): Raca => ({ nome, especie: "gato", apelidos });

export const RACAS: Raca[] = [
  // Cães
  cao(SEM_RACA, "SRD", "Vira-lata", "Viralata", "Mestiço", "Misturado"),
  cao("Affenpinscher"),
  cao("Afghan Hound", "Galgo Afegão"),
  cao("Airedale Terrier"),
  cao("Akita", "Akita Inu"),
  cao("Akita Americano"),
  cao("American Bully", "Bully"),
  cao("American Pit Bull Terrier", "Pit Bull", "Pitbull", "Pit"),
  cao("American Staffordshire Terrier", "Amstaff"),
  cao("Basenji"),
  cao("Basset Hound", "Basset"),
  cao("Beagle", "Bigle"),
  cao("Bearded Collie"),
  cao("Bichon Frisé", "Bichon", "Bichon Frise"),
  cao("Bichon Havanês", "Havanês", "Havanese"),
  cao("Bloodhound"),
  cao("Boiadeiro Australiano", "Blue Heeler", "Cattle Dog"),
  cao("Boiadeiro Bernês", "Bernese", "Bernês"),
  cao("Border Collie", "Border"),
  cao("Border Terrier"),
  cao("Borzoi"),
  cao("Boston Terrier"),
  cao("Boxer"),
  cao("Braco Alemão", "Pointer Alemão"),
  cao("Bull Terrier"),
  cao("Bulldog Americano", "Buldogue Americano"),
  cao("Bulldog Campeiro", "Buldogue Campeiro"),
  cao("Bulldog Francês", "Buldogue Francês", "Frenchie", "Bulldog Frances"),
  cao("Bulldog Inglês", "Buldogue Inglês"),
  cao("Bullmastiff"),
  cao("Cairn Terrier"),
  cao("Cane Corso"),
  cao("Cavalier King Charles Spaniel", "Cavalier", "King Charles"),
  cao("Chihuahua", "Chiuaua", "Chiuáua"),
  cao("Chow Chow", "Chow"),
  cao("Cocker Spaniel Americano", "Cocker"),
  cao("Cocker Spaniel Inglês", "Cocker"),
  cao("Collie", "Rough Collie"),
  cao("Coton de Tulear", "Coton"),
  cao("Dachshund", "Salsicha", "Teckel", "Dachs", "Daschund", "Dashund"),
  cao("Dálmata"),
  cao("Doberman", "Dobermann"),
  cao("Dogo Argentino"),
  cao("Dogue Alemão", "Dog Alemão", "Great Dane"),
  cao("Dogue de Bordeaux"),
  cao("Fila Brasileiro", "Fila"),
  cao("Fox Paulistinha", "Terrier Brasileiro"),
  cao("Fox Terrier"),
  cao("Galgo Inglês", "Greyhound", "Galgo"),
  cao("Golden Retriever", "Golden"),
  cao("Goldendoodle"),
  cao("Husky Siberiano", "Husky"),
  cao("Jack Russell Terrier", "Jack Russell"),
  cao("Labradoodle"),
  cao("Labrador Retriever", "Labrador", "Lab"),
  cao("Lhasa Apso", "Lhasa", "Lasa", "Lasa Apso"),
  cao("Malamute do Alasca", "Malamute"),
  cao("Maltês", "Maltes"),
  cao("Maltipoo"),
  cao("Mastiff", "Mastim Inglês"),
  cao("Mastim Napolitano"),
  cao("Mastim Tibetano"),
  cao("Papillon"),
  cao("Pastor Alemão", "Pastor"),
  cao("Pastor Australiano", "Australian Shepherd", "Aussie"),
  cao("Pastor Belga Malinois", "Malinois", "Pastor Belga"),
  cao("Pastor Branco Suíço", "Pastor Suíço"),
  cao("Pastor de Shetland", "Sheltie"),
  cao("Pequinês", "Pequines", "Pekingese"),
  cao("Pinscher", "Pinscher Miniatura", "Pincher", "Pinche"),
  cao("Pointer Inglês", "Pointer"),
  cao("Pomsky"),
  cao("Poodle", "Poodle Toy", "Poodle Micro", "Poodle Médio", "Poodle Gigante", "Pudle"),
  cao("Pug"),
  cao("Rottweiler", "Rotweiler", "Rottweiller", "Rotiweiler"),
  cao("Samoieda", "Samoyed"),
  cao("São Bernardo"),
  cao("Schnauzer", "Schnauzer Miniatura", "Schnauzer Standard", "Snauzer", "Schnauser"),
  cao("Schnauzer Gigante"),
  cao("Scottish Terrier"),
  cao("Setter Irlandês", "Setter"),
  cao("Shar-pei", "Sharpei", "Shar pei"),
  cao("Shiba Inu", "Shiba"),
  cao("Shih-tzu", "Shitzu", "Shih tzu", "Shihtzu", "Shitsu", "Shi tzu", "Chitzu", "Xitzu", "Shitzo"),
  cao("Spitz Alemão (Lulu da Pomerânia)", "Lulu", "Lulu da Pomerânia", "Spitz", "Spitz Alemão", "Pomerânia", "Pomeranian", "Spitz Anão"),
  cao("Spitz Japonês"),
  cao("Springer Spaniel Inglês", "Springer"),
  cao("Staffordshire Bull Terrier", "Staffbull", "Staffy"),
  cao("Terra-nova", "Terra Nova", "Newfoundland"),
  cao("Weimaraner"),
  cao("West Highland White Terrier", "Westie"),
  cao("Whippet"),
  cao("Yorkshire Terrier", "Yorkshire", "York", "Yorkie", "Yorkshire Terrie", "Yorkshare"),

  // Gatos
  gato(SEM_RACA, "SRD", "Vira-lata", "Viralata", "Mestiço", "Misturado"),
  gato("Abissínio"),
  gato("Angorá Turco", "Angorá"),
  gato("Azul Russo", "Russian Blue"),
  gato("Bengal", "Bengali"),
  gato("Birmanês (Sagrado da Birmânia)", "Sagrado da Birmânia", "Birman", "Birmanês"),
  gato("Bombaim", "Bombay"),
  gato("British Shorthair", "British"),
  gato("Burmês", "Burmese"),
  gato("Chartreux"),
  gato("Cornish Rex"),
  gato("Devon Rex"),
  gato("Exótico", "Exotic", "Exotic Shorthair", "Persa Exótico"),
  gato("Himalaio", "Himalaia"),
  gato("Maine Coon", "Mainecoon"),
  gato("Munchkin"),
  gato("Norueguês da Floresta", "Norwegian Forest"),
  gato("Oriental"),
  gato("Persa"),
  gato("Ragamuffin"),
  gato("Ragdoll"),
  gato("Savannah"),
  gato("Scottish Fold"),
  gato("Selkirk Rex"),
  gato("Siamês", "Siames"),
  gato("Siberiano"),
  gato("Somali"),
  gato("Sphynx", "Sphinx", "Gato pelado"),
  gato("Tonquinês"),
];

/** O que aparece primeiro quando o campo está vazio. */
const POPULARES: Record<Especie, string[]> = {
  cao: [SEM_RACA, "Shih-tzu", "Spitz Alemão (Lulu da Pomerânia)", "Yorkshire Terrier", "Poodle", "Lhasa Apso", "Maltês", "Pinscher", "Golden Retriever", "Labrador Retriever", "Bulldog Francês", "Pug"],
  gato: [SEM_RACA, "Persa", "Siamês", "Maine Coon", "Ragdoll", "Angorá Turco", "British Shorthair", "Sphynx"],
};

/** Minúsculas, sem acento e sem espaços extras. */
export function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Só letras e números: "Shih-tzu", "shih tzu" e "Shihtzu" viram a mesma coisa. */
function compacto(s: string): string {
  return semAcento(s).replace(/[^a-z0-9]/g, "");
}

function palavras(s: string): string[] {
  return semAcento(s).split(/[^a-z0-9]+/).filter(Boolean);
}

/** Distância de edição (inserir, apagar, trocar uma letra). */
function distancia(a: string, b: string): number {
  if (a === b) return 0;
  const linha = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = linha[0];
    linha[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const acima = linha[j];
      linha[j] = Math.min(linha[j] + 1, linha[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = acima;
    }
  }
  return linha[b.length];
}

function nota(termo: string, q: string, qc: string): number {
  const tc = compacto(termo);
  if (!tc) return 0;
  if (tc === qc) return 100;
  if (tc.startsWith(qc)) return 80;
  if (palavras(termo).some((p) => p.startsWith(q))) return 60;
  if (qc.length >= 3 && tc.includes(qc)) return 40;
  // Erro de digitação ("labador", "yokshire"): compara com o começo do nome.
  if (qc.length >= 4) {
    const d = Math.min(distancia(qc, tc.slice(0, qc.length)), distancia(qc, tc.slice(0, qc.length + 1)), distancia(qc, tc.slice(0, qc.length - 1)));
    if (d <= 1) return 30;
  }
  return 0;
}

/** Sugestões para o que foi digitado, da mais provável para a menos provável. */
export function buscarRacas(texto: string, especie?: Especie, limite = 6): Raca[] {
  const base = especie ? RACAS.filter((r) => r.especie === especie) : RACAS;
  const q = semAcento(texto).replace(/[^a-z0-9 ]/g, " ").trim();
  const qc = compacto(texto);
  if (!qc) {
    const ordem = POPULARES[especie ?? "cao"];
    return ordem.map((n) => base.find((r) => r.nome === n)).filter((r): r is Raca => !!r).slice(0, limite);
  }
  const populares = new Set(POPULARES[especie ?? "cao"]);
  return base
    .map((r) => {
      const doNome = nota(r.nome, q, qc);
      const doApelido = Math.max(0, ...(r.apelidos ?? []).map((a) => nota(a, q, qc) - 2));
      return { r, n: Math.max(doNome, doApelido) + (populares.has(r.nome) ? 1 : 0) };
    })
    .filter((x) => x.n > 1)
    .sort((a, b) => b.n - a.n || a.r.nome.localeCompare(b.r.nome, "pt-BR"))
    .slice(0, limite)
    .map((x) => x.r);
}

/**
 * Troca um apelido ou grafia conhecida pelo nome da lista ("shitzu" → "Shih-tzu").
 * O que não está na lista fica como foi digitado (sem espaços nas pontas).
 */
export function normalizarRaca(texto: string | undefined, especie?: Especie): string {
  const t = (texto ?? "").trim().replace(/\s+/g, " ");
  if (!t) return "";
  const qc = compacto(t);
  const base = especie ? RACAS.filter((r) => r.especie === especie) : RACAS;
  const achou = base.find((r) => compacto(r.nome) === qc || (r.apelidos ?? []).some((a) => compacto(a) === qc));
  return achou ? achou.nome : t;
}

/** A raça digitada já é exatamente um nome da lista? */
export function racaDaLista(texto: string, especie?: Especie): boolean {
  const t = texto.trim();
  return RACAS.some((r) => (!especie || r.especie === especie) && r.nome === t);
}
