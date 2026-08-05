import type { Config } from "@netlify/functions";
import { desc } from "drizzle-orm";
import { db } from "../../db/index.js";
import { juegos } from "../../db/schema.js";

export default async () => {
  const rows = await db
    .select({
      id: juegos.id,
      nombre: juegos.nombre,
      demoUrl: juegos.demoUrl,
      etiqueta: juegos.etiqueta,
    })
    .from(juegos)
    .orderBy(desc(juegos.createdAt));

  return Response.json(rows);
};

export const config: Config = {
  path: "/api/juegos",
  method: "GET",
};
