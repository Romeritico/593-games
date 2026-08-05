import type { Config } from "@netlify/functions";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { juegos } from "../../db/schema.js";

export default async (req: Request) => {
  let codigo = "";
  try {
    const body = await req.json();
    codigo = String(body?.codigo || "").trim();
  } catch {
    return Response.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  if (!codigo) {
    return Response.json({ error: "Ingresa un código." }, { status: 400 });
  }

  const [juego] = await db
    .select({
      id: juegos.id,
      nombre: juegos.nombre,
      archivoKey: juegos.archivoKey,
    })
    .from(juegos)
    .where(eq(juegos.codigo, codigo))
    .limit(1);

  if (!juego) {
    return Response.json(
      { error: "Código no válido. Verifica e intenta nuevamente." },
      { status: 404 },
    );
  }

  const extension = juego.archivoKey.split(".").pop()?.toLowerCase() || "html";

  return Response.json({
    nombre: juego.nombre,
    tipo: extension,
    url: `/api/archivo?codigo=${encodeURIComponent(codigo)}`,
  });
};

export const config: Config = {
  path: "/api/descargar",
  method: "POST",
};
