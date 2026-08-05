import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { db } from "../../db/index.js";
import { juegos } from "../../db/schema.js";

export default async (req: Request) => {
  const secret = req.headers.get("x-admin-secret") || "";
  const expected = Netlify.env.get("ADMIN_SECRET") || "";

  if (!expected || secret !== expected) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = await req.json();
  const codigo = String(body?.codigo || "").trim();
  const nombre = String(body?.nombre || "").trim();
  const etiqueta = String(body?.etiqueta || "Entretenimiento").trim();
  const demoUrl = body?.demoUrl ? String(body.demoUrl).trim() : null;
  const nombreArchivo = String(body?.nombreArchivo || "").trim();
  const archivoBase64 = String(body?.archivoBase64 || "");

  if (!codigo || !nombre || !nombreArchivo || !archivoBase64) {
    return Response.json(
      { error: "Faltan campos: codigo, nombre, nombreArchivo, archivoBase64." },
      { status: 400 },
    );
  }

  const extension = nombreArchivo.split(".").pop()?.toLowerCase();
  if (extension !== "html" && extension !== "htm" && extension !== "pdf") {
    return Response.json(
      { error: "Solo se permiten archivos .html o .pdf." },
      { status: 400 },
    );
  }

  const archivoKey = `${codigo}-${nombreArchivo}`;
  const buffer = Buffer.from(archivoBase64, "base64");

  const store = getStore("archivos-juegos");
  await store.set(archivoKey, buffer);

  try {
    const [creado] = await db
      .insert(juegos)
      .values({ codigo, nombre, archivoKey, demoUrl, etiqueta })
      .returning();
    return Response.json(creado, { status: 201 });
  } catch (error) {
    await store.delete(archivoKey);
    return Response.json(
      { error: "No se pudo crear el juego. ¿El código ya existe?" },
      { status: 409 },
    );
  }
};

export const config: Config = {
  path: "/api/admin/juegos",
  method: "POST",
};
