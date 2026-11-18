/**
 * Build the Rivet consultation website for Render's CDN.
 * Its real form connects to a separate server-only Supabase intake gateway;
 * no staff desk, auction bidding or database credentials ship in these assets.
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
  '<strong>Try the seller inquiry walkthrough</strong>',
  '<p><strong>DEMO ONLY:</strong> Please use sample information. Nothing entered here is submitted, stored, or sent to Rivet Auctions.</p>',
  '<form id="rivet-demo-inquiry" autocomplete="off">',
  '<label for="demo-name">Name</label><input id="demo-name" name="name" required maxlength="120" placeholder="Sample Seller">',
  '<label for="demo-email">Email</label><input id="demo-email" name="email" type="email" required placeholder="seller@example.com">',
  '<label for="demo-phone">Phone</label><input id="demo-phone" name="phone" type="tel" placeholder="555-0100">',
  '<label for="demo-address">Property address</label><input id="demo-address" name="propertyAddress" required placeholder="123 Sample Street">',
  '<label for="demo-goal">Selling goals</label><textarea id="demo-goal" name="note" rows="3" placeholder="What would you like to accomplish?"></textarea>',
  '<button class="button primary" type="submit">Preview submission</button>',
  '</form>',
  '<p id="demo-inquiry-status" role="status" aria-live="polite"></p>',
  '<p>To contact the team for real: <a href="mailto:'+contact+'?subject=Rivet%20Auctions%20Seller%20Conversation">Email '+contact+'</a> or <a href="tel:+15127969395">call (512) 796-9395</a>.</p>',
  '</div>'
].join('');
const sellerSrc=await readFile(join(src,'seller-site.html'),'utf8');
if(!sellerSrc.includes('<!-- INQUIRY_WIDGET -->'))throw Error('missing_form_placeholder');
const realForm=[
 '<h3>Tell us about your home.</h3>',
 '<p>Request a consultation. This does not register a bid or create an agreement to sell.</p>',
 '<form id="rivet-seller-inquiry" autocomplete="on">',
 '<label for="live-name">Your name</label><input id="live-name" name="name" minlength="2" maxlength="120" autocomplete="name" required>',
 '<label for="live-email">Email</label><input id="live-email" name="email" type="email" maxlength="254" autocomplete="email" required>',
 '<label for="live-phone">Phone (optional)</label><input id="live-phone" name="phone" type="tel" maxlength="32" autocomplete="tel">',
 '<label for="live-address">Property address</label><input id="live-address" name="propertyAddress" maxlength="200" autocomplete="street-address" required>',
 '<label for="live-reply">How should we reply?</label><select id="live-reply" name="preferredReply"><option value="email">Email</option><option value="call">Phone call</option><option value="text">Text message</option></select>',
 '<label for="live-note">Your goals (optional)</label><textarea id="live-note" name="note" maxlength="1200" rows="3"></textarea>',
 '<div aria-hidden="true" class="bot-field"><label for="live-website">Leave this field blank</label><input id="live-website" type="text" name="website" autocomplete="off" tabindex="-1"></div>',
 '<div class="consent-line"><input id="live-consent" type="checkbox" name="consentToReply" value="yes" required><label for="live-consent">I authorize Rivet Auctions to contact me about this inquiry. This is not permission for ongoing marketing messages.</label></div>',
 '<button type="submit" class="button primary">Send consultation request</button>',
 '<p id="inquiry-status" class="form-status" role="status" aria-live="polite"></p>',
 '</form>',
 '<p class="fine">If the secure form is temporarily unavailable, contact <a href="mailto:'+contact+'?subject=Rivet%20Auctions%20Consultation">'+contact+'</a> or call <a href="tel:+15127969395">(512) 796-9395</a>.</p>',
].join('');
const realSeller=sellerSrc.replace('<!-- INQUIRY_WIDGET -->',realForm);
if(!realSeller.includes('id="rivet-seller-inquiry"'))throw Error('missing_production_form');
await writeFile(join(dst,'index.html'),realSeller);
await cp(join(src,'rivet-seller.js'),join(dst,'assets','rivet-seller.js'));
const demoSeller=sellerSrc.replace('<!-- INQUIRY_WIDGET -->',fallback).replace('SELLER CONSULTATIONS AVAILABLE · NO CURRENT PROPERTY AUCTIONS OR BIDS','DEMO ONLY · NO INFORMATION SENT OR SAVED');
if(demoSeller.includes('id="rivet-seller-inquiry"'))throw Error('demo_must_not_collect');
const demoScript='<script>document.addEventListener("DOMContentLoaded",function(){const form=document.getElementById("rivet-demo-inquiry");if(!form)return;form.addEventListener("submit",function(e){e.preventDefault();if(!form.reportValidity())return;document.getElementById("demo-inquiry-status").textContent="Demo complete. This is an illustrative confirmation only. No inquiry has been sent or saved.";form.reset();});});</script>';
await mkdir(join(dst,'demo'),{recursive:true});
await writeFile(join(dst,'demo','index.html'),demoSeller.replace('</body>',demoScript+'</body>'));

const buyer=await readFile(join(src,'buyer-site.html'),'utf8');
await writeFile(join(dst,'buyers','index.html'),buyer);
await cp(join(src,'rivet-seller.css'),join(dst,'assets','rivet-seller.css'));
await cp(join(src,'favicon.svg'),join(dst,'favicon.svg'));
await writeFile(join(dst,'robots.txt'),'User-agent: *\nDisallow: /\n');

const notice='Consultation inquiries only. This website offers no property, bids, contract signatures, brokerage representation, or payment service.';
const legalHeader='<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/assets/rivet-seller.css">';
const common=(title,body)=>[
 '<!doctype html><html lang="en"><head>',legalHeader,
 '<title>',title,' | Rivet Auctions</title></head><body>',
 '<div class="preview-ribbon">RIVET AUCTIONS · SELLER CONSULTATIONS AVAILABLE</div>',
 '<header class="masthead"><div class="wrap nav-row"><a class="brand" href="/"><span class="brand-emblem">R</span><span class="brand-name">RIVET<small>AUCTIONS</small></span></a><a class="nav-cta" href="/">Return to homepage</a></div></header>',
 '<main class="wrap section" style="max-width:760px;min-height:60vh"><h1 style="font:400 50px Georgia,serif;line-height:1.1;margin:0 0 34px">',title,'</h1>',
 body,'</main><footer><div class="wrap footer-bottom">',notice,'</div></footer></body></html>'
].join('');
const priv=common('Privacy & Contact',[
 '<p>Rivet Auctions accepts consultation inquiries through a secure server endpoint. If you submit the form, the information you provide is used to review and respond to the inquiry. The site does not request payment or auction registration.</p>',
 '<p>Submitted information can include your name, contact details, property address, communication preference and your own description of selling goals. The information is stored in a private Rivet Auctions database and may be reviewed by authorized personnel. We do not promise immediate reply or automatic notifications. Do not send sensitive financial, payment-card or identification details.</p>',
 '<p>Rivet Auctions and a separately engaged listing brokerage are distinct relationships. A message to Rivet Auctions does not automatically transfer your personal information to Rivet Real Estate or enroll you in advertising.</p>',
 '<p>Privacy questions: <a href="mailto:',contact,'?subject=Privacy%20Question">',contact,'</a>. The separate <a href="/demo/">demo walkthrough</a> does not send or store anything.</p>'
].join(''));
const terms=common('Website Use',[
 '<p>',notice,'</p>',
 '<p>General information about auctions, seller reserve, professional representation, MLS participation and cost is educational. Actual property-specific offering documents and separately signed agreements govern real transactions.</p>',
 '<p>Rivet Auctions is the founder-owned auction service. In the proposed service arrangement, a seller first considers its auction agreement and, immediately afterward at the same table, separately considers a Rivet Real Estate listing agreement. No unsigned agreement creates representation or obligates either business.</p>',
 '<p>This website does not guarantee a price, closing date, bidders, or a sale. Do not transmit offers, earnest money, private documents, or payment information through this website.</p>'
].join(''));
await mkdir(join(dst,'privacy'),{recursive:true});
await mkdir(join(dst,'terms'),{recursive:true});
await writeFile(join(dst,'privacy','index.html'),priv);
await writeFile(join(dst,'terms','index.html'),terms);
await writeFile(join(dst,'RELEASE_STATUS.txt'),'CONSULTATION FORM: requests only, with server receipt when enabled. DEMO: no data submitted. No bids, payments, or contracts.\n');
console.log('Rendered Rivet seller consultation form and separate no-data demo. No bids, payment, or contract signing.');
