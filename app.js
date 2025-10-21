/* ===== Utilities ===== */
const $ = sel => document.querySelector(sel);
const $ = sel => Array.from(document.querySelectorAll(sel));
const toISO = d => new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);
const addDays = (d,n)=>{const x=new Date(d); x.setDate(x.getDate()+n); return x;}
const DEFAULT_DATE = toISO(new Date());

/* ===== State Schema =====
STATE = {
  version:4,
  selectedMode:"Day"|"Week",
  selectedPeriod:"AM"|"PM",
  selectedDate:"YYYY-MM-DD",
  courses:{ hq:{start:"", stop:""}, fluo:{start:"", stop:""}, tret:{nightsPerWeek:5} },
  days:{ "YYYY-MM-DD":{ am:{ stepLabel:bool }, pm:{ stepLabel:bool } } },
  weeks:[ {id, label:"YYYY‑Www"} ]
}
*/
const DEFAULT_STATE = {
  version:4,
  selectedMode:"Day",
  selectedPeriod:(new Date().getHours()<12 ? "AM" : "PM"),
  selectedDate: DEFAULT_DATE,
  courses:{ hq:{start:"", stop:""}, fluo:{start:"", stop:""}, tret:{nightsPerWeek:5} },
  days:{}, weeks:[]
};
let STATE = loadState();

/* Dermatologist order (Monk 7–8, PIH‑safe) */
const AM_STEPS = [
  "Cleanse — La Roche‑Posay",
  "Hydrate — Hada Labo Gokujyun (damp skin)",
  "Niacinamide 10% + Zinc 1% (optional)",
  "Clindamycin 1% roll‑on — shave‑prone areas",
  "Azelaic acid 15–20% — thin layer",
  "Moisturizer (light gel‑cream)",
  "SPF — Saie tinted moisturizer (face)"
];
const PM_STEPS = [
  "Cleanse — lukewarm water",
  "Hydrate — Hada Labo Gokujyun",
  "Hydroquinone 4% — rice‑grain to spots (≤8 weeks on)",
  "Fluocinolone 0.01% — whisper‑thin over HQ spots (2–4 weeks only)",
  "Tretinoin 0.05% — pea‑size to lower face 2–3x/week → build up",
  "Moisturizer / sandwich buffer as needed"
];

/* ===== Tabs: Mode & Period ===== */
const tabDay = $('#tab-day'), tabWeek = $('#tab-week');
const panelDay = $('#panel-day'), panelWeek = $('#panel-week');
function selectMode(name){
  const isDay = name==="Day";
  tabDay.setAttribute('aria-selected', isDay);
  tabWeek.setAttribute('aria-selected', !isDay);
  panelDay.hidden = !isDay;
  panelWeek.hidden = isDay;
  STATE.selectedMode = name; saveState();
  if(!isDay) renderWeekStrip();
}
tabDay.addEventListener('click', ()=>selectMode("Day"));
tabWeek.addEventListener('click', ()=>selectMode("Week"));
selectMode(STATE.selectedMode || "Day");

const tabAM = $('#tab-am'), tabPM = $('#tab-pm');
const amBlock = $('#am-block'), pmBlock = $('#pm-block');
function selectPeriod(name){
  const isAM = name==="AM";
  tabAM.setAttribute('aria-selected', isAM);
  tabPM.setAttribute('aria-selected', !isAM);
  amBlock.hidden = !isAM;
  pmBlock.hidden = isAM;
  STATE.selectedPeriod = name; saveState();
}
tabAM.addEventListener('click', ()=>selectPeriod("AM"));
tabPM.addEventListener('click', ()=>selectPeriod("PM"));
selectPeriod(STATE.selectedPeriod || (new Date().getHours()<12 ? "AM" : "PM"));

/* ===== Date Picker ===== */
const datePicker = $('#datePicker');
datePicker.value = STATE.selectedDate || DEFAULT_DATE;
datePicker.addEventListener('change', ()=>{
  STATE.selectedDate = datePicker.value || DEFAULT_DATE;
  ensureDay(STATE.selectedDate);
  saveState();
  renderDayLists();
});

