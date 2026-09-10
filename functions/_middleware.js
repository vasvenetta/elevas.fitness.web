/**
 * ELEVAS · Middleware de negociación de contenido para Cloudflare Pages
 *
 * 1. Sirve text/markdown cuando un agente lo pide con la cabecera Accept.
 * 2. Añade "Accept" a la cabecera Vary para que la CDN no mezcle variantes.
 * 3. Devuelve un cuerpo markdown recuperable en las respuestas 404.
 *
 * Fallo seguro: cualquier excepción devuelve la respuesta original sin tocar.
 */

const ORIGEN = 'https://elevas-fitness.com';

// Rutas con equivalente markdown. Clave: ruta normalizada. Valor: ruta del .md
const MARKDOWN_MAP = {
  '/': '/md/index.md',
  '/en': '/md/en.md',
  '/about': '/md/about.md',
  '/contact': '/md/contact.md',
  '/privacy': '/md/privacy.md',
};

// Rutas cuyo markdown está en castellano; el resto, en inglés
const EN_CASTELLANO = new Set(['/']);

const NOT_FOUND_MD = `# 404 · Página no encontrada

La ruta solicitada no existe en elevas-fitness.com.

## Dónde continuar

- [Inicio](${ORIGEN}/)
- [English version](${ORIGEN}/en/)
- [About](${ORIGEN}/about/)
- [Contact](${ORIGEN}/contact/)
- [Privacy](${ORIGEN}/privacy/)
- [Aviso legal](${ORIGEN}/aviso-legal/)
- [Política de privacidad y cookies](${ORIGEN}/politica-de-privacidad/)
- [Términos y condiciones](${ORIGEN}/terminos-y-condiciones/)
- [Aplicación](https://app.elevas-fitness.com/)

## Índices del sitio

- [/llms.txt](${ORIGEN}/llms.txt)
- [/sitemap.xml](${ORIGEN}/sitemap.xml)
- [/robots.txt](${ORIGEN}/robots.txt)

## Contacto

contacto@elevas-fitness.com
`;

/** True si el cliente prefiere markdown a html, respetando los factores q. */
function prefersMarkdown(acceptHeader) {
  if (!acceptHeader || typeof acceptHeader !== 'string') return false;
  if (acceptHeader.length > 512) return false;

  let mdQ = -1;
  let htmlQ = -1;

  for (const raw of acceptHeader.split(',')) {
    const parts = raw.trim().toLowerCase().split(';');
    const type = parts[0].trim();
    let q = 1;

    for (const param of parts.slice(1)) {
      const [k, v] = param.split('=').map((s) => (s || '').trim());
      if (k === 'q') {
        const parsed = Number.parseFloat(v);
        if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) q = parsed;
      }
    }

    if (q === 0) continue;
    if (type === 'text/markdown' || type === 'text/x-markdown') {
      if (q > mdQ) mdQ = q;
    } else if (type === 'text/html') {
      if (q > htmlQ) htmlQ = q;
    }
  }

  return mdQ > 0 && mdQ >= htmlQ;
}

/** Minúsculas y sin barra final, salvo la raíz. */
function normalizePath(pathname) {
  let p = pathname.toLowerCase();
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p || '/';
}

/** Añade Accept y Accept-Encoding a Vary sin duplicar. */
function withVaryAccept(headers) {
  const values = (headers.get('Vary') || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

  if (!values.some((v) => v.toLowerCase() === 'accept')) values.push('Accept');
  if (!values.some((v) => v.toLowerCase() === 'accept-encoding')) values.push('Accept-Encoding');

  headers.set('Vary', values.join(', '));
  return headers;
}

export async function onRequest(context) {
  const { request, next, env } = context;

  try {
    const url = new URL(request.url);
    const path = normalizePath(url.pathname);
    const wantsMarkdown = prefersMarkdown(request.headers.get('Accept'));

    // Caso 1: markdown de una ruta con equivalente publicado
    if (wantsMarkdown && Object.prototype.hasOwnProperty.call(MARKDOWN_MAP, path)) {
      const mdUrl = new URL(MARKDOWN_MAP[path], url.origin);
      const mdResponse = await env.ASSETS.fetch(new Request(mdUrl, { method: 'GET' }));

      if (mdResponse.ok) {
        const body = await mdResponse.text();
        const headers = new Headers({
          'Content-Type': 'text/markdown; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
          'X-Content-Type-Options': 'nosniff',
          'Content-Language': EN_CASTELLANO.has(path) ? 'es' : 'en',
          Link: `<${url.origin}${path === '/' ? '/' : path + '/'}>; rel="canonical"`,
        });
        withVaryAccept(headers);
        return new Response(body, { status: 200, headers });
      }
    }

    // Flujo normal: archivos estáticos
    const response = await next();

    // Caso 2: 404 con cuerpo markdown recuperable
    if (response.status === 404 && wantsMarkdown) {
      const headers = new Headers({
        'Content-Type': 'text/markdown; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      withVaryAccept(headers);
      return new Response(NOT_FOUND_MD, { status: 404, headers });
    }

    // Caso 3: respuesta HTML, se corrige Vary para no romper la caché
    const contentType = response.headers.get('Content-Type') || '';
    if (contentType.includes('text/html')) {
      const headers = new Headers(response.headers);
      withVaryAccept(headers);
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    return response;
  } catch (err) {
    try {
      return await next();
    } catch (_) {
      return new Response('Service temporarily unavailable', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  }
}
