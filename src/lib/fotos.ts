"use client";

// Fotos do pet e das etapas do atendimento.
// A foto é reduzida no celular antes de subir (browser-image-compression, biblioteca aberta e
// amplamente usada): sai da câmera com 3–5 MB e chega ao banco com ~150 KB em JPEG.
// O "trabalhador" da biblioteca é servido pelo próprio app (public/vendor), sem depender de CDN.
// Modo nuvem: Supabase Storage (bucket público "fotos", caminho aleatório).
// Modo demonstração: a foto vira texto (data URL) e fica só neste navegador.

import imageCompression from "browser-image-compression";
import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "fotos";

export async function reduzirFoto(arquivo: File, opcoes: { maxLado?: number; maxMB?: number } = {}): Promise<Blob> {
  if (!arquivo.type.startsWith("image/")) throw new Error("Escolha uma foto.");
  return imageCompression(arquivo, {
    maxSizeMB: opcoes.maxMB ?? 0.3,
    maxWidthOrHeight: opcoes.maxLado ?? 1280,
    useWebWorker: true,
    libURL: "/vendor/browser-image-compression.js",
    // JPEG abre em qualquer celular (WebP ainda falha em iPhones mais antigos).
    fileType: "image/jpeg",
    initialQuality: 0.82,
  });
}

export function urlPublica(sb: SupabaseClient, path: string): string {
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Mesma URL, para páginas sem cliente logado (o link do tutor), a partir da URL do projeto. */
export function urlPublicaDoProjeto(supabaseUrl: string, path: string): string {
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${BUCKET}/${path}`;
}

/** Caminho no bucket a partir da URL pública (undefined para fotos da demonstração). */
export function caminhoDaUrl(url: string | undefined): string | undefined {
  const marca = `/object/public/${BUCKET}/`;
  const i = url?.indexOf(marca) ?? -1;
  return url && i >= 0 ? decodeURIComponent(url.slice(i + marca.length).split("?")[0]) : undefined;
}

export async function apagarFoto(sb: SupabaseClient, path: string): Promise<void> {
  const { error } = await sb.storage.from(BUCKET).remove([path]);
  if (error) throw new Error(`Não foi possível apagar a foto: ${error.message}`);
}

/** Sobe a foto já reduzida e devolve o caminho no bucket. */
export async function subirFoto(sb: SupabaseClient, path: string, blob: Blob): Promise<string> {
  const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg", upsert: true, cacheControl: "31536000" });
  if (error) throw new Error(`Não foi possível enviar a foto: ${error.message}`);
  return path;
}

export function blobParaDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