/* ===== Ensure Day ===== */
function ensureDay(dateStr){
  if(!STATE.days[dateStr]){
    STATE.days[dateStr] = { am:{}, pm:{} };
    AM_STEPS.forEach(s=>STATE.days[dateStr].am[s]=false);
    PM_STEPS.forEach(s=>STATE.days[dateStr].pm[s]=false);
  }else{
    AM_STEPS.forEach(s=>{ if(!(s in STATE.days[dateStr].am)) STATE.days[dateStr].am[s]=false;});
    PM_STEPS.forEach(s=>{ if(!(s in STATE.days[dateStr].pm)) STATE.days[dateStr].pm[s]=false;});
  }
}

/* ===== Render Day Lists ===== */
function renderChecklist(container, steps, checkedMap, side){
  container.innerHTML = '';
  steps.forEach(step=>{
    const row = document.createElement('label'); row.className='item';
    const cb = document.createElement('input'); cb.type='checkbox';
    cb.checked = !!checkedMap[step];
    cb.dataset.step = step; cb.dataset.side = side;
    const txt = document.createElement('div'); txt.textContent = step;
    row.appendChild(cb); row.appendChild(txt);
    container.appendChild(row);
    cb.addEventListener('change', (e)=>{
      const s = e.target.dataset.step, which = e.target.dataset.side;
      STATE.days[STATE.selectedDate][which][s] = e.target.checked;
      saveState();
      if(!panelWeek.hidden) renderWeekStrip();
    });
  });
}
function inRange(start, stop, d=new Date()){
  if(!start||!stop) return false;
  const t=d.setHours(0,0,0,0), a=new Date(start).getTime(), b=new Date(stop).getTime();
  return t>=a && t<=b;
}
function renderDayLists(){
  const d = STATE.selectedDate;
  ensureDay(d);
  const hqActive = inRange(STATE.courses.hq.start, STATE.courses.hq.stop);
  const fluoActive = inRange(STATE.courses.fluo.start, STATE.courses.fluo.stop);
  const pmSteps = PM_STEPS.map(s=>{
    if(s.startsWith("Hydroquinone") && !hqActive) return s + " (off‑cycle)";
    if(s.startsWith("Fluocinolone") && !fluoActive) return s + " (off‑cycle)";
    return s;
  });
  renderChecklist($('#am-list'), AM_STEPS, STATE.days[d].am, 'am');
  renderChecklist($('#pm-list'), pmSteps, STATE.days[d].pm, 'pm');
}
renderDayLists();

/* ===== Week Strip ===== */
function startOfWeek(d){
  const date = new Date(d); const day = date.getDay(); // 0=Sun
  const diff = (day===0? -6 : 1 - day); // Monday
  return toISO(addDays(date, diff));
}
function stepRow(dateISO, side, label, baseKey){
  const row = document.createElement('label'); row.className='item';
  const key = baseKey || label;
  const checked = STATE.days[dateISO][side][key] || false;
  const cb = document.createElement('input'); cb.type='checkbox'; cb.checked=checked;
  cb.dataset.date = dateISO; cb.dataset.side=side; cb.dataset.key=key;
  const txt = document.createElement('div'); txt.textContent = label;
  row.appendChild(cb); row.appendChild(txt);
  cb.addEventListener('change', (e)=>{
    const dt = e.target.dataset.date, sd = e.target.dataset.side, k = e.target.dataset.key;
    ensureDay(dt);
    STATE.days[dt][sd][k] = e.target.checked; saveState();
    if(dt === STATE.selectedDate) renderDayLists();
  });
  return row;
}
function renderWeekStrip(){
  const wrap = $('#weekStrip'); wrap.innerHTML='';
  const mondayISO = startOfWeek(new Date(STATE.selectedDate));
  for(let i=0;i<7;i++){
    const dateISO = toISO(addDays(new Date(mondayISO), i));
    ensureDay(dateISO);
    const card = document.createElement('div'); card.className='day-card';
    const h = document.createElement('h4');
    const d = new Date(dateISO);
    h.textContent = d.toLocaleDateString(undefined,{weekday:'short', month:'short', day:'numeric'});
    card.appendChild(h);

    const capAM = document.createElement('div'); capAM.innerHTML = "<strong>AM</strong>";
    const cellAM = document.createElement('div'); cellAM.className='day-cell';
    card.appendChild(capAM); AM_STEPS.forEach(s=>cellAM.appendChild(stepRow(dateISO,'am',s)));
    card.appendChild(cellAM);

    const capPM = document.createElement('div'); capPM.innerHTML = "<strong>PM</strong>";
    const cellPM = document.createElement('div'); cellPM.className='day-cell';
    card.appendChild(capPM);
    const hq = inRange(STATE.courses.hq.start, STATE.courses.hq.stop, new Date(dateISO));
    const fl = inRange(STATE.courses.fluo.start, STATE.courses.fluo.stop, new Date(dateISO));
    PM_STEPS.forEach(s=>{
      const label = s.startsWith("Hydroquinone") && !hq ? s+" (off‑cycle)"
                 : s.startsWith("Fluocinolone") && !fl ? s+" (off‑cycle)" : s;
      cellPM.appendChild(stepRow(dateISO,'pm',label, s));
    });
    card.appendChild(cellPM);
    wrap.appendChild(card);
  }
}
renderWeekStrip();

