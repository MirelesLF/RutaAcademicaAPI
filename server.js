const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const app = express();

app.use(cors());
app.use(express.json());

function limpiarTexto(valor) {
  return String(valor || "").replace(/\s+/g, " ").trim();
}

function normalizar(valor) {
  return limpiarTexto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function leerJson(filePath) {
  const buffer = fs.readFileSync(filePath);

  if (filePath.endsWith(".gz")) {
    return JSON.parse(zlib.gunzipSync(buffer).toString("utf8"));
  }

  return JSON.parse(buffer.toString("utf8"));
}

function cargarEscuelas() {
  const minGzipPath = path.join(__dirname, "data", "escuelas.min.json.gz");
  const minPath = path.join(__dirname, "data", "escuelas.min.json");
  const fullPath = path.join(__dirname, "data", "escuelas.json");
  const samplePath = path.join(__dirname, "data", "escuelas.sample.json");

  let filePath = samplePath;
  let fuente = "sample";

  if (fs.existsSync(minGzipPath)) {
    filePath = minGzipPath;
    fuente = "oficial-min-gz";
  } else if (fs.existsSync(minPath)) {
    filePath = minPath;
    fuente = "oficial-min";
  } else if (fs.existsSync(fullPath)) {
    filePath = fullPath;
    fuente = "oficial";
  }

  const escuelas = leerJson(filePath);

  console.log(`Escuelas cargadas: ${escuelas.length} (${fuente})`);

  return {
    escuelas,
    fuente,
    fechaCarga: new Date().toISOString()
  };
}

const catalogo = cargarEscuelas();

function filtrarEscuelas(query) {
  const q = normalizar(query.q);
  const nivel = normalizar(query.nivel);
  const estado = normalizar(query.estado);
  const municipio = normalizar(query.municipio);

  let resultados = catalogo.escuelas;

  if (nivel) {
    resultados = resultados.filter((escuela) => {
      return normalizar(escuela.nivel) === nivel;
    });
  }

  if (estado) {
    resultados = resultados.filter((escuela) => {
      return normalizar(escuela.estado) === estado;
    });
  }

  if (municipio) {
    resultados = resultados.filter((escuela) => {
      return normalizar(escuela.municipio).includes(municipio);
    });
  }

  if (q) {
    resultados = resultados.filter((escuela) => {
      const texto = [
        escuela.nombre,
        escuela.cct,
        escuela.estado,
        escuela.municipio,
        escuela.localidad
      ].join(" ");

      return normalizar(texto).includes(q);
    });
  }

  return resultados;
}

app.get("/", (req, res) => {
  res.json({
    ok: true,
    nombre: "RutaAcademica API",
    version: "2.0.0",
    endpoints: [
      "/api/health",
      "/api/stats",
      "/api/escuelas",
      "/api/escuelas/:cct",
      "/api/catalogos/niveles",
      "/api/catalogos/estados",
      "/api/catalogos/municipios?estado=GUANAJUATO"
    ]
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    escuelas: catalogo.escuelas.length,
    fuente: catalogo.fuente,
    fechaCarga: catalogo.fechaCarga
  });
});

app.get("/api/stats", (req, res) => {
  const porNivel = {};
  const porEstado = {};

  for (const escuela of catalogo.escuelas) {
    const nivel = escuela.nivel || "Sin nivel";
    const estado = escuela.estado || "Sin estado";

    porNivel[nivel] = (porNivel[nivel] || 0) + 1;
    porEstado[estado] = (porEstado[estado] || 0) + 1;
  }

  res.json({
    total: catalogo.escuelas.length,
    fuente: catalogo.fuente,
    fechaCarga: catalogo.fechaCarga,
    porNivel,
    porEstado
  });
});

app.get("/api/escuelas", (req, res) => {
  const page = Math.max(parseInt(req.query.page || "1", 10), 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit || "25", 10), 1), 100);

  const resultados = filtrarEscuelas(req.query);

  const total = resultados.length;
  const totalPages = Math.max(Math.ceil(total / limit), 1);
  const start = (page - 1) * limit;
  const end = start + limit;

  const items = resultados.slice(start, end);

  res.json({
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    },
    meta: {
      fuente: catalogo.fuente,
      fechaCarga: catalogo.fechaCarga
    }
  });
});

app.get("/api/schools", (req, res) => {
  const page = Math.max(parseInt(req.query.page || "1", 10), 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit || "25", 10), 1), 100);

  const resultados = filtrarEscuelas(req.query);

  const total = resultados.length;
  const totalPages = Math.max(Math.ceil(total / limit), 1);
  const start = (page - 1) * limit;
  const end = start + limit;

  const items = resultados.slice(start, end);

  res.json({
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    },
    meta: {
      fuente: catalogo.fuente,
      fechaCarga: catalogo.fechaCarga
    }
  });
});

app.get("/api/escuelas/:cct", (req, res) => {
  const cct = normalizar(req.params.cct);

  const escuela = catalogo.escuelas.find((item) => {
    return normalizar(item.cct) === cct || normalizar(item.id) === cct;
  });

  if (!escuela) {
    return res.status(404).json({
      ok: false,
      message: "No se encontro la escuela solicitada"
    });
  }

  res.json({
    ok: true,
    item: escuela
  });
});

app.get("/api/catalogos/niveles", (req, res) => {
  const niveles = [...new Set(catalogo.escuelas.map((item) => item.nivel))]
    .filter(Boolean)
    .sort();

  res.json({
    items: niveles
  });
});

app.get("/api/catalogos/estados", (req, res) => {
  const estados = [...new Set(catalogo.escuelas.map((item) => item.estado))]
    .filter(Boolean)
    .sort();

  res.json({
    items: estados
  });
});

app.get("/api/catalogos/municipios", (req, res) => {
  const estado = normalizar(req.query.estado);

  let escuelas = catalogo.escuelas;

  if (estado) {
    escuelas = escuelas.filter((item) => normalizar(item.estado) === estado);
  }

  const municipios = [...new Set(escuelas.map((item) => item.municipio))]
    .filter(Boolean)
    .sort();

  res.json({
    items: municipios
  });
});

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    message: "Ruta no encontrada"
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`API RutaAcademica funcionando en puerto ${PORT}`);
});