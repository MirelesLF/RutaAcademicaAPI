const fs = require("fs");
const path = require("path");

const inputFile = path.join(__dirname, "..", "data", "escuelas.json");
const outputFile = path.join(__dirname, "..", "data", "escuelas.min.json");

function limpiarTexto(valor) {
  return String(valor || "").replace(/\s+/g, " ").trim();
}

if (!fs.existsSync(inputFile)) {
  console.error("No existe data/escuelas.json");
  console.error("Primero ejecuta: npm.cmd run importar:escuelas -- raw data/escuelas.json");
  process.exit(1);
}

console.log("Leyendo catalogo completo...");
const escuelas = JSON.parse(fs.readFileSync(inputFile, "utf8"));

console.log("Reduciendo campos...");
const escuelasMin = escuelas.map((escuela) => ({
  id: escuela.id,
  cct: escuela.cct,
  nombre: limpiarTexto(escuela.nombre),
  nivel: limpiarTexto(escuela.nivel),
  estado: limpiarTexto(escuela.estado),
  municipio: limpiarTexto(escuela.municipio),
  localidad: limpiarTexto(escuela.localidad)
}));

fs.writeFileSync(outputFile, JSON.stringify(escuelasMin), "utf8");

const size = fs.statSync(outputFile).size;

console.log("Archivo generado:", outputFile);
console.log("Escuelas:", escuelasMin.length);
console.log("Tamaño:", size, "bytes");