/* ===== Courses ===== */
const hqStart = $('#hqStart'), hqStop = $('#hqStop');
const fluoStart = $('#fluoStart'), fluoStop = $('#fluoStop');
const tretNights = $('#tretNights');
function bindCourses(){
  hqStart.value = STATE.courses.hq.start || '';
  hqStop.value = STATE.courses.hq.stop || '';
  fluoStart.value = STATE.courses.fluo.start || '';
  fluoStop.value = STATE.courses.fluo.stop || '';
  tretNights.value = STATE.courses.tret.nightsPerWeek;

  [hqStart,hqStop,fluoStart,fluoStop,tretNights].forEach(el=>{
    el.addEventListener('change', ()=>{
      STATE.courses.hq.start = hqStart.value;
      STATE.courses.hq.stop = hqStop.value;
      STATE.courses.fluo.start = fluoStart.value;
      STATE.courses.fluo.stop = fluoStop.value;
      STATE.courses.tret.nightsPerWeek = parseInt(tretNights.value,10);
      saveState();
      renderDayLists(); renderWeekStrip();
    });
  });

  $('#hqCalc').addEventListener('click', ()=>{
    if(!hqStart.value) hqStart.value = toISO(new Date());
    hqStop.value = toISO(addDays(new Date(hqStart.value), 56));
    hqStart.dispatchEvent(new Event('change'));
  });
  $('#fluoCalc').addEventListener('click', ()=>{
    if(!fluoStart.value) fluoStart.value = toISO(new Date());
    fluoStop.value = toISO(addDays(new Date(fluoStart.value), 21));
    fluoStart.dispatchEvent(new Event('change'));
  });
}
bindCourses();

/* ===== Weeks List ===== */
const weeksList = $('#weeksList');
$('#addWeek').addEventListener('click', ()=>{
  const id = `w-${Date.now()}`;
  const label = isoWeekLabel(new Date(STATE.selectedDate));
  STATE.weeks.unshift({id, label}); saveState(); renderWeeks();
});
$('#clearToday').addEventListener('click', ()=>{
  const d = STATE.selectedDate; ensureDay(d);
  Object.keys(STATE.days[d].am).forEach(k=>STATE.days[d].am[k]=false);
  Object.keys(STATE.days[d].pm).forEach(k=>STATE.days[d].pm[k]=false);
  saveState(); renderDayLists(); renderWeekStrip();
});
function renderWeeks(){
  weeksList.innerHTML='';
  STATE.weeks.forEach(w=>{
    const li=document.createElement('li'); li.textContent = w.label;
    weeksList.appendChild(li);
  });
}
renderWeeks();
function isoWeekLabel(d){
  const date=new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay()||7); date.setUTCDate(date.getUTCDate()+4-dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
  const weekNo = Math.ceil((((date - yearStart)/86400000)+1)/7);
  return `${date.getUTCFullYear()}‑W${String(weekNo).padStart(2,'0')}`;
}

