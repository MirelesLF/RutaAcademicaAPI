const fs = require("fs");
const path = require("path");

const filePath = path.resolve(process.argv[2] || "data/escuelas.json");

if (!fs.existsSync(filePath)) {
  console.error(`No existe el archivo: ${filePath}`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

if (!Array.isArray(data)) {
  console.error("El archivo debe contener un arreglo JSON.");
  process.exit(1);
}

const required = ["id", "cct", "nombre", "nivel", "estado", "municipio"];
const errors = [];
const ids = new Set();

for (const [index, item] of data.entries()) {
  for (const field of required) {
    if (!item[field]) errors.push(`Fila ${index}: falta ${field}`);
  }
  if (ids.has(item.id)) errors.push(`Fila ${index}: id duplicado ${item.id}`);
  ids.add(item.id);
}

console.log(`Registros revisados: ${data.length}`);
console.log(`Errores encontrados: ${errors.length}`);

if (errors.length > 0) {
  console.log(errors.slice(0, 25).join("\n"));
  process.exit(1);
}

console.log("Datos correctos.");
