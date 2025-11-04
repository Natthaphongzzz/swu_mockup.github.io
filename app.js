
/** Simple SPA Router (hash-based) */
const routes = {
  "/overview": renderOverview,
  "/sensors": renderSensors,
  "/control": renderControl,
  "/alerts": renderAlerts,
  "/settings": renderSettings,
  "/about": renderAbout,
  "/edit-profile": renderEditProfile,
  "/change-password": renderChangePassword,
};

const app = document.getElementById("app");
const menubar = document.getElementById("menubar");
const modal = document.getElementById("modal");
const modalClose = document.getElementById("modalClose");
const modalTitle = document.getElementById("modalTitle");
let modalChart;

/** Utilities */
function setActiveNav(path){
  document.querySelectorAll(".navlink").forEach(a => {
    if(a.getAttribute("href") === `#${path}`){ a.classList.add("active"); }
    else { a.classList.remove("active"); }
  });
}

function navigate(){
  const hash = location.hash.replace("#","") || "/overview";
  const route = routes[hash] || renderNotFound;
  setActiveNav(hash);
  route();
}
window.addEventListener("hashchange", navigate);
window.addEventListener("load", navigate);

modalClose.addEventListener("click", ()=> modal.classList.add("hidden"));
modal.addEventListener("click", (e)=>{ if(e.target === modal) modal.classList.add("hidden"); });

/** Mock Store + helpers */
const Store = {
  getProfile(){
    return JSON.parse(localStorage.getItem("profile") || `{
      "name":"พิชญะ วัฒน์ศิริ",
      "email":"pichaya@university.ac.th",
      "department":"ฝ่ายบริหารระบบอาคาร",
      "building":"อาคารวิจัย"
    }`);
  },
  setProfile(p){ localStorage.setItem("profile", JSON.stringify(p)); },
  genData({mode="day", metric="power", month=1, year=2025}){
    const rand = (n, base) => Array.from({length:n}, _=> +(base*(0.9+Math.random()*0.2)).toFixed(1));
    if(mode==="day")   return rand(24, metric==="water"? 10 : 120);
    if(mode==="week")  return rand(7,  metric==="water"? 100:1000);
    if(mode==="month") return rand(30, metric==="water"? 350:3500);
    return rand(12, metric==="water"? 800:8000); // year
  },
  sensors(){
    // Minimal mock
    return [
      {id:1, name:"Energy Meter #1", building:"อาคารวิจัย", status:"ONLINE", lastUpdate:"10:32", value: 312.3},
      {id:2, name:"Water Meter #2",  building:"อาคารวิศวกรรม", status:"OFFLINE", lastUpdate:"09:40", value: 0},
      {id:3, name:"Energy Meter #5", building:"ห้องสมุด", status:"ONLINE", lastUpdate:"10:28", value: 122.7},
    ];
  },
  alerts(){
    return [
      {building:"อาคารวิศวกรรม", device:"Water Meter #2", event:"อุปกรณ์ออฟไลน์", time:"10:42 2025-09-03", status:"error"},
      {building:"อาคารวิจัย", device:"Energy Meter #1", event:"พลังงานสูงผิดปกติ", time:"09:10 2025-09-03", status:"warning"},
    ];
  }
}

