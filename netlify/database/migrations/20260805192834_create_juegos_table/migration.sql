CREATE TABLE "juegos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"codigo" text NOT NULL UNIQUE,
	"nombre" text NOT NULL,
	"archivo_key" text NOT NULL,
	"demo_url" text,
	"etiqueta" text DEFAULT 'Entretenimiento' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
