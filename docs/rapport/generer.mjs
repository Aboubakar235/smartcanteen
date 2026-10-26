// Produit Smart_Canteen_Rapport_de_realisation.pdf à partir de couverture.html et rapport.html.
// Usage : node generer.mjs   (nécessite Google Chrome, macOS pour l'assemblage)
//
// La table des matières est remplie en deux passes : un premier rendu situe
// chaque titre dans le PDF, le second inscrit ces numéros de page.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ICI = dirname(fileURLToPath(import.meta.url));
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const SORTIE = join(ICI, "Smart_Canteen_Rapport_de_realisation.pdf");
const tmp = mkdtempSync(join(tmpdir(), "rapport-"));

function imprimer(html, pdf) {
  execFileSync(CHROME, [
    "--headless", "--disable-gpu", "--no-pdf-header-footer",
    "--virtual-time-budget=15000", `--print-to-pdf=${pdf}`, `file://${html}`,
  ], { stdio: "ignore" });
}

function osa(script, ...args) {
  return execFileSync("osascript", ["-l", "JavaScript", "-", ...args], { input: script }).toString().trim();
}

// Texte de chaque page, pour retrouver où tombe chaque titre.
function textesDesPages(pdf) {
  return JSON.parse(osa(`ObjC.import('PDFKit');
function run(a){ const d=$.PDFDocument.alloc.initWithURL($.NSURL.fileURLWithPath(a[0])); const t=[];
for(let i=0;i<d.pageCount;i++){ t.push(d.pageAtIndex(i).string.js || ''); } return JSON.stringify(t); }`, pdf));
}

// NFKC défait les ligatures de la police (« ﬃ » de « Difficultés ») ; la césure ne touche pas les titres.
const normaliser = (s) => s.normalize("NFKC").replace(/[’']/g, "'").replace(/\s+/g, " ").trim();

const source = readFileSync(join(ICI, "rapport.html"), "utf8");
const titres = [...source.matchAll(/<h([23]) id="([^"]+)"[^>]*><span class="num">([^<]+)<\/span>([^<]+)<\/h\1>/g)]
  .map(([, niveau, id, num, titre]) => ({ niveau: Number(niveau), id, num, titre: titre.trim() }));

function avecSommaire(pages) {
  const lignes = titres.map((t) => {
    const classe = t.niveau === 2 ? "sec" : "ssec";
    return `<li class="${classe}"><span class="n">${t.num}</span><span class="t">${t.titre}</span><span class="p">${pages[t.id] ?? ""}</span></li>`;
  }).join("\n");
  return source.replace('<ul class="toc" id="toc"></ul>', `<ul class="toc" id="toc">\n${lignes}\n</ul>`);
}

function rendreCorps(pages) {
  const html = join(ICI, ".rapport-genere.html");
  writeFileSync(html, avecSommaire(pages));
  const pdf = join(tmp, "corps.pdf");
  imprimer(html, pdf);
  rmSync(html);
  return pdf;
}

// Passe 1 : situer les titres (le sommaire a déjà sa taille finale, seuls les numéros manquent).
const brouillon = textesDesPages(rendreCorps(Object.fromEntries(titres.map((t) => [t.id, "00"]))));
const debutCorps = brouillon.findIndex((t) => normaliser(t).includes(normaliser(`1 ${titres[0].titre}`)) && !t.includes("Table des matières"));
const pages = {};
for (const t of titres) {
  const cherche = normaliser(`${t.num} ${t.titre}`);
  const i = brouillon.findIndex((texte, n) => n >= debutCorps && normaliser(texte).includes(cherche));
  if (i < 0) throw new Error(`Titre introuvable dans le PDF : ${cherche}`);
  pages[t.id] = i + 1;
}

// Passe 2 : rendu final, puis couverture + corps dans un seul PDF.
const corps = rendreCorps(pages);
const couverture = join(tmp, "couverture.pdf");
imprimer(join(ICI, "couverture.html"), couverture);

const total = osa(`ObjC.import('PDFKit');
function run(a){ const c=$.PDFDocument.alloc.initWithURL($.NSURL.fileURLWithPath(a[0]));
const b=$.PDFDocument.alloc.initWithURL($.NSURL.fileURLWithPath(a[1]));
for(let i=0;i<b.pageCount;i++){ c.insertPageAtIndex(b.pageAtIndex(i), c.pageCount); }
c.writeToFile(a[2]); return String(c.pageCount); }`, couverture, corps, SORTIE);

rmSync(tmp, { recursive: true, force: true });
console.log(`${SORTIE} : ${total} pages`);
console.log(titres.filter((t) => t.niveau === 2).map((t) => `  ${t.num} ${t.titre} … p. ${pages[t.id]}`).join("\n"));