function exportCSV(filename, rows){
  const csv = rows.map(r => r.map(v => `"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function enterpriseLine(datasetLabel, data, unit){
  return {
    type: "line",
    data: {
      labels: data.map((_,i)=>i),
      datasets: [{
        label: datasetLabel,
        data,
        borderColor: "#1d4ed8",
        backgroundColor: "rgba(29,78,216,.08)",
        fill: true,
        tension:.35,
        pointRadius: 2.5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid:{color:"#eef2ff"} },
        y: { grid:{color:"#eef2ff"}, ticks:{ callback:(v)=> v+" "+unit } }
      },
      plugins: {
        legend: { display: true },
        tooltip: { mode:"index", intersect:false }
      }
    }
  }
}

function enterpriseDonut(labels, values, colors){
  return {
    type:"doughnut",
    data:{
      labels,
      datasets:[{data: values, backgroundColor: colors, borderWidth:0}]
    },
    options:{
      cutout:"68%",
      plugins:{
        legend:{ position:"bottom" }
      }
    }
  }
}

/** Pages */
function renderOverview(){
  const buildings = ["อาคารวิจัย","อาคารวิศวกรรม","ห้องสมุด"];
  const metrics = ["ไฟฟ้า","น้ำ"];
  const tabs = ["วัน","สัปดาห์","เดือน","ปี"];
  let selectedBuilding = buildings[0];
  let selectedMetric = metrics[0];
  let selectedTime = "วัน";
  let selectedWeek = 1;
  let selectedMonth = 1;
  let selectedYear = 2025;

  app.innerHTML = `
  <div class="grid grid-2">
    <section class="card">
      <div class="card-header"><h3>ภาพรวม</h3></div>
      <div class="card-body">
        <div class="row">
          <div class="field">
            <label>อาคาร</label>
            <select id="ovBuilding">${buildings.map(b=>`<option>${b}</option>`).join("")}</select>
          </div>
          <div class="field">
            <label>ประเภทข้อมูล</label>
            <select id="ovMetric">${metrics.map(m=>`<option>${m}</option>`).join("")}</select>
          </div>
        </div>
        <div class="sep"></div>
        <div class="row" id="timeTabs">
          ${tabs.map(t=>`<button class="btn" data-tab="${t}">${t}</button>`).join("")}
        </div>
        <div class="row" id="timeFilters" style="margin-top:8px;"></div>
      </div>
    </section>

    <section class="card">
      <div class="card-header">
        <strong>สรุปสัดส่วน</strong>
        <button id="btnFull" class="btn">ดูรายละเอียด</button>
      </div>
      <div class="card-body">
        <div class="row">
          <div style="flex:1;min-height:220px">
            <canvas id="donut"></canvas>
          </div>
          <div class="kpi" style="flex:1">
            <div>รวม</div>
            <div class="value" id="totalValue">0</div>
            <div class="delta pos" id="deltaText">+0%</div>
            <div class="helper">เปรียบเทียบเมื่อวาน (mock)</div>
          </div>
        </div>
      </div>
    </section>
  </div>

  <section class="card" style="margin-top:12px">
    <div class="card-header">
      <strong id="mainChartTitle">กราฟตามช่วงเวลา</strong>
      <div class="row">
        <button id="btnExport" class="btn"style="display: none;">Export CSV</button>
      </div>
    </div>
    <div class="card-body" style="height:320px">
      <canvas id="mainChart"></canvas>
    </div>
  </section>
  `;

  const elB = document.getElementById("ovBuilding");
  const elM = document.getElementById("ovMetric");
  const timeTabs = document.querySelectorAll("#timeTabs .btn");
  const timeFilters = document.getElementById("timeFilters");
  const mainChartTitle = document.getElementById("mainChartTitle");

  let mainChart, donutChart;
  function renderTimeFilter(){
    if(selectedTime==="วัน"){
      timeFilters.innerHTML = `<div class="field"><label>เลือกวัน</label><input type="date" id="ovDate"/></div>`;
      document.getElementById("ovDate").valueAsDate = new Date();
    }else if(selectedTime==="สัปดาห์"){
      timeFilters.innerHTML = `
        <div class="field"><label>สัปดาห์</label><select id="ovWeek">${[1,2,3,4].map(w=>`<option>${w}</option>`).join("")}</select></div>
        <div class="field"><label>ปี</label><select id="ovYear">${[2022,2023,2024,2025,2026].map(y=>`<option ${y===selectedYear?"selected":""}>${y}</option>`).join("")}</select></div>`;
      document.getElementById("ovWeek").value = String(selectedWeek);
    }else if(selectedTime==="เดือน"){
      timeFilters.innerHTML = `
        <div class="field"><label>เดือน</label><select id="ovMonth">${Array.from({length:12},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join("")}</select></div>
        <div class="field"><label>ปี</label><select id="ovYear">${[2022,2023,2024,2025,2026].map(y=>`<option ${y===selectedYear?"selected":""}>${y}</option>`).join("")}</select></div>`;
      document.getElementById("ovMonth").value = String(selectedMonth);
    }else{
      timeFilters.innerHTML = `<div class="field"><label>ปี</label><select id="ovYear">${[2022,2023,2024,2025,2026].map(y=>`<option ${y===selectedYear?"selected":""}>${y}</option>`).join("")}</select></div>`;
    }
  }

  function computeUnit(){ return (selectedMetric==="น้ำ") ? "m³" : "kWh"; }
  function currentMode(){
    return selectedTime==="วัน" ? "day" : selectedTime==="สัปดาห์" ? "week" : selectedTime==="เดือน" ? "month" : "year";
  }

  function refresh(){
    const metricKey = (selectedMetric==="น้ำ") ? "water" : "power";
    const data = Store.genData({mode: currentMode(), metric: metricKey, month:selectedMonth, year:selectedYear});
    const unit = computeUnit();

    // title
    mainChartTitle.textContent = `กราฟ ${selectedMetric} (${selectedTime}) — ${selectedBuilding}`;

    // main chart
    const cfg = enterpriseLine(`${selectedMetric}`, data, unit);
    if(mainChart){ mainChart.destroy(); }
    const ctx = document.getElementById("mainChart");
    mainChart = new Chart(ctx, cfg);

    // donut summary: split internal vs main load 63/37
    const sum = data.reduce((a,b)=>a+b,0);
    const internal = sum*0.63, mainL = sum*0.37;
    if(donutChart) donutChart.destroy();
    donutChart = new Chart(document.getElementById("donut"), enterpriseDonut(["ภายใน","หลัก"], [internal, mainL], ["#f59e0b","#fbbf24"]));
    document.getElementById("totalValue").textContent = `${sum.toFixed(0)} ${unit}`;
    const delta = (Math.random()*10-5).toFixed(2);
    const el = document.getElementById("deltaText");
    el.textContent = `${delta>=0?"+":""}${delta}%`;
    el.className = "delta " + (delta>=0? "pos":"neg");

    // export
    document.getElementById("btnExport").onclick = () => {
      const header = ["Index", `Value (${unit})`];
      const rows = [header, ...data.map((v,i)=>[i+1, v])];
      exportCSV(`overview_${selectedMetric}_${selectedTime}.csv`, rows);
    };

    // fullscreen
    document.getElementById("btnFull").onclick = () => {
      modalTitle.textContent = `กราฟแบบเต็ม — ${selectedMetric} (${selectedTime})`;
      modal.classList.remove("hidden");
      const mctx = document.getElementById("modalChart");
      if(modalChart) modalChart.destroy();
      modalChart = new Chart(mctx, enterpriseLine(`${selectedMetric}`, data, unit));
    };
  }

  // wire
  elB.addEventListener("change", e=>{ selectedBuilding = e.target.value; refresh(); });
  elM.addEventListener("change", e=>{ selectedMetric = e.target.value; refresh(); });
  timeTabs.forEach(btn => {
    btn.addEventListener("click", () => {
      selectedTime = btn.dataset.tab;
      document.querySelectorAll("#timeTabs .btn").forEach(b=>b.classList.remove("primary"));
      btn.classList.add("primary");
      renderTimeFilter();
      refresh();
      // hook filter change
      setTimeout(()=>{
        document.getElementById("ovWeek")?.addEventListener("change", e=>{ selectedWeek = +e.target.value; refresh(); });
        document.getElementById("ovMonth")?.addEventListener("change", e=>{ selectedMonth = +e.target.value; refresh(); });
        document.getElementById("ovYear")?.addEventListener("change", e=>{ selectedYear = +e.target.value; refresh(); });
        document.getElementById("ovDate")?.addEventListener("change", ()=> refresh());
      },0);
    });
  });
  // default
  timeTabs[0].classList.add("primary");
  renderTimeFilter();
  refresh();
}

function renderSensors(){
  const list = Store.sensors();
  app.innerHTML = `
  <section class="card">
    <div class="card-header"><strong>สถานะเซนเซอร์</strong></div>
    <div class="card-body">
      <div class="row" style="margin-bottom:8px">
        <div class="badge ok">ออนไลน์: ${list.filter(s=>s.status==="ONLINE").length}</div>
        <div class="badge off">ออฟไลน์: ${list.filter(s=>s.status==="OFFLINE").length}</div>
      </div>
      <div class="row">
        <input id="sensorSearch" placeholder="ค้นหาอุปกรณ์..." />
        <select id="sensorType" class="field">
          <option>ทั้งหมด</option>
          <option>ไฟฟ้า</option>
          <option>น้ำ</option>
        </select>
        <select id="sensorStatus" class="field">
          <option>ทั้งหมด</option>
          <option>ONLINE</option>
          <option>OFFLINE</option>
        </select>
      </div>
    </div>
  </section>
  <section class="card" style="margin-top:12px">
    <div class="card-body">
      <table class="table" id="sensorTable">
        <thead><tr><th>ชื่อ</th><th>อาคาร</th><th>สถานะ</th><th>อัปเดต</th><th>ค่า</th></tr></thead>
        <tbody></tbody>
      </table>
    </div>
  </section>`;

  const tbody = document.querySelector("#sensorTable tbody");
  function inferType(n){ return (n.toLowerCase().includes("water") || n.includes("น้ำ")) ? "น้ำ" : "ไฟฟ้า"; }
  function statusBadge(s){ return `<span class="badge ${s==="ONLINE"?"ok":"off"}">${s}</span>`; }
  function renderRows(rows){
    tbody.innerHTML = rows.map(s=>`
      <tr>
        <td>${s.name} (${inferType(s.name)})</td>
        <td>${s.building}</td>
        <td>${statusBadge(s.status)}</td>
        <td>${s.lastUpdate}</td>
        <td>${s.value}</td>
      </tr>`).join("");
  }

  function applyFilters(){
    const q = document.getElementById("sensorSearch").value.toLowerCase();
    const t = document.getElementById("sensorType").value;
    const st = document.getElementById("sensorStatus").value;
    const filtered = list.filter(s => {
      const typeOK = (t==="ทั้งหมด") || (inferType(s.name)===t);
      const stOK = (st==="ทั้งหมด") || (s.status===st);
      const qOK = s.name.toLowerCase().includes(q);
      return typeOK && stOK && qOK;
    }).sort((a,b)=> a.building.localeCompare(b.building) || b.status.localeCompare(a.status));
    renderRows(filtered);
  }

  document.getElementById("sensorSearch").addEventListener("input", applyFilters);
  document.getElementById("sensorType").addEventListener("change", applyFilters);
  document.getElementById("sensorStatus").addEventListener("change", applyFilters);
  applyFilters();
}

function renderControl(){
  let selectedBuilding = "อาคารวิจัยและพัฒนาเทคโนโลยีทางวิศวกรรมไฟฟ้า";
  let selectedMetric = "ค่าพลังงานไฟฟ้า";
  let selectedRange = "วันนี้";
  let selectedWeek = 1, selectedMonth = 1, selectedYear = 2025;

  app.innerHTML = `
  <section class="card">
    <div class="card-header">
      <strong>แผงควบคุม</strong>
      <div class="row">
        <button id="btnFull" class="btn">Full Screen</button>
        <button id="btnExport" class="btn">Export CSV</button>
        <button id="btnControl" class="btn">Control</button>
      </div>
    </div>
    <div class="card-body">
      <div class="row">
        <div class="field"><label>อาคาร</label>
          <select id="ctlBuilding">
            <option>อาคารวิจัยและพัฒนาเทคโนโลยีทางวิศวกรรมไฟฟ้า</option>
            <option>อาคารวิศวกรรม</option>
            <option>ห้องสมุด</option>
          </select>
        </div>
        <div class="field"><label>ประเภทข้อมูล</label>
          <select id="ctlMetric">
            <option>ค่าพลังงานไฟฟ้า</option>
            <option>ค่าน้ำ</option>
          </select>
        </div>
        <div class="field"><label>ช่วงเวลา</label>
          <select id="ctlRange">
            <option>วันนี้</option><option>สัปดาห์นี้</option>
            <option>เดือนนี้</option><option>ปีนี้</option>
          </select>
        </div>
      </div>
      <div class="row" id="ctlTimeFilters" style="margin-top:8px"></div>
    </div>
  </section>

  <section class="card" style="margin-top:12px">
    <div class="card-body" style="height:320px">
      <canvas id="ctlChart"></canvas>
    </div>
  </section>

  <section class="grid grid-2" style="margin-top:12px">
    <div class="card"><div class="card-body kpi">
      <div>Average</div><div class="value" id="avgVal">0</div>
    </div></div>
    <div class="card"><div class="card-body kpi">
      <div>Peak</div><div class="value" id="peakVal">0</div>
    </div></div>
  </section>`;

  function unit(){ return selectedMetric==="ค่าน้ำ" ? "m³" : "kWh"; }
  function mode(){ return selectedRange==="วันนี้"?"day":selectedRange==="สัปดาห์นี้"?"week":selectedRange==="เดือนนี้"?"month":"year"; }
  function gen(){ return Store.genData({mode: mode(), metric: selectedMetric==="ค่าน้ำ"?"water":"power"}); }

  const ctx = document.getElementById("ctlChart");
  let chart;

  function renderTimeFilters(){
    const c = document.getElementById("ctlTimeFilters");
    if(selectedRange==="วันนี้"){
      c.innerHTML = `<div class="field"><label>เลือกวัน</label><input id="ctlDate" type="date"/></div>`;
      document.getElementById("ctlDate").valueAsDate = new Date();
    } else if(selectedRange==="สัปดาห์นี้"){
      c.innerHTML = `<div class="field"><label>สัปดาห์</label><select id="ctlWeek">${[1,2,3,4].map(w=>`<option>${w}</option>`).join("")}</select></div>`;
      document.getElementById("ctlWeek").value = String(selectedWeek);
    } else if(selectedRange==="เดือนนี้"){
      c.innerHTML = `<div class="field"><label>เดือน</label><select id="ctlMonth">${Array.from({length:12},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join("")}</select></div>`;
      document.getElementById("ctlMonth").value = String(selectedMonth);
    } else {
      c.innerHTML = `<div class="field"><label>ปี</label><select id="ctlYear">${[2022,2023,2024,2025,2026].map(y=>`<option ${y===selectedYear?"selected":""}>${y}</option>`).join("")}</select></div>`;
    }
  }

  function refresh(){
    const data = gen();
    const cfg = enterpriseLine(selectedMetric, data, unit());
    if(chart) chart.destroy();
    chart = new Chart(ctx, cfg);

    const avg = data.reduce((a,b)=>a+b,0)/data.length;
    const peak = Math.max(...data);
    document.getElementById("avgVal").textContent = avg.toFixed(1)+" "+unit();
    document.getElementById("peakVal").textContent = peak.toFixed(1)+" "+unit();
  }

  // wire dropdowns
  document.getElementById("ctlBuilding").addEventListener("change", e=>{ selectedBuilding=e.target.value; refresh(); });
  document.getElementById("ctlMetric").addEventListener("change", e=>{ selectedMetric=e.target.value; refresh(); });
  document.getElementById("ctlRange").addEventListener("change", e=>{ selectedRange=e.target.value; renderTimeFilters(); refresh(); });

  // buttons
  document.getElementById("btnExport").onclick = ()=>{
    const data = gen();
    const rows = [["Index",`Value (${unit()})`], ...data.map((v,i)=>[i+1,v])];
    exportCSV(`control_${selectedMetric}_${selectedRange}.csv`, rows);
  };
  document.getElementById("btnControl").onclick = ()=> alert("⚠ ระบบยังไม่พร้อมเชื่อมต่อการควบคุม");
  document.getElementById("btnFull").onclick = ()=>{
    const data = gen();
    modalTitle.textContent = `กราฟแบบเต็ม — ${selectedMetric} (${selectedRange})`;
    modal.classList.remove("hidden");
    if(modalChart) modalChart.destroy();
    modalChart = new Chart(document.getElementById("modalChart"), enterpriseLine(selectedMetric, data, unit()));
  };

  renderTimeFilters();
  refresh();
}

function renderAlerts(){
  let selectedBuilding="ทั้งหมด", selectedType="ทั้งหมด", selectedRange="วันนี้";
  const buildings = ["ทั้งหมด","อาคารวิศวกรรม","อาคารวิจัย","ห้องสมุด"];
  const types = ["ทั้งหมด","อุปกรณ์ออฟไลน์","พลังงานสูงผิดปกติ"];
  const ranges = ["วันนี้","สัปดาห์นี้","เดือนนี้"];
  const data = Store.alerts();

  app.innerHTML = `
  <section class="card">
    <div class="card-header"><strong>แจ้งเตือน</strong></div>
    <div class="card-body">
      <div class="row">
        <div class="field"><label>อาคาร</label><select id="alBuilding">${buildings.map(b=>`<option>${b}</option>`).join("")}</select></div>
        <div class="field"><label>ประเภท</label><select id="alType">${types.map(b=>`<option>${b}</option>`).join("")}</select></div>
        <div class="field"><label>ช่วงเวลา</label><select id="alRange">${ranges.map(b=>`<option>${b}</option>`).join("")}</select></div>
        <button id="btnReset" class="btn">รีเซ็ต</button>
      </div>
    </div>
  </section>
  <section class="card" style="margin-top:12px">
    <div class="card-body">
      <table class="table" id="alertTable">
        <thead><tr><th>อาคาร</th><th>อุปกรณ์</th><th>เหตุการณ์</th><th>เวลา</th><th>สถานะ</th></tr></thead>
        <tbody></tbody>
      </table>
    </div>
  </section>`;

  const tbody = document.querySelector("#alertTable tbody");
  function statusBadge(s){ return s==="error" ? `<span class="badge off">ALARM</span>` :
                                s==="warning" ? `<span class="badge warn">WARNING</span>` :
                                `<span class="badge ok">OK</span>`; }
  function apply(){
    const rows = data.filter(a => 
      (selectedBuilding==="ทั้งหมด" || a.building===selectedBuilding) &&
      (selectedType==="ทั้งหมด" || a.event===selectedType) &&
      (selectedRange==="วันนี้") // mock
    );
    tbody.innerHTML = rows.map(a => `
      <tr class="alertRow">
        <td>${a.building}</td><td>${a.device}</td><td>${a.event}</td><td>${a.time}</td><td>${statusBadge(a.status)}</td>
      </tr>`).join("") || `<tr><td colspan="5">ไม่มีข้อมูล</td></tr>`;
    // attach row click -> modal chart
    document.querySelectorAll(".alertRow").forEach((tr, idx)=>{
      tr.addEventListener("click", ()=>{
        const m = Array.from({length:24}, (_,i)=> Math.round(100+Math.random()*120));
        modalTitle.textContent = `${rows[idx].device} — snapshot`;
        modal.classList.remove("hidden");
        if(modalChart) modalChart.destroy();
        modalChart = new Chart(document.getElementById("modalChart"), enterpriseLine("Value", m, ""));
      });
    });
  }
  document.getElementById("alBuilding").addEventListener("change", e=>{selectedBuilding=e.target.value;apply();});
  document.getElementById("alType").addEventListener("change", e=>{selectedType=e.target.value;apply();});
  document.getElementById("alRange").addEventListener("change", e=>{selectedRange=e.target.value;apply();});
  document.getElementById("btnReset").addEventListener("click", ()=>{
    selectedBuilding="ทั้งหมด"; selectedType="ทั้งหมด"; selectedRange="วันนี้";
    document.getElementById("alBuilding").value=selectedBuilding;
    document.getElementById("alType").value=selectedType;
    document.getElementById("alRange").value=selectedRange;
    apply();
  });
  apply();
}

function renderSettings(){
  const p = Store.getProfile();
  app.innerHTML = `
  <section class="card">
    <div class="card-header"><strong>ตั้งค่า</strong></div>
    <div class="card-body">
      <div class="row">
        <div class="kpi" style="min-width:260px">
          <div>ชื่อ</div><div class="value">${p.name}</div>
          <div class="helper">${p.email}</div>
          <div class="helper">${p.department} • ${p.building}</div>
        </div>
      </div>
      <div class="sep"></div>
      <div class="row">
        <a href="#/edit-profile" class="btn">แก้ไขโปรไฟล์</a>
        <a href="#/change-password" class="btn">เปลี่ยนรหัสผ่าน</a>
        <a href="#/about" class="btn">เกี่ยวกับระบบ</a>
        <span style="flex:1"></span>
        <button class="btn danger" id="btnLogout">ออกจากระบบ</button>
      </div>
    </div>
  </section>`;
  document.getElementById("btnLogout").onclick = ()=>{
      if (confirm("ยืนยันออกจากระบบ?")) {
    localStorage.removeItem("auth");
    window.location.href = "login.html";
  }
  }
}








function renderAbout(){
  app.innerHTML = `
  <section class="card">
    <div class="card-header"><strong>เกี่ยวกับระบบ</strong></div>
    <div class="card-body">
      <p><strong>โครงการระบบติดตามการใช้พลังงานและน้ำ</strong></p>
      <p>มหาวิทยาลัยตัวอย่าง • พัฒนาโดย ฝ่าย IT และฝ่ายอำนวยการ</p>
      <p>ติดต่อ: it-support@example.ac.th</p>
      <div class="sep"></div>
      <a class="btn" href="https://odoo.example.com" target="_blank" rel="noreferrer">ลิงก์ Web Dashboard (Odoo)</a>
    </div>
  </section>`;
}

function renderEditProfile(){
  const p = Store.getProfile();
  app.innerHTML = `
  <section class="card">
    <div class="card-header"><strong>แก้ไขโปรไฟล์</strong></div>
    <div class="card-body">
      <div class="row">
        <div class="field" style="flex:1"><label>ชื่อ</label><input id="pfName" value="${p.name}"/></div>
        <div class="field" style="flex:1"><label>หน่วยงาน</label><input id="pfDept" value="${p.department}"/></div>
        <div class="field" style="flex:1"><label>อาคารที่รับผิดชอบ</label><input id="pfBld" value="${p.building}"/></div>
      </div>
      <div class="sep"></div>
      <button id="pfSave" class="btn success">บันทึก</button>
      <a class="btn" href="#/settings">ยกเลิก</a>
    </div>
  </section>`;
  document.getElementById("pfSave").onclick = ()=>{
    const name = document.getElementById("pfName").value || p.name;
    const department = document.getElementById("pfDept").value || p.department;
    const building = document.getElementById("pfBld").value || p.building;
    Store.setProfile({...p, name, department, building});
    alert("✅ บันทึกแล้ว");
    location.hash = "#/settings";
  }
}

function renderChangePassword(){
  app.innerHTML = `
  <section class="card">
    <div class="card-header"><strong>เปลี่ยนรหัสผ่าน</strong></div>
    <div class="card-body">
      <div class="row">
        <div class="field" style="flex:1"><label>Old Password</label><input id="pwOld" type="password"/></div>
        <div class="field" style="flex:1"><label>New Password</label><input id="pwNew" type="password"/></div>
      </div>
      <div class="helper">อย่างน้อย 8 ตัวอักษร มีตัวเลขและอักษรผสม</div>
      <div class="sep"></div>
      <button id="pwSave" class="btn success">เปลี่ยนรหัสผ่าน</button>
      <a class="btn" href="#/settings">ยกเลิก</a>
    </div>
  </section>`;
  document.getElementById("pwSave").onclick = ()=>{
    const n = document.getElementById("pwNew").value;
    if(!n || n.length<8 || !/\d/.test(n)){ alert("โปรดตั้งรหัสอย่างน้อย 8 ตัวและมีตัวเลข"); return; }
    alert("✅ เปลี่ยนรหัสผ่าน (mock)");
    location.hash = "#/settings";
  }
}

function renderNotFound(){
  app.innerHTML = `<div class="card"><div class="card-body">ไม่พบหน้า</div></div>`;
}
