import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const juegos = pgTable("juegos", {
  id: uuid().primaryKey().defaultRandom(),
  codigo: text().notNull().unique(),
  nombre: text().notNull(),
  archivoKey: text("archivo_key").notNull(),
  demoUrl: text("demo_url"),
  etiqueta: text().notNull().default("Entretenimiento"),
  createdAt: timestamp("created_at").defaultNow(),
});
