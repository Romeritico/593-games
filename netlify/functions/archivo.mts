import type { Config } from "@netlify/functions";
import { eq } from "drizzle-orm";
import { getStore } from "@netlify/blobs";
import { db } from "../../db/index.js";
import { juegos } from "../../db/schema.js";

const CONTENT_TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  pdf: "application/pdf",
};

export default async (req: Request) => {
  const codigo = new URL(req.url).searchParams.get("codigo")?.trim() || "";

  if (!codigo) {
    return new Response("Falta el código.", { status: 400 });
  }

  const [juego] = await db
    .select({ archivoKey: juegos.archivoKey })
    .from(juegos)
    .where(eq(juegos.codigo, codigo))
    .limit(1);

  if (!juego) {
    return new Response("Código no válido.", { status: 404 });
  }

  const store = getStore("archivos-juegos");
  const archivo = await store.get(juego.archivoKey, { type: "arrayBuffer" });

  if (!archivo) {
    return new Response("El archivo del juego no está disponible.", { status: 404 });
  }

  const extension = juego.archivoKey.split(".").pop()?.toLowerCase() || "html";
  const contentType = CONTENT_TYPES[extension] || "application/octet-stream";

  return new Response(archivo, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
    },
  });
};

export const config: Config = {
  path: "/api/archivo",
  method: "GET",
};
