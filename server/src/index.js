import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import { initSchema } from "./db.js";
import { loadContent } from "./content.js";
import authRoutes from "./routes/auth.js";
import civRoutes from "./routes/civ.js";
import teacherRoutes from "./routes/teacher.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(express.static(path.join(__dirname, "..", "public")));
app.use("/images", express.static(path.join(__dirname, "..", "..", "cartes", "images")));

app.get("/api/health", (req, res) => {
  const content = loadContent();
  res.json({
    ok: true,
    content: {
      scienceCards: content.scienceCards.length,
      cultureCards: content.cultureCards.length,
      units: content.units.length,
      districts: content.districts.length,
      territoires: content.territoires.length,
      historicalEvents: content.historicalEvents.length,
    },
  });
});

app.use("/api", authRoutes);
app.use("/api/civ", civRoutes);
app.use("/api/teacher", teacherRoutes);

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || "Erreur serveur." });
});

const PORT = process.env.PORT || 3000;

async function start() {
  loadContent(); // fail fast on any CSV parsing problem before accepting traffic
  await initSchema();
  app.listen(PORT, () => console.log(`Serveur démarré sur le port ${PORT}`));
}

start().catch((err) => {
  console.error("Échec du démarrage du serveur:", err);
  process.exit(1);
});
