const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const DATA_FILE = process.env.DATA_FILE || path.join("data", "escuelas.json");
const SAMPLE_FILE = path.join("data", "escuelas.sample.json");

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: "1mb" }));

let escuelasCache = [];
let fuenteDatos = "";
let fechaCarga = null;

function normalizarTexto(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function cargarEscuelas() {
  const mainPath = path.resolve(DATA_FILE);
  const samplePath = path.resolve(SAMPLE_FILE);
  const fileToLoad = fs.existsSync(mainPath) ? mainPath : samplePath;

  try {
    const content = fs.readFileSync(fileToLoad, "utf8");
    const parsed = JSON.parse(content);
    escuelasCache = Array.isArray(parsed) ? parsed : [];
    fuenteDatos = fileToLoad === mainPath ? "oficial" : "sample";
    fechaCarga = new Date().toISOString();
    console.log(`Escuelas cargadas: ${escuelasCache.length} (${fuenteDatos})`);
  } catch (error) {
    console.error("No se pudo cargar el archivo de escuelas:", error.message);
    escuelasCache = [];
    fuenteDatos = "error";
    fechaCarga = new Date().toISOString();
  }
}

function toInt(value, fallback, min, max) {
  const number = Number.parseInt(value, 10);
  if (Number.isNaN(number)) return fallback;
  return Math.min(Math.max(number, min), max);
}

function crearRespuestaPaginada(items, page, limit, total) {
  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1
    },
    meta: {
      fuente: fuenteDatos,
      fechaCarga,
      nota: fuenteDatos === "sample"
        ? "Usando datos de ejemplo. Para cargar el catalogo completo, ejecuta npm run importar:escuelas."
        : "Datos cargados desde data/escuelas.json"
    }
  };
}

function filtrarEscuelas(query) {
  const q = normalizarTexto(query.q);
  const nivel = normalizarTexto(query.nivel);
  const estado = normalizarTexto(query.estado);
  const municipio = normalizarTexto(query.municipio);
  const cct = normalizarTexto(query.cct);
  const turno = normalizarTexto(query.turno);
  const sostenimiento = normalizarTexto(query.sostenimiento);

  let results = escuelasCache.filter((school) => {
    const nombreText = normalizarTexto(school.nombre);
    const nivelText = normalizarTexto(school.nivel);
    const nivelOriginalText = normalizarTexto(school.nivelOriginal);
    const estadoText = normalizarTexto(school.estado);
    const municipioText = normalizarTexto(school.municipio);
    const localidadText = normalizarTexto(school.localidad);
    const cctText = normalizarTexto(school.cct);
    const turnoText = normalizarTexto(school.turno);
    const sostenimientoText = normalizarTexto(school.sostenimiento);

    const matchQuery = q
      ? nombreText.includes(q) || cctText.includes(q) || municipioText.includes(q) || localidadText.includes(q)
      : true;

    const matchNivel = nivel
      ? nivelText === nivel || nivelOriginalText.includes(nivel)
      : true;

    const matchEstado = estado ? estadoText === estado : true;
    const matchMunicipio = municipio ? municipioText === municipio : true;
    const matchCct = cct ? cctText.includes(cct) : true;
    const matchTurno = turno ? turnoText === turno : true;
    const matchSostenimiento = sostenimiento ? sostenimientoText === sostenimiento : true;

    return matchQuery && matchNivel && matchEstado && matchMunicipio && matchCct && matchTurno && matchSostenimiento;
  });

  if (q) {
    results = results.sort((a, b) => {
      const aName = normalizarTexto(a.nombre);
      const bName = normalizarTexto(b.nombre);
      const aStarts = aName.startsWith(q) ? 0 : 1;
      const bStarts = bName.startsWith(q) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return aName.localeCompare(bName, "es");
    });
  } else {
    results = results.sort((a, b) => normalizarTexto(a.nombre).localeCompare(normalizarTexto(b.nombre), "es"));
  }

  return results;
}

app.get("/", (req, res) => {
  res.json({
    nombre: "RutaAcademica API",
    version: "2.0.0",
    estado: "activa",
    endpoints: [
      "GET /api/health",
      "GET /api/escuelas?q=&nivel=&estado=&municipio=&page=&limit=",
      "GET /api/schools?q=&nivel=&estado=&municipio=  (compatibilidad Android anterior)",
      "GET /api/escuelas/:cct",
      "GET /api/catalogos/niveles",
      "GET /api/catalogos/estados",
      "GET /api/catalogos/municipios?estado=Guanajuato",
      "GET /api/stats"
    ]
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    escuelas: escuelasCache.length,
    fuente: fuenteDatos,
    fechaCarga
  });
});

app.get("/api/escuelas", (req, res) => {
  const page = toInt(req.query.page, 1, 1, 100000);
  const limit = toInt(req.query.limit, 25, 1, 100);
  const results = filtrarEscuelas(req.query);
  const start = (page - 1) * limit;
  const items = results.slice(start, start + limit);

  res.json(crearRespuestaPaginada(items, page, limit, results.length));
});

// Compatibilidad con la primera app Android, que esperaba un arreglo simple.
app.get("/api/schools", (req, res) => {
  const limit = toInt(req.query.limit, 25, 1, 100);
  const results = filtrarEscuelas(req.query).slice(0, limit);
  res.json(results);
});

app.get("/api/escuelas/:cct", (req, res) => {
  const cct = normalizarTexto(req.params.cct);
  const school = escuelasCache.find((item) => normalizarTexto(item.cct) === cct || normalizarTexto(item.id) === cct);

  if (!school) {
    return res.status(404).json({
      error: "No encontrada",
      message: "No se encontro una escuela con ese CCT o id."
    });
  }

  res.json(school);
});

app.get("/api/catalogos/niveles", (req, res) => {
  const niveles = [...new Set(escuelasCache.map((item) => item.nivel).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "es"));
  res.json(niveles);
});

app.get("/api/catalogos/estados", (req, res) => {
  const estados = [...new Set(escuelasCache.map((item) => item.estado).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "es"));
  res.json(estados);
});

app.get("/api/catalogos/municipios", (req, res) => {
  const estado = normalizarTexto(req.query.estado);
  const municipios = escuelasCache
    .filter((item) => estado ? normalizarTexto(item.estado) === estado : true)
    .map((item) => item.municipio)
    .filter(Boolean);

  res.json([...new Set(municipios)].sort((a, b) => a.localeCompare(b, "es")));
});

app.get("/api/stats", (req, res) => {
  const porNivel = {};
  const porEstado = {};

  for (const item of escuelasCache) {
    porNivel[item.nivel || "Sin nivel"] = (porNivel[item.nivel || "Sin nivel"] || 0) + 1;
    porEstado[item.estado || "Sin estado"] = (porEstado[item.estado || "Sin estado"] || 0) + 1;
  }

  res.json({
    total: escuelasCache.length,
    fuente: fuenteDatos,
    fechaCarga,
    porNivel,
    porEstado
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: "Ruta no encontrada",
    message: "Verifica el endpoint de la API."
  });
});

cargarEscuelas();

app.listen(PORT, () => {
  console.log(`API RutaAcademica funcionando en http://localhost:${PORT}`);
});
