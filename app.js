// SPA + mock logic
const view = document.getElementById('view');
const titleEl = document.getElementById('page-title');
const links = {
  "#/overview": "ภาพรวม",
  "#/sensors": "สถานะเซนเซอร์",
  "#/control": "แผงควบคุม",
  "#/alerts": "แจ้งเตือน",
  "#/settings": "ตั้งค่า",
  "#/login": "เข้าสู่ระบบ"
};

document.getElementById('themeToggle').addEventListener('click', ()=>{
  alert('Dark mode จะตามมาในเฟสถัดไป 🙂');
});

const AppState = { lastChartData: [], unit: 'kWh' };

function navActive(){
  document.querySelectorAll('.sidebar a').forEach(a=>a.classList.remove('active'));
  const key = location.hash || "#/overview";
  const el = document.querySelector(`.sidebar a[href="${key}"]`);
  if (el) el.classList.add('active');
  titleEl.textContent = links[key] || 'Dashboard';
}

async function render(){
  navActive();
  const hash = location.hash || "#/overview";
  const path = hash.split('?')[0];
  let file = 'pages/overview.html';
  if (path.startsWith('#/sensors')) file = 'pages/sensors.html';
  if (path.startsWith('#/control')) file = 'pages/control.html';
  if (path.startsWith('#/alerts')) file = 'pages/alerts.html';
  if (path.startsWith('#/settings')) file = 'pages/settings.html';
  if (path.startsWith('#/login')) file = 'pages/login.html';
  if (path.startsWith('#/chart/full')) file = 'pages/chart_full.html';
  view.innerHTML = await fetch(file).then(r=>r.text());
  if (path.startsWith('#/overview')) initOverview();
  if (path.startsWith('#/sensors')) initSensors();
  if (path.startsWith('#/control')) initControl();
  if (path.startsWith('#/alerts')) initAlerts();
  if (path.startsWith('#/settings')) initSettings();
  if (path.startsWith('#/login')) initLogin();
  if (path.startsWith('#/chart/full')) initChartFull();
}
window.addEventListener('hashchange', render);
window.addEventListener('load', render);

// utils
function genSeries(n, base){ return Array.from({length:n}, ()=> +(base*(0.9+Math.random()*0.2)).toFixed(2)); }
function downloadCsv(filename, rows){
  const blob = new Blob([rows], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
function fmt(num){ return new Intl.NumberFormat('th-TH').format(num); }

// Overview
function initOverview(){
  const buildingSel = document.getElementById('ov-building');
  const metricSel = document.getElementById('ov-metric');
  const timeSel = document.getElementById('ov-time');
  const weekSel = document.getElementById('ov-week');
  const monthSel = document.getElementById('ov-month');
  const yearSel = document.getElementById('ov-year');

  [buildingSel, metricSel, timeSel, weekSel, monthSel, yearSel].forEach(el=> el && el.addEventListener('change', update));

  function calcCount(){
    const t = timeSel.value;
    if (t==='วัน') return 24;
    if (t==='สัปดาห์') return 7;
    if (t==='เดือน') { const y = +yearSel.value, m = +monthSel.value; return new Date(y, m, 0).getDate(); }
    return 12;
  }
  let lineChart, pieChart;

  function update(){
    const count = calcCount();
    const metric = metricSel.value;
    const unit = metric === 'ไฟฟ้า' ? 'kWh' : 'm³';
    const data = genSeries(count, metric === 'ไฟฟ้า' ? (timeSel.value==='วัน'?120:2500) : (timeSel.value==='วัน'?10:350));
    AppState.lastChartData = data;
    AppState.unit = unit;

    const total = data.reduce((a,b)=>a+b,0);
    const pct = (((total - total*0.97) / (total*0.97)) * 100);

    document.getElementById('ov-internal').textContent = fmt((total*0.63).toFixed(0));
    document.getElementById('ov-main').textContent = fmt((total*0.37).toFixed(0));
    document.getElementById('ov-total').textContent = fmt(total.toFixed(0));
    document.getElementById('ov-change').textContent = `${pct>=0?'▲':'▼'} ${pct.toFixed(2)}%`;

    let labels=[];
    if (timeSel.value==='วัน') labels = Array.from({length:count},(_,i)=>`${i}:00`);
    else if (timeSel.value==='สัปดาห์') labels = Array.from({length:count},(_,i)=>`วันที่ ${i+1}`);
    else if (timeSel.value==='เดือน') labels = Array.from({length:count},(_,i)=>`วันที่ ${i+1}`);
    else labels = ['ม.ค','ก.พ','มี.ค','เม.ย','พ.ค','มิ.ย','ก.ค','ส.ค','ก.ย','ต.ค','พ.ย','ธ.ค'];

    const ctx = document.getElementById('ov-line').getContext('2d');
    if (lineChart) lineChart.destroy();
    lineChart = new Chart(ctx, {
      type:'line',
      data:{ labels, datasets:[{ data, label:`${metric} (${unit})`, borderWidth:2, fill:false, tension:.3 }]},
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}} }
    });

    const pctx = document.getElementById('ov-pie').getContext('2d');
    if (pieChart) pieChart.destroy();
    const internal = total*0.63, main = total*0.37;
    pieChart = new Chart(pctx, {
      type:'doughnut',
      data:{ labels:['ภายใน','โหลดหลัก'], datasets:[{ data:[internal, main] }]},
      options:{ responsive:true, cutout:'70%', plugins:{legend:{position:'bottom'}} }
    });
  }
  update();
  document.getElementById('btn-full').addEventListener('click', ()=> location.hash = '#/chart/full');
}

