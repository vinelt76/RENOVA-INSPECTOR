import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const SUPABASE_VERSION = "2.110.3";
const ESBUILD_VERSION = "0.28.1";
const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const outfile = new URL("../WEB/vendor/supabase-js.mjs", import.meta.url);

async function installedVersion(packageName) {
  const packageJson = new URL(`../node_modules/${packageName}/package.json`, import.meta.url);
  return JSON.parse(await readFile(packageJson, "utf8")).version;
}

const [supabaseVersion, esbuildVersion] = await Promise.all([
  installedVersion("@supabase/supabase-js"),
  installedVersion("esbuild"),
]);

if (supabaseVersion !== SUPABASE_VERSION || esbuildVersion !== ESBUILD_VERSION) {
  throw new Error(
    `Dependencias inesperadas: supabase-js=${supabaseVersion}, esbuild=${esbuildVersion}. ` +
      `Ejecuta npm ci; se esperaban ${SUPABASE_VERSION} y ${ESBUILD_VERSION}.`,
  );
}

const result = await build({
  bundle: true,
  define: {
    "process.env.NODE_ENV": '"production"',
  },
  format: "esm",
  minify: true,
  platform: "browser",
  stdin: {
    contents: 'export { createClient } from "@supabase/supabase-js";',
    loader: "js",
    resolveDir: projectRoot,
    sourcefile: "supabase-vendor-entry.mjs",
  },
  target: "es2022",
  write: false,
});

const header = `/* RENOVA — @supabase/supabase-js ${SUPABASE_VERSION}, esbuild ${ESBUILD_VERSION}.
 * Archivo generado: no editar a mano. Una petición local durante el uso de
 * RENOVA; el import dinámico opcional de OpenTelemetry queda inactivo porque
 * esta aplicación no habilita tracePropagation.
 * Regenerar: npm run vendor:supabase (ver WEB/vendor/README.md). */
`;
const generated = result.outputFiles[0].text.replace(/[ \t]+$/gm, "");

await writeFile(outfile, header + generated);
console.log(`Generado ${fileURLToPath(outfile)} (${Buffer.byteLength(header + generated)} bytes)`);
