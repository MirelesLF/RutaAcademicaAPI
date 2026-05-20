const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { pipeline } = require("stream");

const inputFile = path.join(__dirname, "..", "data", "escuelas.min.json");
const outputFile = path.join(__dirname, "..", "data", "escuelas.min.json.gz");

if (!fs.existsSync(inputFile)) {
  console.error("No existe data/escuelas.min.json");
  console.error("Primero ejecuta: npm.cmd run minimizar:escuelas");
  process.exit(1);
}

const gzip = zlib.createGzip({ level: 9 });

console.log("Comprimiendo catalogo...");

pipeline(
  fs.createReadStream(inputFile),
  gzip,
  fs.createWriteStream(outputFile),
  (error) => {
    if (error) {
      console.error("Error al comprimir:", error.message);
      process.exit(1);
    }

    const size = fs.statSync(outputFile).size;

    console.log("Archivo comprimido generado:", outputFile);
    console.log("Tamaño:", size, "bytes");
  }
);