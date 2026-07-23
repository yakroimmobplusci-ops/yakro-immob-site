// Fonction Edge Netlify — génère un aperçu Facebook/WhatsApp/Twitter spécifique
// à chaque terrain, en lisant le même Google Sheet que le site.
// Ne s'active QUE pour les robots des réseaux sociaux (Facebook, WhatsApp, Twitter...).
// Pour un visiteur humain normal, le site fonctionne exactement comme avant.

const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQl6VzNt0Tg0PNE5d7WQLiQ6eKrbWSCyt-H-oZwS7ffscZH9bBanFi2Ohsh-Hoo8SwAIq1aWecwfwar/pub?gid=0&single=true&output=csv";
const SITE_URL = "https://gilded-marshmallow-cc73cd.netlify.app";
const DEFAULT_IMAGE = SITE_URL + "/og-image.png";

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Analyseur CSV simple, identique en logique à celui du site
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else { inQ = false; }
      } else { cur += c; }
    } else {
      if (c === '"') { inQ = true; }
      else if (c === ',') { row.push(cur); cur = ""; }
      else if (c === '\r') { /* ignoré */ }
      else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ""; }
      else { cur += c; }
    }
  }
  if (cur !== "" || row.length > 0) { row.push(cur); rows.push(row); }
  const clean = rows.map(r => r.map(v => v.trim())).filter(r => r.length > 0 && r.some(v => v !== ""));
  if (clean.length === 0) return [];
  const headers = clean[0].map(h => h.toLowerCase());
  return clean.slice(1).map(r => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = r[i] || "");
    return obj;
  });
}

export default async (request, context) => {
  const userAgent = request.headers.get("user-agent") || "";
  const isBot = /facebookexternalhit|Facebot|WhatsApp|Twitterbot|LinkedInBot|Slackbot|TelegramBot|Discordbot|Pinterest/i.test(userAgent);

  const url = new URL(request.url);
  const terrain = url.searchParams.get("terrain");

  // Visiteur humain normal, ou pas de terrain précis dans le lien → site normal, inchangé
  if (!isBot || !terrain) {
    return context.next();
  }

  try {
    const res = await fetch(SHEET_CSV_URL);
    if (!res.ok) return context.next();
    const text = await res.text();
    const rows = parseCSV(text);
    const item = rows.find(r => (r["numero"] || r["n°"] || "") === terrain);

    if (!item) return context.next();

    const categorie = item["categorie"] || item["catégorie"] || "Terrain";
    const localisation = item["localisation"] || "";
    const superficie = item["superficie"] || "";
    const prix = item["prix"] || "";
    const image = item["image"] || DEFAULT_IMAGE;

    const title = `${categorie} ${terrain} — ${localisation} | Yakro Immob+`;
    const description = [superficie, prix].filter(Boolean).join(" · ") || "Voir les détails sur Yakro Immob+";

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta property="og:url" content="${escapeHtml(url.toString())}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${escapeHtml(image)}">
<title>${escapeHtml(title)}</title>
</head>
<body>
<p>${escapeHtml(title)}</p>
</body>
</html>`;

    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
  } catch (e) {
    return context.next();
  }
};

export const config = { path: "/" };
