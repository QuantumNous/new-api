import { createServer } from "node:http";
import { readFileSync, statSync } from "node:fs";
import { extname, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("./html/", import.meta.url)));
const port = Number(process.env.PORT || 4000);
const host = process.env.HOST || "127.0.0.1";
const routes = new Map([
  ["/", "index.html"], ["/models", "models.html"], ["/docs", "docs.html"],
  ["/playground", "playground.html"], ["/pricing", "topup.html"], ["/compute", "compute.html"],
  ["/usecases", "usecases.html"], ["/contact", "contact.html"], ["/status", "status.html"],
  ["/terms", "terms.html"], ["/privacy", "privacy.html"], ["/refund-policy", "refund-policy.html"],
  ["/sla", "sla.html"], ["/about", "about.html"], ["/zh/about", "about-zh.html"],
  ["/careers", "careers.html"], ["/zh/careers", "careers-zh.html"],
]);
for (const locale of ["zh", "es", "pt", "fr", "id", "de", "vi", "ru", "ja"]) routes.set("/" + locale, locale + ".html");

const mime = {
  ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4", ".png": "image/png", ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8", ".woff2": "font/woff2", ".xml": "application/xml; charset=utf-8",
};

function sendFile(response, relative, status = 200) {
  const absolute = resolve(root, normalize(relative));
  if (absolute !== root && !absolute.startsWith(root + sep)) return response.writeHead(403).end("Forbidden");
  try {
    if (!statSync(absolute).isFile()) throw new Error("not a file");
    response.writeHead(status, { "Content-Type": mime[extname(absolute)] || "application/octet-stream", "Cache-Control": "no-store" });
    response.end(readFileSync(absolute));
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
  }
}

createServer((request, response) => {
  const url = new URL(request.url || "/", "http://" + request.headers.host);
  const pathname = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : url.pathname;
  if (pathname === "/login" || pathname === "/login.html" || pathname === "/signup.html") {
    response.writeHead(pathname === "/login" ? 302 : 301, { Location: "https://console.flatkey.ai/sign-up?redirect=/keys" }).end();
    return;
  }
  if (/^\/models\/[a-zA-Z0-9._-]+$/.test(pathname)) return sendFile(response, "model.html");
  if (routes.has(pathname)) return sendFile(response, routes.get(pathname));
  sendFile(response, pathname.replace(/^\/+/, ""));
}).listen(port, host, () => console.log("Flatkey local preview: http://" + host + ":" + port));