// Sensors
function initSensors(){
  const listEl = document.getElementById('s-list');
  const search = document.getElementById('s-search');
  const typeSel = document.getElementById('s-type');
  const statusSel = document.getElementById('s-status');
  const sensors = [
    {id:1, name:'Energy Meter #1', building:'อาคารวิจัย', status:'ONLINE', last:'2025-09-03 09:50', value: 1234},
    {id:2, name:'Water Meter #2', building:'อาคารวิศวกรรม', status:'OFFLINE', last:'2025-09-03 10:42', value: 0},
    {id:3, name:'Energy Meter #3', building:'ห้องสมุด', status:'ONLINE', last:'2025-09-03 10:10', value: 842},
  ];
  function inferType(n){ n=n.toLowerCase(); return (n.includes('water')||n.includes('น้ำ'))?'น้ำ':'ไฟฟ้า'; }
  function normStatus(s){ return /off/i.test(s)?'OFFLINE':'ONLINE'; }
  function renderList(){
    const q=(search.value||'').toLowerCase(), t=typeSel.value, st=statusSel.value;
    let items = sensors.filter(s=> s.name.toLowerCase().includes(q));
    if (t!=='ทั้งหมด') items = items.filter(s=> inferType(s.name)===t);
    if (st!=='ทั้งหมด') items = items.filter(s=> normStatus(s.status)===st);
    items.sort((a,b)=> a.building.localeCompare(b.building) || normStatus(b.status).localeCompare(normStatus(a.status)));
    listEl.innerHTML = items.map(s=>`
      <tr>
        <td>${s.name} <span class="small">(${inferType(s.name)})</span></td>
        <td>${s.building}</td>
        <td><span class="badge ${normStatus(s.status)==='ONLINE'?'green':'red'}">${normStatus(s.status)}</span></td>
        <td class="small">${s.last}</td>
      </tr>
    `).join('');
    document.getElementById('s-online').textContent = sensors.filter(s=>normStatus(s.status)==='ONLINE').length;
    document.getElementById('s-offline').textContent = sensors.filter(s=>normStatus(s.status)==='OFFLINE').length;
  }
  [search, typeSel, statusSel].forEach(el=> el.addEventListener('input', renderList));
  renderList();
}

