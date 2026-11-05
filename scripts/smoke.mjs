// Kiểm tra khói trên trình duyệt thật (chế độ Chơi thử): vuốt ve, cho ăn, trò chuyện, nhật ký, lớn lên, tắm, chơi, ngủ,
// Sổ loài, cửa hàng, âm thanh, cá tính. Chạy sau `npm run build`: node scripts/smoke.mjs   (cần Playwright + Chromium). Thoát mã 1 nếu có lỗi.
import { createRequire } from 'node:module';
import http from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');

const root = new URL('../dist/', import.meta.url).pathname;
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml' };
const PORT = 4191;
const srv = http.createServer((q, r) => {
  let f = join(root, decodeURIComponent(q.url.split('?')[0]));
  if (!existsSync(f) || statSync(f).isDirectory()) f = join(root, 'index.html');
  r.setHeader('content-type', types[extname(f)] || 'application/octet-stream'); r.end(readFileSync(f));
}).listen(PORT);
const out=[];const ok=(n,c,x='')=>{out.push((c?'OK  ':'FAIL')+' '+n+(x?' '+x:''));};
(async()=>{const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await (await b.newContext({viewport:{width:1100,height:720}})).newPage();
const errs=[];p.on('pageerror',e=>errs.push('PAGE '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push('CON '+m.text())});
const demo=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('hatchday-demo')));
await p.goto(`http://localhost:${PORT}/?dev`);await p.waitForTimeout(800);await p.click('#demo');await p.waitForTimeout(500);
await p.click('button[type=submit]');await p.waitForTimeout(7000);
// vuốt ve
const box=await (await p.$('canvas')).boundingBox();
await p.mouse.move(box.x+box.width/2,box.y+box.height*0.5);await p.mouse.down();for(let i=0;i<8;i++){await p.mouse.move(box.x+box.width/2+(i%2?30:-30),box.y+box.height*0.5);await p.waitForTimeout(60);}await p.mouse.up();
// cho ăn
await p.click('#a-eat');await p.waitForTimeout(1500);
ok('khay thức ăn hiện',await p.isVisible('#tray'));
const before=(await demo()).pet.no;
await p.click('#tray .food[data-id="kem"]');await p.waitForTimeout(3500);
await p.click('#a-eat').catch(()=>{});await p.waitForTimeout(100);
const d1=await demo();ok('cho ăn gửi lên server (demo)',d1.days[Object.keys(d1.days)[0]]?.fed>=1,'fed='+d1.days[Object.keys(d1.days)[0]]?.fed);
ok('cho ăn dùng hết một phần trong kho',d1.owned.kem===1,'kem='+d1.owned.kem);
// về nhà, nói chuyện
await p.evaluate(()=>{});
await p.click('#a-talk');await p.fill('#chat-input','Chào bé, hôm nay tôi hơi mệt vì deadline');await p.press('#chat-input','Enter');await p.waitForTimeout(1200);
ok('chat trả lời',(await p.textContent('#bubble')).length>3,JSON.stringify(await p.textContent('#bubble')));
await p.click('#a-talk');
// nhật ký
await p.click('#btn-diary');await p.waitForTimeout(300);
ok('nhật ký hiện trang hôm nay',(await p.textContent('#dpanel')).includes('đang viết trang hôm nay'));
await p.click('#tab-mem');await p.waitForTimeout(200);ok('ký ức có nội dung',(await p.textContent('#dpanel')).length>20);
await p.click('#btn-diary');
// bảng chỉ số + thẻ loài + tua ngày
await p.click('#btn-stats');await p.waitForTimeout(300);
ok('thẻ loài',(await p.textContent('#species-card')).includes('ngày tuổi'));
await p.click('#btn-age');await p.waitForTimeout(150);await p.click('#btn-age');await p.waitForTimeout(150);
await p.click('#btn-stats');await p.waitForTimeout(500);
const midGlow=await p.evaluate(()=>document.querySelectorAll('.evo-flash').length);
await p.waitForTimeout(6000);
ok('lên Nhí',(await demo()).pet.stage==='child');
// tắm
await p.click('#a-bath');await p.waitForTimeout(2500);
const cb=await (await p.$('canvas')).boundingBox();
await p.mouse.move(cb.x+cb.width/2,cb.y+cb.height*0.55);await p.mouse.down();for(let i=0;i<12;i++){await p.mouse.move(cb.x+cb.width/2+(i%2?40:-40),cb.y+cb.height*0.55);await p.waitForTimeout(50);}await p.mouse.up();
await p.waitForTimeout(500);
const rb=await p.$('.ctx-btn[data-k="rinse"]');ok('có nút xả nước',!!rb);if(rb){await rb.click();await p.waitForTimeout(3500);}
ok('đã tắm',((d)=>Object.values(d.days).some(x=>x.bath>=1))(await demo()));
// chơi
await p.click('#a-play');await p.waitForTimeout(2500);
const bb=await p.$('.ctx-btn[data-k="ball"]');if(bb){await bb.click();for(let i=0;i<12&&!((d)=>Object.values(d.days).some(x=>x.ball>=1))(await demo());i++)await p.waitForTimeout(2500);}ok('đã ném bóng',((d)=>Object.values(d.days).some(x=>x.ball>=1))(await demo()));
const hb=await p.$('.ctx-btn[data-k="home"]');if(hb){await hb.click();await p.waitForTimeout(2500);}
// ngủ / dậy
await p.click('#a-sleep');await p.waitForTimeout(3000);ok('ngủ',(await demo()).pet.asleep===true);
const au=()=>p.evaluate(()=>window.__audio());
ok('âm thanh chạy, nhạc ru ngủ',(await au()).ctx==='running'&&(await au()).mood==='sleep',JSON.stringify(await au()));
await p.click('#a-sleep');await p.waitForTimeout(3000);ok('dậy',(await demo()).pet.asleep===false);
// nhà: cửa hàng + sổ loài
await p.click('#a-house');await p.click('.tile[data-go="dex"]');await p.waitForTimeout(2500);ok('sổ loài mở',await p.isVisible('#dex'));
await p.click('.hsheet:not([hidden]) [data-close]');await p.waitForTimeout(300);
await p.click('#a-house');await p.click('.tile[data-go="shop"]');await p.waitForTimeout(800);
const tabs=await p.$$eval('#shop .tabs-row button',x=>x.map(y=>y.textContent));ok('5 tab cửa hàng, tab Thức ăn đứng đầu',tabs.length===5&&tabs[0]==='Thức ăn',JSON.stringify(tabs));
// tab Thức ăn: 12 món, suất ăn miễn phí, mua thức ăn bằng xu
await p.click('[data-shop-tab="food"]');await p.waitForTimeout(300);
ok('12 món thức ăn trong cửa hàng',(await p.$$('#shop .grid-items .card-item')).length===12);
let dm=await demo();const c0=dm.coins,m0=dm.owned.comnam;
await p.click('[data-ration]');await p.waitForTimeout(400);dm=await demo();
ok('nhận suất ăn miễn phí +3 Cơm nắm, chỉ một lần',dm.owned.comnam===m0+3&&(await p.$$('[data-ration]')).length===0&&dm.ration.length===1,'comnam='+dm.owned.comnam);
await p.click('[data-buyfood="chuoi"][data-qty="5"]');await p.waitForTimeout(400);dm=await demo();
ok('mua 5 Chuối: trừ 70 xu, thêm 5 phần',dm.coins===c0-70&&dm.owned.chuoi===7,'coins='+dm.coins+' chuoi='+dm.owned.chuoi);
await p.click('.hsheet:not([hidden]) [data-close]');await p.waitForTimeout(300);
// nhiệm vụ: 5 nhiệm vụ ngày, thưởng cả ngày, 3 nhiệm vụ tuần
await p.click('#a-house');await p.click('.tile[data-go="quests"]');await p.waitForTimeout(500);
const counts=await p.$$eval('#quests .quests',u=>u.map(x=>x.children.length));
ok('bảng nhiệm vụ: 5 ngày, 3 tuần, có thưởng cả ngày',counts.join()==='5,3'&&await p.isVisible('#quests .quest-bonus'),JSON.stringify(counts));
await p.click('.hsheet:not([hidden]) [data-close]');await p.waitForTimeout(300);
await p.click('#a-house');await p.click('.tile[data-go="shop"]');await p.waitForTimeout(300);
await p.click('.hsheet:not([hidden]) [data-close]');await p.waitForTimeout(300);
// âm thanh: nhạc theo buổi, nút tắt nhạc lưu lại
ok('nhạc ban ngày/đêm',['day','night'].includes((await au()).mood),JSON.stringify(await au()));
await p.click('#btn-stats');await p.click('#snd-music');await p.waitForTimeout(200);
// cá tính: hiện trong bảng Chỉ số, đã dịch theo các lần chăm ở trên
const pd=await demo();ok('cá tính hiện trong bảng Chỉ số',(await p.textContent('#persona-desc')).startsWith('Bé')&&(await p.$$('#persona-axes .axis')).length===5,JSON.stringify(pd.pet.personality));
ok('cá tính dịch theo cách chăm',Object.values(pd.pet.personality).some(v=>!Number.isInteger(v)));
ok('tắt nhạc',(await au()).mood===''&&(await p.getAttribute('#snd-music','aria-pressed'))==='false'&&JSON.parse(await p.evaluate(()=>localStorage.getItem('hatchday-audio'))).music===false);
await p.click('#snd-music');
// hướng dẫn lần đầu chơi: xem lại từ bảng Chỉ số, làm đủ 5 bước thật
await p.click('#btn-tour');await p.waitForTimeout(600);
const tourStep=async()=>(await p.textContent('.tour .tour-step').catch(()=>''))||'';
ok('hướng dẫn bước 1/5',(await tourStep()).includes('1/5'),await tourStep());
const bx=await (await p.$('canvas')).boundingBox();
await p.mouse.move(bx.x+bx.width/2,bx.y+bx.height*0.5);await p.mouse.down();for(let i=0;i<10;i++){await p.mouse.move(bx.x+bx.width/2+(i%2?30:-30),bx.y+bx.height*0.5);await p.waitForTimeout(60);}await p.mouse.up();await p.waitForTimeout(800);
ok('vuốt ve xong thì sang bước 2/5',(await tourStep()).includes('2/5'),await tourStep());
await p.click('#a-eat');await p.waitForTimeout(1200);
ok('bấm Ăn thì sang bước 3/5',(await tourStep()).includes('3/5'),await tourStep());
await p.click('#tray .food[data-id="carot"]');await p.waitForTimeout(3200);
ok('cho ăn xong thì sang bước 4/5',(await tourStep()).includes('4/5'),await tourStep());
await p.click('#a-house');await p.waitForTimeout(800);
ok('mở Nhà thì sang bước 5/5',(await tourStep()).includes('5/5'),await tourStep());
await p.click('.hsheet:not([hidden]) [data-close]');await p.click('#btn-stats');await p.waitForTimeout(800);
ok('mở Chỉ số thì hiện lời chúc và nút Đã hiểu',(await p.textContent('.tour p')).startsWith('Hay lắm')&&await p.isVisible('[data-tour="finish"]'));
await p.click('[data-tour="finish"]');await p.waitForTimeout(300);
ok('xong hướng dẫn: thẻ biến mất và nhớ đã xem',(await p.$('.tour'))===null&&(await p.evaluate(()=>localStorage.getItem('hatchday-tour')))==='1');
await p.click('#btn-stats');
// vòng đời: tua tuổi cho bé hết tuổi thọ, mở lại game → trang tưởng niệm → đón trứng đời sau → gia phả 2 đời
const prev=await demo();
await p.evaluate(()=>{const d=JSON.parse(localStorage.getItem('hatchday-demo'));d.life=40;d.pet.born_at=new Date(Date.now()-41*86400000).toISOString();localStorage.setItem('hatchday-demo',JSON.stringify(d));});
await p.goto(`http://localhost:${PORT}/?dev`);await p.waitForTimeout(800);await p.click('#demo');await p.waitForTimeout(1200);
ok('bé hết tuổi thọ: hiện trang tưởng niệm',await p.isVisible('.memorial')&&(await p.textContent('.memorial h1')).includes('đã ra đi'),(await p.textContent('.memorial h1').catch(()=>'')));
ok('trang tưởng niệm nói số ngày đã sống và có ký ức',(await p.textContent('.memo-days')).includes('40')&&(await p.$$('.memo-list .memo')).length>=1);
await p.click('#memo-next');await p.waitForTimeout(400);
ok('trứng đời sau giữ dòng họ, có miền của bé đã đi',(await p.textContent('.card')).includes(prev.pet.family_name)&&(await p.$$('.egg-pick .kin')).length===1&&(await p.$('#family'))===null);
await p.fill('#pet-name','Con Bánh');await p.click('button[type=submit]');await p.waitForTimeout(7500);
const heir=(await demo()).pet;
ok('đời 2: đúng dòng họ, đời 2, trỏ về bé trước, đang sống',heir.generation===2&&heir.family_name===prev.pet.family_name&&heir.parent_id===prev.pet.id&&heir.stage==='baby',JSON.stringify({g:heir.generation,f:heir.family_name}));
ok('thừa hưởng tai và cá tính nằm gần bé trước',heir.genes.ear===prev.pet.genes.ear&&Object.entries(heir.personality).every(([k,v])=>Number.isInteger(v)&&Math.abs(v-prev.pet.personality[k])<=75));
await p.click('#a-house');await p.click('.tile[data-go="family"]');await p.waitForTimeout(1500);
ok('gia phả hiện 2 đời, bé cũ đã ra đi',(await p.$$('.gen')).length===2&&(await p.$$('.gen.gone')).length===1&&(await p.$$('.gen.alive')).length===1);
await p.click('.gen.gone');await p.waitForTimeout(800);
ok('bấm vào bé đã đi: xem trang tưởng niệm',(await p.textContent('#family')).includes('Đã sống 40 ngày')&&(await p.textContent('#family')).includes('Những điều bé nhớ'));
await p.click('.hsheet:not([hidden]) [data-close]');
console.log(out.join('\n'));console.log('errors:',JSON.stringify(errs));
await b.close();srv.close();process.exitCode=(out.some(l=>l.startsWith('FAIL'))||errs.length)?1:0;})().catch(e=>{console.error(e);srv.close();process.exit(1);});