/* ===== Export / Import / Print ===== */
$('#btn-export').addEventListener('click', ()=>{
  const data = JSON.stringify(STATE, null, 2);
  download('glass-skin-state.json', data, 'application/json');
});
$('#importFile').addEventListener('change', async (e)=>{
  const file = e.target.files[0]; if(!file) return;
  const text = await file.text();
  try{
    STATE = JSON.parse(text); saveState(true);
    // re-init UI
    datePicker.value = STATE.selectedDate || DEFAULT_DATE;
    selectMode(STATE.selectedMode || "Day");
    selectPeriod(STATE.selectedPeriod || (new Date().getHours()<12?"AM":"PM"));
    renderDayLists(); renderWeeks(); renderWeekStrip();
  }catch(err){ alert('Invalid file'); }
});
$('#btn-print').addEventListener('click', ()=>window.print());
function download(filename, data, mime){
  const a=document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data],{type:mime||'text/plain'}));
  a.download=filename; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 500);
}

/* ===== Shortcuts & ICS ===== */
$('#btn-reminder').addEventListener('click', ()=>{
  const payload = encodeURIComponent(`{{Glass}} Skincare — ${STATE.selectedDate} ${STATE.selectedPeriod}`);
  const url = `shortcuts://run-shortcut?name=Glass%20Skincare%20Reminder&input=${payload}`;
  location.href = url;
});
$('#btn-ics').addEventListener('click', ()=>{
  const ics = generateICS();
  download('glassy-skin.ics', ics, 'text/calendar');
});
function pad(n){return String(n).padStart(2,'0')}
function fmt(d){
  return d.getUTCFullYear()+pad(d.getUTCMonth()+1)+pad(d.getUTCDate())+'T'+pad(d.getUTCHours())+pad(d.getUTCMinutes())+'00Z';
}
function generateICS(){
  const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Glass//Skincare//EN'];
  const base = new Date(STATE.selectedDate || new Date());
  for(let i=0;i<28;i++){
    const day = addDays(base, i);
    const am = new Date(day); am.setHours(8,0,0,0);
    const pm = new Date(day); pm.setHours(20,0,0,0);
    const events = [
      {summary:'{{Glass}} AM Routine', start:am, end:new Date(am.getTime()+30*60000)},
      {summary:'{{Glass}} PM Routine', start:pm, end:new Date(pm.getTime()+30*60000)}
    ];
    events.forEach(ev=>{
      lines.push('BEGIN:VEVENT');
      lines.push('UID:'+ev.start.getTime()+Math.random().toString(36).slice(2)+'@glass');
      lines.push('DTSTAMP:'+fmt(new Date()));
      lines.push('DTSTART:'+fmt(ev.start));
      lines.push('DTEND:'+fmt(ev.end));
      lines.push('SUMMARY:'+ev.summary);
      lines.push('END:VEVENT');
    });
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/* ===== Accessibility & Nav jumps ===== */
['btn-products','btn-courses','btn-weeks'].forEach(id=>{
  $('#'+id).addEventListener('click', ()=>{
    const target = { 'btn-products':'products-panel','btn-courses':'courses-panel','btn-weeks':'weeks-panel' }[id];
    document.getElementById(target).scrollIntoView({behavior:'smooth', block:'center'});
  });
});

/* ===== Local Storage ===== */
function loadState(){
  try{
    const s = localStorage.getItem('glass-state');
    if(!s) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(s);
    return {...structuredClone(DEFAULT_STATE), ...parsed};
  }catch(e){ return structuredClone(DEFAULT_STATE); }
}
function saveState(force){ localStorage.setItem('glass-state', JSON.stringify(STATE)); }

/* ===== Init ===== */
(function init(){
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  }
  selectMode(STATE.selectedMode || "Day");
  selectPeriod(STATE.selectedPeriod || (new Date().getHours()<12 ? "AM":"PM"));
  ensureDay(STATE.selectedDate); renderDayLists(); renderWeekStrip(); renderWeeks();
  datePicker.value = STATE.selectedDate || DEFAULT_DATE;
})();