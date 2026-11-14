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
await p.click('#tray .food.more');await p.waitForTimeout(800);ok('bấm "Mua thêm" ở khay thức ăn: mở cửa hàng',await p.isVisible('#shop')); await p.evaluate(()=>document.querySelector('#shop [data-close]')?.click()); await p.waitForTimeout(300);
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
await p.click('#btn-stats');await p.click('#btn-settings');await p.click('#snd-music');await p.waitForTimeout(200);
// cá tính: hiện trong bảng Chỉ số, đã dịch theo các lần chăm ở trên
const pd=await demo();ok('cá tính hiện trong bảng Chỉ số',(await p.textContent('#persona-desc')).startsWith('Bé')&&(await p.$$('#persona-axes .axis')).length===5,JSON.stringify(pd.pet.personality));
ok('cá tính dịch theo cách chăm',Object.values(pd.pet.personality).some(v=>!Number.isInteger(v)));
ok('tắt nhạc',(await au()).mood===''&&(await p.getAttribute('#snd-music','aria-pressed'))==='false'&&JSON.parse(await p.evaluate(()=>localStorage.getItem('hatchday-audio'))).music===false);
await p.click('#snd-music');
// hướng dẫn lần đầu chơi: xem lại từ bảng Cài đặt, làm đủ 5 bước thật
await p.click('#btn-tour');await p.waitForTimeout(600);
const tourStep=async()=>(await p.textContent('.tour .tour-step').catch(()=>''))||'';
ok('hướng dẫn bước 1/5',(await tourStep()).includes('1/5'),await tourStep());
const bx=await (await p.$('canvas')).boundingBox();
// thú đi lang thang nên nhắm cú vuốt vào đúng chỗ thú đang đứng (hàm __petXY chỉ có khi ?dev)
for(let t=0;t<4&&!(await tourStep()).includes('2/5');t++){
  const pp=await p.evaluate(()=>window.__petXY());
  await p.mouse.move(pp.x,pp.y);await p.mouse.down();for(let i=0;i<10;i++){await p.mouse.move(pp.x+(i%2?25:-25),pp.y);await p.waitForTimeout(60);}await p.mouse.up();await p.waitForTimeout(700);}
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
// thức ăn nâng cao: khẩu vị, nấu ăn, vườn rau, tủ lạnh, thức ăn hỏng
await p.evaluate(()=>{const d=JSON.parse(localStorage.getItem('hatchday-demo'));d.coins=1000;d.owned['bu-nhin']=2;localStorage.setItem('hatchday-demo',JSON.stringify(d));});
await p.goto(`http://localhost:${PORT}/?dev`);await p.waitForTimeout(800);await p.click('#demo');await p.waitForTimeout(2500);
await p.click('#btn-stats');await p.waitForTimeout(300);
ok('Chỉ số có dòng Khẩu vị (đã thử một vài món)',/Khẩu vị: .*đã thử [1-9]\d*\/12 món/.test(await p.textContent('#tastes')),await p.textContent('#tastes'));
await p.click('#btn-stats');
await p.click('#a-house');await p.click('.tile[data-go="cooking"]');await p.waitForFunction(()=>{const e=document.querySelector('#cooking');return e&&!e.hidden},null,{timeout:9000}); // đi vào Bếp, bé chạy lại bếp lò rồi mới mở bảng nấu
await p.waitForTimeout(300);
ok('Nấu ăn: 16 công thức',(await p.$$('#cooking .recipes li')).length===16);
dm=await demo();const st0=dm.owned['sinh-to']||0;
await p.click('[data-cook="sinh-to"]');await p.waitForTimeout(400);dm=await demo();
ok('nấu Sinh tố chuối: được 1 món, mất 1 chuối và 1 sữa chua',dm.owned['sinh-to']===st0+1,'sinh-to='+dm.owned['sinh-to']);
await p.click('.hsheet:not([hidden]) [data-close]');
// vườn rau 3D: vào cảnh Vườn từ mục Vườn rau, chạm luống để gieo, tưới nước, hái rau (hoạt ảnh thật)
await p.click('#a-house');await p.click('.tile[data-go="garden"]');await p.waitForTimeout(2800);
ok('mục Vườn rau đưa vào cảnh Vườn 3D',(await p.textContent('#scene-tag'))==='Vườn');
// trình duyệt giả lập chỉ ~6–10 khung hình/giây nên hoạt ảnh chạy chậm: chạm lại cho tới khi bảng chọn hiện (luống hết bận)
const tapPlot=async(i,sel)=>{for(let t=0;t<12;t++){const xy=await p.evaluate(i=>window.__plotXY(i),i);await p.mouse.click(xy.x,xy.y);await p.waitForTimeout(700);if(await p.isVisible('#plot-menu '+sel))return;await p.waitForTimeout(600);}};
const until=async(f,ms=12000)=>{const t0=Date.now();while(Date.now()-t0<ms){if(await f())return true;await p.waitForTimeout(300);}return false;};
dm=await demo();const cA=dm.coins,carA=dm.owned.carot;
await tapPlot(0,'[data-plant]');
ok('chạm luống trống: bảng chọn 4 cây',await p.isVisible('#plot-menu')&&(await p.$$('#plot-menu [data-plant]')).length===4);
await p.click('#plot-menu [data-plant="carot"]');await until(async()=>(await demo()).garden?.['0']);dm=await demo();
ok('gieo Cà rốt: trừ 5 xu, hạt bay vào đất, ô 1 có cây',dm.coins===cA-5&&dm.garden['0'].crop==='carot','coins='+dm.coins);
await tapPlot(0,'[data-water]');
ok('chạm luống đang lớn: có nút Tưới nước và đếm ngược',(await p.textContent('#plot-menu')).includes('còn')&&await p.isVisible('#plot-menu [data-water]'));
await p.click('#plot-menu [data-water]');await until(async()=>(await demo()).garden['0'].waters===1);await p.waitForTimeout(3500);dm=await demo();
ok('tưới nước: ghi 1 lần tưới',dm.garden['0'].waters===1&&!!dm.garden['0'].watered_at);
await p.evaluate(()=>{const d=JSON.parse(localStorage.getItem('hatchday-demo'));d.garden['0'].planted_at=new Date(Date.now()-5*3600000).toISOString();localStorage.setItem('hatchday-demo',JSON.stringify(d));});
await tapPlot(0,'[data-harvest]');
ok('đủ giờ: bảng hiện nút Hái rau',await p.isVisible('#plot-menu [data-harvest]'));
await p.click('#plot-menu [data-harvest]');await until(async()=>!(await demo()).garden['0']);await p.waitForTimeout(3500);dm=await demo();
ok('hái rau: được 3 Cà rốt, ô trống lại',dm.owned.carot===carA+3&&!dm.garden['0'],'carot='+dm.owned.carot);
// trang trí nông trại: đặt đồ mua ở cửa hàng vào sân và lưu
await p.click('.ctx-btn[data-k="farm"]');await p.waitForTimeout(1200);
ok('Trang trí nông trại: hiện bảng chọn đồ đã mua (Bù nhìn × 2)',await p.isVisible('.farm-ui [data-fe-add="bu-nhin"]')&&(await p.textContent('.farm-ui [data-fe-add="bu-nhin"] em'))==='2');
await p.click('.farm-ui [data-fe-add="bu-nhin"]');await p.waitForTimeout(500);
ok('đặt một Bù nhìn: còn lại 1, có thanh Xoay/Cất',(await p.textContent('.farm-ui [data-fe-add="bu-nhin"] em'))==='1'&&await p.isVisible('.farm-ui [data-fe="rotate"]'));
await p.click('.farm-ui [data-fe="rotate"]');await p.click('.farm-ui [data-fe="save"]');
ok('lưu nông trại: demo ghi 1 món, xoay 1',await until(async()=>(await demo()).farm?.length===1)&&(await demo()).farm[0].id==='bu-nhin'&&(await demo()).farm[0].rot===1,JSON.stringify((await demo()).farm));
await p.waitForTimeout(800);
await p.click('.ctx-btn[data-k="home"]');await p.waitForTimeout(2500);
await p.click('#a-house');await p.click('.tile[data-go="shop"]');await p.waitForTimeout(400);await p.click('[data-shop-tab="food"]');await p.waitForTimeout(300);
ok('thẻ tủ lạnh và khẩu vị hiện trong cửa hàng',(await p.textContent('#shop')).includes('Tủ lạnh cấp 1')&&(await p.textContent('#shop')).includes('Khẩu vị của bé'));
dm=await demo();const cB=dm.coins;
await p.click('[data-fridge]');await p.waitForTimeout(400);dm=await demo();
ok('mua tủ lạnh cấp 2: trừ 200 xu',dm.fridge===1&&dm.coins===cB-200,'coins='+dm.coins);
await p.click('.hsheet:not([hidden]) [data-close]');
await p.evaluate(()=>{const d=JSON.parse(localStorage.getItem('hatchday-demo'));const t=new Date(Date.now()-86400000),pd=n=>String(n).padStart(2,'0');d.owned.carot=12;d.owned.comnam=12;d.spoilDay=`${t.getFullYear()}-${pd(t.getMonth()+1)}-${pd(t.getDate())}`;localStorage.setItem('hatchday-demo',JSON.stringify(d));});
await p.goto(`http://localhost:${PORT}/?dev`);await p.waitForTimeout(800);await p.click('#demo');await p.waitForTimeout(2500);
dm=await demo();
ok('qua 1 ngày: Cà rốt (tươi) hỏng 2 phần còn 10, Cơm nắm (khô) không hỏng',dm.owned.carot===10&&dm.owned.comnam===12,'carot='+dm.owned.carot+' comnam='+dm.owned.comnam);
ok('có thông báo thức ăn bị hỏng',(await p.textContent('#toast').catch(()=>''))?.includes('hỏng'),await p.textContent('#toast').catch(()=>''));
// sức khoẻ: bỏ bê 30 phút → ốm → mua thuốc → cho uống → khỏi; chặn chơi khi ốm; phòng khám; cảnh báo sắp ốm
const setDemo=(fn)=>p.evaluate((f)=>{const d=JSON.parse(localStorage.getItem('hatchday-demo'));new Function('d',f)(d);localStorage.setItem('hatchday-demo',JSON.stringify(d));},fn);
const reload=async()=>{await p.goto(`http://localhost:${PORT}/?dev`);await p.waitForTimeout(800);await p.click('#demo');await p.waitForTimeout(2200);};
// biểu cảm tự suy ra từ chỉ số, không còn nút chọn
ok('không còn nút/hàng chọn biểu cảm',!(await p.$('#chips'))&&!(await p.$('.review'))&&!(await p.textContent('body')).includes('Duyệt biểu cảm'));
await setDemo("d.pet.no=20;d.pet.illness=null;d.pet.critical_since=null;d.pet.stats_at=new Date().toISOString();");
await reload();
ok('đói (no=20) → thanh LCD tự báo "hơi đói"',(await p.textContent('#lcdmsg')).includes('hơi đói'),await p.textContent('#lcdmsg'));
await setDemo("d.coins=1000;d.pet.no=0;d.pet.stats_at=new Date().toISOString();d.pet.critical_since=new Date(Date.now()-31*60000).toISOString();d.pet.illness=null;");
await reload();
dm=await demo();
ok('bỏ đói 31 phút: bé bị đau bụng',dm.pet.illness==='dau-bung'&&!!dm.pet.sick_since,String(dm.pet.illness));
ok('chip "Đang đau bụng" hiện và thanh LCD báo bệnh',await p.isVisible('#sick-chip')&&(await p.textContent('#sick-chip')).includes('đau bụng')&&(await p.textContent('#lcdmsg')).includes('đau bụng'),(await p.textContent('#sick-chip').catch(()=>''))+' | '+(await p.textContent('#lcdmsg')));
await p.click('#a-house');await p.click('.tile[data-go="clinic"]');await p.waitForTimeout(500);
ok('sổ sức khoẻ: thẻ bệnh, tủ thuốc 8 loại, sổ bệnh 8 bệnh',(await p.textContent('#clinic')).includes('đang bị đau bụng')&&(await p.$$('#clinic .med')).length===8&&(await p.$$('#clinic .ill')).length===8);
const coinsB=(await demo()).coins;
await p.click('#clinic .sick-card [data-buy-med]');await p.waitForTimeout(500);
ok('mua Trà gừng: trừ 50 xu, có 1 liều',(await demo()).coins===coinsB-50&&(await demo()).owned['tra-gung']===1,JSON.stringify((await demo()).owned['tra-gung']));
await p.click('#clinic [data-use-med="tra-gung"]');await p.waitForTimeout(600);
dm=await demo();
ok('cho uống Trà gừng: khỏi bệnh, hết liều, +3 gắn bó',!dm.pet.illness&&!dm.owned['tra-gung']&&dm.pet.bond_xp>=3,JSON.stringify({i:dm.pet.illness,q:dm.owned['tra-gung'],b:dm.pet.bond_xp}));
await p.click('.hsheet:not([hidden]) [data-close]');await p.waitForTimeout(300);
ok('khỏi bệnh: chip ẩn',await until(async()=>!(await p.isVisible('#sick-chip')),6000));
await setDemo("d.pet.no=70;d.pet.illness='cang-co';d.pet.sick_since=new Date(Date.now()-3600000).toISOString();d.pet.recover_at=new Date(Date.now()+3600000).toISOString();d.pet.critical_since=null;d.plays=[];");
await reload();
await p.click('#a-play');await p.waitForTimeout(1500);
ok('đang căng cơ: vào vườn có thông báo không chơi được',(await p.textContent('#toast')).includes('chưa chơi đồ chơi được'),await p.textContent('#toast').catch(()=>''));
await p.click('.ctx-btn[data-k="ball"]');await p.waitForTimeout(500);
ok('bấm Ném bóng khi ốm: bé từ chối, không ghi lần chơi',(await p.textContent('#bubble')).includes('chưa chơi được')&&!((await demo()).plays||[]).length,await p.textContent('#bubble'));
await p.click('.ctx-btn[data-k="home"]');await p.waitForTimeout(2200);
await setDemo("d.coins=1000;d.pet.illness='u-rut';d.pet.vui=2;d.pet.sick_since=new Date(Date.now()-3600000).toISOString();d.pet.recover_at=null;d.pet.stats_at=new Date().toISOString();");
await reload();
await p.click('#a-house');await p.click('.tile[data-go="clinic"]');await p.waitForTimeout(500);
await p.click('#clinic [data-clinic]');await p.waitForTimeout(700);
dm=await demo();
ok('phòng khám: khỏi ngay, trừ 150 xu, Vui bồi bổ lên 60',!dm.pet.illness&&dm.coins===850&&dm.pet.vui>=59,JSON.stringify({i:dm.pet.illness,c:dm.coins,v:dm.pet.vui}));
await p.click('.hsheet:not([hidden]) [data-close]');
await setDemo("d.pet.illness=null;d.pet.sick_since=null;d.pet.recover_at=null;d.pet.sach=0;d.pet.no=70;d.pet.vui=70;d.pet.stats_at=new Date().toISOString();d.pet.critical_since=new Date(Date.now()-15*60000).toISOString();");
await reload();
ok('sắp ốm: chip cảnh báo "Sắp ốm: độ sạch"',await p.isVisible('#sick-chip')&&(await p.textContent('#sick-chip')).includes('Sắp ốm: độ sạch'),await p.textContent('#sick-chip').catch(()=>''));
await setDemo("d.pet.sach=70;d.pet.critical_since=null;");
await reload();
// gắn bó: cấp theo điểm, nhận quà xu mỗi cấp một lần
await setDemo("d.coins=1000;d.pet.bond_xp=300;d.bond=[];");
await reload();
await p.click('#btn-stats');await p.waitForTimeout(500);
ok('Chỉ số: gắn bó cấp 5 "Tin cậy", 4 phần quà gộp một nút Nhận tất cả',(await p.textContent('#bond')).includes('Cấp 5 · Tin cậy')&&(await p.$$('#bond [data-bond="all"]')).length===1&&/4 phần quà/.test(await p.textContent('#bond')),(await p.textContent('#bond')).slice(0,80));
await p.click('#bond [data-bond="all"]');await p.waitForTimeout(800);
dm=await demo();
ok('nhận tất cả: cấp 2–5 = 50+80+120+160 = +410 xu, hết nút nhận quà',dm.coins===1410&&[2,3,4,5].every(l=>dm.bond.includes(l))&&(await p.$$('#bond [data-bond]')).length===0,JSON.stringify({c:dm.coins,b:dm.bond}));
await p.click('#btn-stats');await p.waitForTimeout(300);
// chào mừng quay lại và đồng hành giờ làm việc
await p.evaluate(()=>localStorage.setItem('hatchday-tour','1'));
await p.goto(`http://localhost:${PORT}/?dev`);await p.waitForTimeout(800); // trang đăng nhập, chưa chạy game nên chưa ghi mốc "lần cuối thấy bé"
await p.evaluate(()=>{const d=JSON.parse(localStorage.getItem('hatchday-demo'));localStorage.setItem('hatchday-seen',JSON.stringify({t:Date.now()-5*3600000,no:90,vui:80,sach:90,nl:80}));d.pet.no=20;d.pet.vui=75;d.pet.sach=90;d.pet.nl=80;d.pet.stats_at=new Date().toISOString();d.pet.illness=null;d.pet.critical_since=null;localStorage.setItem('hatchday-demo',JSON.stringify(d));});
await p.click('#demo');await p.waitForTimeout(3000);
ok('vắng 5 giờ: hiện thẻ chào mừng quay lại',await p.isVisible('.welcome')&&(await p.textContent('.welcome')).includes('Bạn vắng 5 giờ'),(await p.textContent('.welcome').catch(()=>'')).slice(0,80));
ok('thẻ nói chỉ số tụt (Độ no từ 90 xuống 20) và có nút Cho ăn',(await p.textContent('.welcome')).includes('Độ no tụt từ 90 xuống 20')&&await p.isVisible('.welcome [data-w="eat"]'));
await p.click('.welcome [data-w="close"]');await p.waitForTimeout(300);
ok('chào bé xong: thẻ đóng',!(await p.isVisible('.welcome').catch(()=>false)));
await reload();await p.waitForTimeout(800);
ok('mở lại ngay: không hiện thẻ nữa (vừa mới thấy bé)',!(await p.$('.welcome')));
await p.evaluate(()=>window.__remind('break'));await p.waitForTimeout(400);
ok('nhắc giải lao: bé nói lời nhắc',/vươn vai|Nghỉ tay|Mắt bạn/.test(await p.textContent('#bubble')),await p.textContent('#bubble'));
await p.evaluate(()=>window.__remind('water'));await p.waitForTimeout(400);
ok('nhắc uống nước: bé nói lời nhắc',/nước/.test(await p.textContent('#bubble')),await p.textContent('#bubble'));
await p.click('#btn-settings');await p.waitForTimeout(400);
ok('Cài đặt có 3 nút Đồng hành (Giải lao, Uống nước, Chào sáng/tối) đang bật',(await p.$$('[data-cp][aria-pressed="true"]')).length===3);
await p.click('[data-cp="water"]');
ok('tắt nhắc uống nước: lưu vào máy',JSON.parse(await p.evaluate(()=>localStorage.getItem('hatchday-companion'))).water===false);
await p.click('[data-cp="water"]');await p.click('#btn-settings');await p.waitForTimeout(300);
// bản đồ và địa điểm: khoá theo Gắn bó, Bệnh viện, Chợ (bán rau), Tiệm may, Thư viện
await setDemo("d.pet.bond_xp=0;d.pet.illness=null;d.pet.sick_since=null;d.pet.recover_at=null;d.pet.critical_since=null;d.coins=500;d.owned.carot=6;d.sold={};d.pet.no=70;d.pet.sach=70;d.pet.vui=70;d.pet.nl=90;d.pet.stats_at=new Date().toISOString();");
await reload();
const goPlace=async id=>{await p.click('#scene-tag');await p.waitForTimeout(300);await p.click(`#map [data-pin="${id}"]`);await p.click(`#map [data-go-place="${id}"]`);};
await p.click('#scene-tag');await p.waitForTimeout(500);
ok('chạm chip khu vực: mở Bản đồ với 9 ghim',await p.isVisible('#map')&&(await p.$$('#map .pin')).length===9);
await p.click('#map [data-pin="market"]');await p.waitForTimeout(200);
ok('Chợ bị khoá ở Gắn bó cấp 1: thẻ báo cần cấp 2, không có nút Đi tới',(await p.textContent('#map .map-card')).includes('cấp 2')&&!(await p.$('#map [data-go-place]')));
await p.click('#map [data-pin="plaza"]');await p.waitForTimeout(200);
ok('Quảng trường khoá ở Gắn bó cấp 1: thẻ báo cần cấp 2',(await p.textContent('#map .map-card')).includes('cấp 2')&&!(await p.$('#map [data-go-place]')));
await p.click('#map [data-pin="hospital"]');await p.click('#map [data-go-place="hospital"]');
ok('đi tới Bệnh viện: chip đổi tên và hiện các điểm chạm',await until(async()=>(await p.textContent('#scene-tag')).includes('Bệnh viện')&&await p.isVisible('.hot[data-hot="desk"]'),12000));
await p.click('.hot[data-hot="desk"]');
ok('chạm quầy tiếp đón: thú đi tới rồi mở Sổ sức khoẻ',await until(()=>p.isVisible('#clinic'),15000));
await p.click('.hsheet:not([hidden]) [data-close]');await p.waitForTimeout(300);
await p.keyboard.press('Escape');
ok('phím Esc trong địa điểm: mở Bản đồ',await until(()=>p.isVisible('#map'),3000));
await p.click('#map [data-close]');
await setDemo("d.pet.bond_xp=100;");
await reload();
await goPlace('market');
ok('đi tới Chợ (Gắn bó cấp 3): hiện 9 điểm chạm (có Video thưởng, Đồ chơi, Giao hàng)',await until(async()=>(await p.textContent('#scene-tag')).includes('Chợ')&&(await p.$$('.hot')).length===9,12000));
await p.waitForTimeout(1800); // đợi hết chuyển cảnh để điểm chạm đứng yên
const carB=(await demo()).owned.carot,coB=(await demo()).coins;
await p.click('.hot[data-hot="sell"]');
ok('chạm sạp Thu mua: mở bảng bán rau',await until(()=>p.isVisible('#sell'),15000));
await p.click('#sell [data-sell="carot"][data-qty="1"]');await p.waitForTimeout(500);
dm=await demo();
ok('bán 1 Cà rốt: trừ kho, cộng xu, ghi hạn mức ngày',dm.owned.carot===carB-1&&dm.coins>coB&&Object.values(dm.sold||{})[0]===dm.coins-coB,JSON.stringify({q:dm.owned.carot,c:dm.coins-coB,s:dm.sold}));
await p.click('.hsheet:not([hidden]) [data-close]');await p.waitForTimeout(300);
await goPlace('tailor');
ok('đi tới Tiệm may: bục thử đồ mở Tủ đồ',await until(async()=>(await p.textContent('#scene-tag')).includes('Tiệm may')&&await p.isVisible('.hot[data-hot="stage"]'),12000));
await p.click('.hot[data-hot="stage"]');
ok('chạm bục thử đồ: mở Tủ đồ',await until(()=>p.isVisible('#wardrobe'),15000));
await p.click('.hsheet:not([hidden]) [data-close]');await p.waitForTimeout(300);
await goPlace('library');
ok('đi tới Thư viện: kệ Sổ loài mở Sổ loài',await until(async()=>(await p.textContent('#scene-tag')).includes('Thư viện')&&await p.isVisible('.hot[data-hot="dex"]'),12000));
await p.click('.hot[data-hot="dex"]');
ok('chạm kệ Sổ loài: mở Sổ loài',await until(()=>p.isVisible('#dex'),15000));
await p.click('.hsheet:not([hidden]) [data-close]');await p.waitForTimeout(300);
await goPlace('home');
ok('về Nhà bằng Bản đồ: chip về Phòng khách, nhãn địa điểm ẩn',await until(async()=>(await p.textContent('#scene-tag')).includes('Phòng khách')&&!(await p.isVisible('.hot')),12000));
// nơi chung (mô phỏng nhiều người): Quảng trường, Tiệm trà, Công viên
await setDemo("d.pet.bond_xp=300;d.pet.no=70;d.pet.sach=70;d.pet.vui=70;d.pet.nl=90;d.pet.stats_at=new Date().toISOString();");
await reload();
await goPlace('plaza');
ok('đi tới Quảng trường: chip đổi tên, thanh emote và nhãn Bảng tin hiện',await until(async()=>(await p.textContent('#scene-tag')).includes('Quảng trường')&&await p.isVisible('.emote-bar')&&await p.isVisible('.hot[data-hot="news"]'),15000));
ok('bạn ảo vào kênh: thấy ít nhất 2 thú khác và đếm người',await until(()=>p.evaluate(()=>document.querySelectorAll('.actor').length>=2),15000)&&/\d+\/12 người/.test(await p.textContent('#eb-count')),await p.textContent('#eb-count'));
await p.click('[data-eb-toggle]:visible'); // biểu cảm gập sau nút "Biểu cảm"
await p.click('.eb[data-emote="heart"]');
ok('bấm emote: bé nói biểu tượng',await until(async()=>(await p.textContent('#bubble')).includes('❤️'),4000));
await p.fill('#chat-in','Xin chào mọi người');await p.click('#chat-box button[type=submit]');
ok('chat: tin của mình hiện trong nhật ký chat',await until(()=>p.evaluate(()=>!!document.querySelector('.chat-line.mine')),6000));
await p.fill('#chat-in','gọi 0912345678 nhé');await p.click('#chat-box button[type=submit]');
ok('chat: số điện thoại bị chặn kèm lý do',await until(async()=>(await p.textContent('#toast')).includes('số điện thoại'),4000),await p.textContent('#toast'));
await p.fill('#chat-in','');
await p.click('.hot[data-hot="news"]');
ok('chạm Bảng tin: mở mục Tin tức',await until(async()=>await p.isVisible('#social')&&(await p.textContent('#social')).includes('Tin tức'),15000));
await p.click('.hsheet:not([hidden]) [data-close]');await p.waitForTimeout(300);
await goPlace('tea');
ok('đi tới Tiệm trà: có bàn và thanh emote',await until(async()=>(await p.textContent('#scene-tag')).includes('Tiệm trà')&&await p.isVisible('.hot[data-hot="table0"]')&&await p.isVisible('.emote-bar'),15000));
ok('rời Quảng trường: không còn nhãn tên thú nào của kênh cũ',await until(()=>p.evaluate(()=>document.querySelectorAll('.actor').length<=3),6000));
await goPlace('park');
ok('đi tới Công viên: có xích đu',await until(async()=>(await p.textContent('#scene-tag')).includes('Công viên')&&await p.isVisible('.hot[data-hot="swing"]'),15000));
await goPlace('home');
ok('về Nhà: thanh emote và nhãn tên biến mất',await until(async()=>(await p.textContent('#scene-tag')).includes('Phòng khách')&&!(await p.isVisible('.emote-bar'))&&!(await p.isVisible('.actor-layer')),12000));
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
await b.close();srv.close();process.exitCode=(out.some(l=>l.startsWith('FAIL'))||errs.length)?1:0;})().catch(e=>{console.log(out.join('\n'));console.error(e);srv.close();process.exit(1);});
