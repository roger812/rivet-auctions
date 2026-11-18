/**
 * Build static, no-data Rivet Auctions brochure for Render's CDN.
 * No customer intake, staff desk, auction bidding or secret-dependent APIs.
 */
import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join,dirname} from 'node:path';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const src=join(root,'public');
const dst=join(root,'dist');
const contact='info@rivetauctions.com';
await mkdir(join(dst,'assets'),{recursive:true});
await mkdir(join(dst,'buyers'),{recursive:true});

const fallback=[
  '<div class="form-unavailable">',
  '<strong>Email us about your property.</strong>',
  '<p>Tell the team about the home and your goals. This opens your own email app; this page does not submit or save information.</p>',
  '<p><a href="mailto:'+contact+'?subject=Rivet%20Auctions%20Seller%20Conversation">Email '+contact+'</a></p>',
  '<p>Prefer to call or text? <a href="tel:+15127969395">(512) 796-9395</a>.</p>',
  '<p>We do not claim your request was received until the team confirms it.</p>',
  '</div>'
].join('');
const sellerSrc=await readFile(join(src,'seller-site.html'),'utf8');
if(!sellerSrc.includes('<!-- INQUIRY_WIDGET -->'))throw Error('missing_form_placeholder');
const seller=sellerSrc.replace('<!-- INQUIRY_WIDGET -->',fallback);
if(seller.includes('id="rivet-seller-inquiry"'))throw Error('unconnected_form_prohibited');
await writeFile(join(dst,'index.html'),seller);

const buyer=await readFile(join(src,'buyer-site.html'),'utf8');
await writeFile(join(dst,'buyers','index.html'),buyer);
await cp(join(src,'rivet-seller.css'),join(dst,'assets','rivet-seller.css'));
await cp(join(src,'favicon.svg'),join(dst,'favicon.svg'));
await writeFile(join(dst,'robots.txt'),'User-agent: *\nDisallow: /\n');

const notice='This development website is informational. It offers no property, bids, contract signatures, brokerage representation, or payment service.';
const legalHeader='<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/assets/rivet-seller.css">';
const common=(title,body)=>[
 '<!doctype html><html lang="en"><head>',legalHeader,
 '<title>',title,' | Rivet Auctions</title></head><body>',
 '<div class="preview-ribbon">RIVET AUCTIONS · DEVELOPMENT PREVIEW</div>',
 '<header class="masthead"><div class="wrap nav-row"><a class="brand" href="/"><span class="brand-emblem">R</span><span class="brand-name">RIVET<small>AUCTIONS</small></span></a><a class="nav-cta" href="/">Return to homepage</a></div></header>',
 '<main class="wrap section" style="max-width:760px;min-height:60vh"><h1 style="font:400 50px Georgia,serif;line-height:1.1;margin:0 0 34px">',title,'</h1>',
 body,'</main><footer><div class="wrap footer-bottom">',notice,'</div></footer></body></html>'
].join('');
const priv=common('Privacy & Contact',[
 '<p>This development preview does not accept form submissions or intentionally install advertising trackers. You can contact Rivet Auctions through your own email or telephone application.</p>',
 '<p>If you write or call, your provider sends your message and details to our contact address or number. The team may use those details to respond to the specific inquiry you initiated. Do not email sensitive financial records or payment-card numbers in an initial request.</p>',
 '<p>Rivet Auctions and a separately engaged listing brokerage are distinct relationships. A message to Rivet Auctions does not automatically transfer your personal information to Rivet Real Estate or enroll you in advertising.</p>',
 '<p>Privacy questions: <a href="mailto:',contact,'?subject=Privacy%20Question">',contact,'</a>. This notice is for the no-data preview and requires further review before interactive collection is activated.</p>'
].join(''));
const terms=common('Website Use',[
 '<p>',notice,'</p>',
 '<p>General information about auctions, seller reserve, professional representation, MLS participation and cost is educational. Actual property-specific offering documents and separately signed agreements govern real transactions.</p>',
 '<p>Rivet Auctions is the founder-owned auction service. In the proposed service arrangement, a seller first considers its auction agreement and, immediately afterward at the same table, separately considers a Rivet Real Estate listing agreement. No unsigned agreement creates representation or obligates either business.</p>',
 '<p>This website does not guarantee a price, closing date, bidders, or a sale. Do not transmit offers, earnest money, private documents, or payment information through this preview.</p>'
].join(''));
await mkdir(join(dst,'privacy'),{recursive:true});
await mkdir(join(dst,'terms'),{recursive:true});
await writeFile(join(dst,'privacy','index.html'),priv);
await writeFile(join(dst,'terms','index.html'),terms);
await writeFile(join(dst,'RELEASE_STATUS.txt'),'PREVIEW ONLY: no customer intake, staff routes, tracking, bids, payments, or approved contract terms.\n');
console.log('Rendered CDN preview: seller, buyers, privacy and terms. No form handlers.');
