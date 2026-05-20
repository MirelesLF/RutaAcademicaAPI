const fs = require("fs");
const path = require("path");
const readline = require("readline");

const inputDir = process.argv[2] || "raw";
const outputFile = process.argv[3] || path.join("data", "escuelas.json");

function limpiarTexto(valor) {
  return String(valor || "")
    .replace(/^\uFEFF/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizar(valor) {
  return limpiarTexto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function contarSeparador(linea, separador) {
  let count = 0;
  let dentroComillas = false;

  for (let i = 0; i < linea.length; i++) {
    const char = linea[i];

    if (char === '"') {
      dentroComillas = !dentroComillas;
    }

    if (char === separador && !dentroComillas) {
      count++;
    }
  }

  return count;
}

function detectarSeparador(linea) {
  const separadores = [",", ";", "|", "\t"];
  let mejorSeparador = ",";
  let mayorCantidad = -1;

  for (const separador of separadores) {
    const cantidad = contarSeparador(linea, separador);

    if (cantidad > mayorCantidad) {
      mayorCantidad = cantidad;
      mejorSeparador = separador;
    }
  }

  return mejorSeparador;
}

function separarCsv(linea, separador) {
  const valores = [];
  let actual = "";
  let dentroComillas = false;

  for (let i = 0; i < linea.length; i++) {
    const char = linea[i];
    const siguiente = linea[i + 1];

    if (char === '"' && siguiente === '"') {
      actual += '"';
      i++;
      continue;
    }

    if (char === '"') {
      dentroComillas = !dentroComillas;
      continue;
    }

    if (char === separador && !dentroComillas) {
      valores.push(limpiarTexto(actual));
      actual = "";
      continue;
    }

    actual += char;
  }

  valores.push(limpiarTexto(actual));
  return valores;
}

function buscarColumna(headers, opciones) {
  const headersNormalizados = headers.map(normalizar);
  const opcionesNormalizadas = opciones.map(normalizar);

  for (const opcion of opcionesNormalizadas) {
    const index = headersNormalizados.findIndex((header) => header === opcion);
    if (index !== -1) return index;
  }

  for (const opcion of opcionesNormalizadas) {
    const index = headersNormalizados.findIndex((header) => {
      return header.includes(opcion) || opcion.includes(header);
    });

    if (index !== -1) return index;
  }

  return -1;
}

function detectarColumnas(headers) {
  return {
    cct: buscarColumna(headers, [
      "CCT",
      "CLAVE CCT",
      "CLAVE_CCT",
      "CLAVECCT",
      "CVE CCT",
      "CVE_CCT",
      "CVECCT",
      "CLAVE DEL CENTRO DE TRABAJO",
      "CLAVE_CENTRO_TRABAJO",
      "CLAVECENTROTRABAJO",
      "CLAVE CT",
      "CLAVE_CT",
      "CLAVECT"
    ]),
    nombre: buscarColumna(headers, [
      "NOMBRE",
      "NOMBRE CT",
      "NOMBRE_CT",
      "NOMBRECT",
      "NOMBRE DEL CENTRO DE TRABAJO",
      "NOMBRE_CENTRO_TRABAJO",
      "NOMBRECENTROTRABAJO",
      "NOM CT",
      "NOM_CT",
      "NOMCT",
      "NOMBRE DE LA ESCUELA",
      "NOMBRE_ESCUELA"
    ]),
    nivel: buscarColumna(headers, [
      "NIVEL",
      "NIVEL EDUCATIVO",
      "NIVEL_EDUCATIVO",
      "NIVELEDUCATIVO",
      "TIPO EDUCATIVO",
      "TIPO_EDUCATIVO",
      "TIPOEDUCATIVO",
      "SERVICIO EDUCATIVO",
      "SERVICIO_EDUCATIVO",
      "SERVICIOEDUCATIVO",
      "DES NIVEL",
      "DES_NIVEL",
      "DESC NIVEL",
      "DESC_NIVEL"
    ]),
    servicio: buscarColumna(headers, [
      "SERVICIO",
      "SERVICIO EDUCATIVO",
      "SERVICIO_EDUCATIVO",
      "SERVICIOEDUCATIVO",
      "TIPO SERVICIO",
      "TIPO_SERVICIO",
      "TIPOSERVICIO",
      "SUBNIVEL",
      "MODALIDAD"
    ]),
    estado: buscarColumna(headers, [
      "ESTADO",
      "ENTIDAD",
      "ENTIDAD FEDERATIVA",
      "ENTIDAD_FEDERATIVA",
      "ENTIDADFEDERATIVA",
      "NOMBRE ENTIDAD",
      "NOMBRE_ENTIDAD",
      "NOMBREENTIDAD",
      "NOM ENT",
      "NOM_ENT",
      "NOMENT"
    ]),
    municipio: buscarColumna(headers, [
      "MUNICIPIO",
      "NOMBRE MUNICIPIO",
      "NOMBRE_MUNICIPIO",
      "NOMBREMUNICIPIO",
      "NOM MUN",
      "NOM_MUN",
      "NOMMUN"
    ]),
    localidad: buscarColumna(headers, [
      "LOCALIDAD",
      "NOMBRE LOCALIDAD",
      "NOMBRE_LOCALIDAD",
      "NOMBRELOCALIDAD",
      "NOM LOC",
      "NOM_LOC",
      "NOMLOC"
    ]),
    turno: buscarColumna(headers, [
      "TURNO",
      "NOMBRE TURNO",
      "NOMBRE_TURNO",
      "NOMBRETURNO",
      "DES TURNO",
      "DES_TURNO"
    ]),
    sostenimiento: buscarColumna(headers, [
      "SOSTENIMIENTO",
      "CONTROL",
      "TIPO SOSTENIMIENTO",
      "TIPO_SOSTENIMIENTO",
      "TIPOSOSTENIMIENTO",
      "NOMBRE SOSTENIMIENTO",
      "NOMBRE_SOSTENIMIENTO"
    ]),
    domicilio: buscarColumna(headers, [
      "DOMICILIO",
      "DIRECCION",
      "DIRECCIÓN",
      "CALLE",
      "UBICACION",
      "UBICACIÓN"
    ]),
    codigoPostal: buscarColumna(headers, [
      "CP",
      "CODIGO POSTAL",
      "CÓDIGO POSTAL",
      "CODIGO_POSTAL",
      "CODIGOPOSTAL"
    ])
  };
}

function obtener(row, index) {
  if (index === -1) return "";
  return limpiarTexto(row[index]);
}

function mapearNivel(texto) {
  const t = normalizar(texto);

  if (!t) return "Otro";

  if (
    t.includes("POSGRADO") ||
    t.includes("MAESTRIA") ||
    t.includes("MAESTRIA") ||
    t.includes("DOCTORADO") ||
    t.includes("ESPECIALIDAD")
  ) {
    return "Posgrado";
  }

  if (
    t.includes("SUPERIOR") ||
    t.includes("LICENCIATURA") ||
    t.includes("UNIVERSIDAD") ||
    t.includes("TECNOLOGICO") ||
    t.includes("TECNOLOGICA") ||
    t.includes("INSTITUTO TECNOLOGICO") ||
    t.includes("NORMAL") ||
    t.includes("INGENIERIA")
  ) {
    return "Universidad";
  }

  if (
    t.includes("MEDIA SUPERIOR") ||
    t.includes("MEDIASUPERIOR") ||
    t.includes("BACHILLERATO") ||
    t.includes("PREPARATORIA") ||
    t.includes("CBTIS") ||
    t.includes("CETIS") ||
    t.includes("CONALEP") ||
    t.includes("CECYTE") ||
    t.includes("COBACH")
  ) {
    return "Preparatoria";
  }

  if (
    t.includes("SECUNDARIA") ||
    t.includes("TELESECUNDARIA")
  ) {
    return "Secundaria";
  }

  if (t.includes("PRIMARIA")) {
    return "Primaria";
  }

  if (
    t.includes("PREESCOLAR") ||
    t.includes("INICIAL")
  ) {
    return "Preescolar";
  }

  return "Otro";
}

function mapearSostenimiento(texto) {
  const t = normalizar(texto);

  if (!t) return "";

  if (
    t.includes("PARTICULAR") ||
    t.includes("PRIVADO") ||
    t.includes("PRIVADA")
  ) {
    return "Privado";
  }

  if (
    t.includes("PUBLICO") ||
    t.includes("PUBLICA") ||
    t.includes("FEDERAL") ||
    t.includes("ESTATAL") ||
    t.includes("MUNICIPAL")
  ) {
    return "Público";
  }

  return limpiarTexto(texto);
}

function crearId(cct, turno, nombre, municipio) {
  const base = cct || `${nombre}-${municipio}`;
  const turnoFinal = turno || "SIN TURNO";
  return `${normalizar(base)}-${normalizar(turnoFinal)}`;
}

async function procesarArchivo(filePath, writer, estadoGlobal) {
  const stream = fs.createReadStream(filePath, { encoding: "utf8" });

  const rl = readline.createInterface({
    input: stream,
    crlfDelay: Infinity
  });

  let headers = null;
  let separador = ",";
  let columnas = null;
  let importadas = 0;
  let omitidas = 0;

  console.log(`Procesando: ${filePath}`);

  for await (const lineaOriginal of rl) {
    const linea = limpiarTexto(lineaOriginal);

    if (!linea) continue;
    if (linea.toLowerCase().startsWith("sep=")) continue;

    if (!headers) {
      separador = detectarSeparador(linea);
      headers = separarCsv(linea, separador);
      columnas = detectarColumnas(headers);

      console.log("Separador detectado:", separador === "\t" ? "TAB" : separador);
      console.log("Columnas detectadas:", columnas);

      if (columnas.cct === -1 || columnas.nombre === -1) {
        console.log("No se detectaron columnas principales.");
        console.log("Encabezados encontrados:");
        console.log(headers);
        throw new Error("No se pudo detectar CCT o nombre de escuela.");
      }

      continue;
    }

    const row = separarCsv(linea, separador);

    const cct = obtener(row, columnas.cct);
    const nombre = obtener(row, columnas.nombre);

    if (!nombre) {
      omitidas++;
      continue;
    }

    const estado = obtener(row, columnas.estado);
    const municipio = obtener(row, columnas.municipio);
    const localidad = obtener(row, columnas.localidad);
    const turno = obtener(row, columnas.turno) || "Sin turno";
    const sostenimiento = mapearSostenimiento(obtener(row, columnas.sostenimiento));
    const domicilio = obtener(row, columnas.domicilio);
    const codigoPostal = obtener(row, columnas.codigoPostal);

    const nivelOriginal = [
      obtener(row, columnas.nivel),
      obtener(row, columnas.servicio),
      nombre
    ].filter(Boolean).join(" ");

    const nivel = mapearNivel(nivelOriginal);

    const id = crearId(cct, turno, nombre, municipio);

    if (estadoGlobal.ids.has(id)) {
      omitidas++;
      continue;
    }

    estadoGlobal.ids.add(id);

    const escuela = {
      id,
      cct,
      nombre,
      nivel,
      nivelOriginal: limpiarTexto(nivelOriginal),
      estado,
      municipio,
      localidad,
      turno,
      sostenimiento,
      domicilio,
      codigoPostal,
      source: "oficial"
    };

    if (!estadoGlobal.primero) {
      writer.write(",\n");
    }

    writer.write(JSON.stringify(escuela));
    estadoGlobal.primero = false;

    estadoGlobal.total++;
    estadoGlobal.porNivel[nivel] = (estadoGlobal.porNivel[nivel] || 0) + 1;
    importadas++;
  }

  console.log(`Importadas de este archivo: ${importadas}`);
  console.log(`Omitidas de este archivo: ${omitidas}`);
}

async function main() {
  const inputPath = path.resolve(inputDir);
  const outputPath = path.resolve(outputFile);

  if (!fs.existsSync(inputPath)) {
    throw new Error(`No existe la carpeta: ${inputPath}`);
  }

  const archivos = fs.readdirSync(inputPath)
    .filter((file) => file.toLowerCase().endsWith(".csv"))
    .map((file) => path.join(inputPath, file));

  if (archivos.length === 0) {
    throw new Error("No se encontraron archivos CSV.");
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const writer = fs.createWriteStream(outputPath, { encoding: "utf8" });

  const estadoGlobal = {
    total: 0,
    primero: true,
    ids: new Set(),
    porNivel: {}
  };

  console.log(`Archivos CSV encontrados: ${archivos.length}`);

  writer.write("[\n");

  for (const file of archivos) {
    await procesarArchivo(file, writer, estadoGlobal);
  }

  writer.write("\n]");

  await new Promise((resolve) => writer.end(resolve));

  console.log("Escuelas importadas:", estadoGlobal.total);
  console.log("Resumen por nivel:", estadoGlobal.porNivel);
  console.log("Archivo generado:", outputPath);

  if (estadoGlobal.total === 0) {
    console.log("No se importó ninguna escuela. Revisa los encabezados del CSV.");
  }
}

main().catch((error) => {
  console.error("Error al importar escuelas:");
  console.error(error.message);
  process.exit(1);
});