// Control
function initControl(){
  const metricSel = document.getElementById('c-metric');
  const buildingSel = document.getElementById('c-building');
  const rangeSel = document.getElementById('c-range');
  const dateSel = document.getElementById('c-date');
  const weekSel = document.getElementById('c-week');
  const monthSel = document.getElementById('c-month');
  const yearSel = document.getElementById('c-year');
  const btnFull = document.getElementById('c-full');
  const btnCsv = document.getElementById('c-csv');
  const btnControl = document.getElementById('c-ctrl');

  let chart;
  function update(){
    const r = rangeSel.value;
    let count = r==='วันนี้'?24: r==='สัปดาห์นี้'?7: r==='เดือนนี้'?30:12;
    const metric = metricSel.value;
    const unit = metric==='ค่าน้ำ'?'m³':'kWh';
    const data = genSeries(count, metric==='ค่าน้ำ'?(r==='วันนี้'?10:350):(r==='วันนี้'?120:3500));
    AppState.lastChartData = data;
    AppState.unit = unit;

    let labels=[];
    if (r==='วันนี้') labels = Array.from({length:count},(_,i)=>`${i}:00`);
    else if (r==='สัปดาห์นี้') labels = Array.from({length:count},(_,i)=>`วัน ${i+1}`);
    else if (r==='เดือนนี้') labels = Array.from({length:count},(_,i)=>`วันที่ ${i+1}`);
    else labels = ['ม.ค','ก.พ','มี.ค','เม.ย','พ.ค','มิ.ย','ก.ค','ส.ค','ก.ย','ต.ค','พ.ย','ธ.ค'];

    const ctx = document.getElementById('c-line').getContext('2d');
    if (chart) chart.destroy();
    chart = new Chart(ctx, {
      type:'line',
      data:{ labels, datasets:[{ data, label:`${metric} (${unit})`, borderWidth:2, tension:.3 }]},
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}} }
    });

    const avg = data.reduce((a,b)=>a+b,0)/data.length;
    const peak = Math.max(...data);
    document.getElementById('c-avg').textContent = fmt(avg.toFixed(1)) + ' ' + unit;
    document.getElementById('c-peak').textContent = fmt(peak.toFixed(1)) + ' ' + unit;
  }
  [metricSel, buildingSel, rangeSel, dateSel, weekSel, monthSel, yearSel].forEach(el=> el && el.addEventListener('change', update));
  btnFull.addEventListener('click', ()=> location.hash = '#/chart/full');
  btnCsv.addEventListener('click', ()=> {
    const rows = AppState.lastChartData.map((v,i)=> `${i+1},${v}`).join('\\n');
    downloadCsv(`export_${metricSel.value}_${buildingSel.value}_${rangeSel.value}.csv`, 'Index,Value('+AppState.unit+')\\n'+rows);
  });
  btnControl.addEventListener('click', ()=> alert('⚠ ระบบยังไม่พร้อมเชื่อมต่อการควบคุม'));
  update();
}

// Alerts
function initAlerts(){
  const buildingSel = document.getElementById('a-building');
  const typeSel = document.getElementById('a-type');
  const rangeSel = document.getElementById('a-range');
  const list = document.getElementById('a-list');
  const resetBtn = document.getElementById('a-reset');

  const data = [
    {id:1, building:'อาคารวิศวกรรม', device:'Water Meter #2', event:'อุปกรณ์ออฟไลน์', time:'10:42 2025-09-03', status:'error'},
    {id:2, building:'อาคารวิจัย', device:'Energy Meter #1', event:'พลังงานสูงผิดปกติ', time:'09:10 2025-09-03', status:'warning'}
  ];
  function color(s){ return s==='error'?'red': s==='warning'?'yellow':'green'; }

  function renderList(){
    const b = buildingSel.value, t = typeSel.value;
    const items = data.filter(x=> (b==='ทั้งหมด'||x.building===b) && (t==='ทั้งหมด'||x.event===t));
    list.innerHTML = items.map(a=>`
      <tr>
        <td><span class="badge ${color(a.status)}">!</span></td>
        <td>${a.building} - ${a.device}</td>
        <td>${a.event}<div class="small">${a.time}</div></td>
        <td style="text-align:right"><button class="btn" onclick="openAlert(${a.id})">ดู</button></td>
      </tr>
    `).join('');
  }
  resetBtn.addEventListener('click', ()=>{ buildingSel.value='ทั้งหมด'; typeSel.value='ทั้งหมด'; rangeSel.value='วันนี้'; renderList(); });
  [buildingSel,typeSel,rangeSel].forEach(el=>el.addEventListener('change', renderList));
  renderList();
  window.openAlert = function(id){
    AppState.lastChartData = genSeries(24, 120);
    AppState.unit = 'kWh';
    location.hash = '#/chart/full';
  }
}

// Settings
function initSettings(){
  document.getElementById('btn-logout').addEventListener('click', ()=>{
    if (confirm('ยืนยันออกจากระบบ?')) location.hash = '#/login';
  });
}

// Login
function initLogin(){
  document.getElementById('login-form').addEventListener('submit', (e)=>{
    e.preventDefault();
    location.hash = '#/overview';
  });
}

// Fullscreen chart
function initChartFull(){
  const ctx = document.getElementById('fs-line').getContext('2d');
  new Chart(ctx, {
    type:'line',
    data:{ labels: AppState.lastChartData.map((_,i)=> i+1), datasets:[{ data: AppState.lastChartData, borderWidth:2, tension:.3 }]},
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ y:{ title:{display:true, text:AppState.unit} } } }
  });
}
