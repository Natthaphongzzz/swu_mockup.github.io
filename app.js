// Utility mock + chart rendering
const $ = (id) => document.getElementById(id);
const fmt = (n) => n.toLocaleString('th-TH');

// State
let state = {
  building: 'อาคารวิจัย',
  metric: 'ไฟฟ้า', // น้ำ
  range: 'day',    // day|week|month|year
  date: new Date(),
  week: 1,
  month: (new Date()).getMonth()+1,
  year: (new Date()).getFullYear(),
};

// Subfilters UI
function renderSubFilters(){
  const b = $('f-building'); // not used but kept for future
  const wrap = $('subfilters');
  wrap.innerHTML = '';

  if(state.range === 'day'){
    const d = document.createElement('input');
    d.type = 'date';
    d.valueAsDate = state.date;
    d.onchange = (e)=>{
      state.date = new Date(e.target.value);
      refresh();
    }
    d.className = 'date';
    wrap.appendChild(d);
  }
  else if(state.range === 'week'){
    const sw = document.createElement('select');
    for(let i=1;i<=4;i++){
      const o = document.createElement('option');
      o.value=i; o.textContent='สัปดาห์ที่ '+i;
      if(i===state.week) o.selected=true;
      sw.appendChild(o);
    }
    sw.onchange = (e)=>{ state.week = parseInt(e.target.value,10); refresh(); };
    wrap.appendChild(sw);

    const y = document.createElement('select');
    const yNow = (new Date()).getFullYear();
    for(let i=0;i<6;i++){
      const val = yNow - i;
      const o = document.createElement('option');
      o.value=val; o.textContent=val;
      if(val===state.year) o.selected=true;
      y.appendChild(o);
    }
    y.onchange = (e)=>{ state.year = parseInt(e.target.value,10); refresh(); };
    wrap.appendChild(y);
  }
  else if(state.range === 'month'){
    const m = document.createElement('select');
    for(let i=1;i<=12;i++){
      const o = document.createElement('option');
      o.value=i; o.textContent=i;
      if(i===state.month) o.selected=true;
      m.appendChild(o);
    }
    m.onchange=(e)=>{ state.month=parseInt(e.target.value,10); refresh(); };
    wrap.appendChild(m);

    const y = document.createElement('select');
    const yNow = (new Date()).getFullYear();
    for(let i=0;i<6;i++){
      const val = yNow - i;
      const o = document.createElement('option');
      o.value=val; o.textContent=val;
      if(val===state.year) o.selected=true;
      y.appendChild(o);
    }
    y.onchange=(e)=>{ state.year=parseInt(e.target.value,10); refresh(); };
    wrap.appendChild(y);
  }
  else if(state.range === 'year'){
    const y = document.createElement('select');
    const yNow = (new Date()).getFullYear();
    for(let i=0;i<6;i++){
      const val = yNow - i;
      const o = document.createElement('option');
      o.value=val; o.textContent=val;
      if(val===state.year) o.selected=true;
      y.appendChild(o);
    }
    y.onchange=(e)=>{ state.year=parseInt(e.target.value,10); refresh(); };
    wrap.appendChild(y);
  }
}

// Mock generator
function daysInMonth(year, month){
  return new Date(year, month, 0).getDate();
}

function genData(){
  const r = state.range;
  const isPower = state.metric === 'ไฟฟ้า';
  let n;
  if(r==='day') n = 24;
  else if(r==='week') n = 7;
  else if(r==='month') n = daysInMonth(state.year, state.month);
  else n = 12;

  const base = (r==='day') ? (isPower ? 120 : 10) :
               (r==='week') ? (isPower ? 1000 : 100) :
               (r==='month') ? (isPower ? 3500 : 350) :
                               (isPower ? 8000 : 800);

  // simple random noise
  const arr = Array.from({length:n}, () => +(base * (0.9 + Math.random()*0.2)).toFixed(2));
  return arr;
}

function splitInternalMain(total){
  // 63/37 split like mobile
  const internal = total * 0.63;
  const main = total - internal;
  return [internal, main];
}

// Charts
let pieChart, lineChart;

function renderPie(internal, main){
  const ctx = $('pieUsage');
  if(pieChart) pieChart.destroy();
  pieChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['ภายใน','โหลดหลัก'],
      datasets: [{
        data: [internal, main],
        backgroundColor: ['#fb923c', '#facc15'],
      }]
    },
    options: { cutout: '60%', plugins: { legend: { position:'bottom' } } }
  });

  $('vInternal').textContent = fmt(Math.round(internal));
  $('vMain').textContent = fmt(Math.round(main));
  $('vTotal').textContent = fmt(Math.round(internal+main));
}

function renderLine(data){
  const ctx = $('lineUsage');
  if(lineChart) lineChart.destroy();

  // x labels
  const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  let labels;
  if(state.range==='day'){
    labels = Array.from({length:24}, (_,i)=> `${i}:00`);
  }else if(state.range==='week'){
    labels = Array.from({length:7}, (_,i)=> `วันที่ ${i+1}`);
  }else if(state.range==='month'){
    const d = daysInMonth(state.year, state.month);
    labels = Array.from({length:d}, (_,i)=> `วันที่ ${i+1}`);
  }else{
    labels = months;
  }

  lineChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: `${state.metric} (${({day:'วัน',week:'สัปดาห์',month:'เดือน',year:'ปี'})[state.range]})`,
        data,
        borderWidth: 2,
        pointRadius: 2
      }]
    },
    options: {
      responsive: true,
      interaction:{mode:'index', intersect:false},
      scales: { y: { ticks: { callback: (v)=> v.toLocaleString() } } }
    }
  });
}

function refresh(){
  // data
  const data = genData();
  const total = data.reduce((a,b)=>a+b,0);
  const [internal, main] = splitInternalMain(total);

  // mock percent vs yesterday
  const yesterday = total * (0.95 + Math.random()*0.1);
  const pct = ((total - yesterday)/yesterday)*100;
  const p = $('vPercent');
  p.textContent = `${pct>=0?'▲':'▼'} ${Math.abs(pct).toFixed(2)}%`;
  p.className = 'badge ' + (pct>=0 ? 'up' : 'down');

  renderPie(internal, main);
  renderLine(data);
}

// Wiring
function init(){
  // dropdowns
  $('f-building').onchange = (e)=>{ state.building = e.target.value; refresh(); };
  $('f-metric').onchange = (e)=>{ state.metric = e.target.value; refresh(); };
  $('f-range').onchange = (e)=>{ state.range = e.target.value; renderSubFilters(); refresh(); };
  $('btn-reset').onclick = ()=>{
    state = {
      building: 'อาคารวิจัย',
      metric: 'ไฟฟ้า',
      range: 'day',
      date: new Date(),
      week: 1,
      month: (new Date()).getMonth()+1,
      year: (new Date()).getFullYear(),
    };
    $('f-building').value = state.building;
    $('f-metric').value = state.metric;
    $('f-range').value = state.range;
    renderSubFilters();
    refresh();
  };

  renderSubFilters();
  refresh();
}

document.addEventListener('DOMContentLoaded', init);
