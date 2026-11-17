/**
 * Safe internet-accessible *preview only* for Render.
 * Intentionally does not expose CRM routes, inquiry submissions, payments,
 * bids, or the private staff desk. No customer data collected.
 * Deploy ONLY to a separate Render preview subdomain.
 */
import {createServer} from 'node:http';
import {createRivetPublicPages} from './public-pages.mjs';

const pages=createRivetPublicPages(); // no Turnstile key -> no form
const port=Number(process.env.PORT || 10000);
if(!Number.isInteger(port)||port<1||port>65535)throw new TypeError('invalid_preview_port');

const server=createServer(async(req,res)=>{
  const headers={'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY'};
  try {
    const url=new URL(req.url||'/', 'http://rivet-preview.invalid');
    if (url.pathname==='/readyz' && req.method==='GET') {
      res.writeHead(200,{...headers,'Content-Type':'text/plain; charset=utf-8'});
      res.end('preview_ready');return;
    }
    if (req.method!=='GET') {
      res.writeHead(405,{...headers,Allow:'GET','Content-Type':'text/plain; charset=utf-8'});
      res.end('Method not allowed');return;
    }
    // Prevent staging host's incoming origin from being trusted or used in the app.
    const request=new Request('https://rivetauctions.com'+url.pathname+url.search,{method:'GET'});
    const response=pages(request);
    if (!response) {
      res.writeHead(404,{...headers,'Content-Type':'text/plain; charset=utf-8'});
      res.end('Not found');return;
    }
    res.writeHead(response.status,Object.fromEntries(response.headers.entries()));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    res.writeHead(503,{...headers,'Content-Type':'text/plain; charset=utf-8'});
    res.end('Preview unavailable');
  }
});
server.requestTimeout=15000;
server.headersTimeout=10000;
server.listen(port,'0.0.0.0',()=>console.log('Rivet seller-only nonproduction preview ready on port '+port));
