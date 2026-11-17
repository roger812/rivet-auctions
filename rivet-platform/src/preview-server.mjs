/**
 * Local-only visual preview of the seller site. This intentionally does NOT
 * install mock database, staff, consent, email, or payment adapters.
 *
 * Usage: npm run preview (within rivet-platform) then open localhost:4173.
 * Do not deploy this server or bind it to a public network interface.
 */
import {createServer} from 'node:http';
import {createRivetPublicPages} from './public-pages.mjs';

const pages=createRivetPublicPages();
const port=Number(process.env.PORT || 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new TypeError('invalid_preview_port');

const server=createServer(async(req,res)=>{
  try {
    const target=new URL(req.url || '/', 'http://localhost:' + port);
    const request=new Request('https://rivetauctions.com' + target.pathname + target.search, {method:req.method || 'GET'});
    const result=pages(request);
    if (!result) {
      res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8','X-Robots-Tag':'noindex'});
      res.end('Not found'); return;
    }
    const headers=Object.fromEntries(result.headers.entries());
    res.writeHead(result.status,headers);
    res.end(Buffer.from(await result.arrayBuffer()));
  } catch {
    res.writeHead(503,{'Content-Type':'text/plain; charset=utf-8'});
    res.end('Preview unavailable');
  }
});
server.listen(port,'127.0.0.1',()=>console.log('Rivet local-only seller preview: http://127.0.0.1:'+port));
