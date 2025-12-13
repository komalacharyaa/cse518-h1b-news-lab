// H1B News Lab — static prototype (v2 per requirements)
(function(){
  const qs = (sel, el=document)=> el.querySelector(sel);
  const rnd = arr => arr[Math.floor(Math.random()*arr.length)];
  const nowIso = ()=> new Date().toISOString();

  const ui = {
    frameTone: qs('#frameTone'),
    sourceLabel: qs('#sourceLabel'),
    uncertaintyFlag: qs('#uncertaintyFlag'),
    cadenceMode: qs('#cadenceMode'),
    startBtn: qs('#startBtn'),
    showNext: qs('#showNext'),
    showDigest: qs('#showDigest'),
    cards: qs('#cards'),
    consent: qs('#consent'),
    agree: qs('#agreeBox'),
    endSession: qs('#endSession'),
    conditionBox: qs('#conditionBox'),
    kpiCards: qs('#kpiCards'),
    kpiAffect: qs('#kpiAffect'),
    kpiClarity: qs('#kpiClarity'),
    affectModal: qs('#affectModal'),
    affectSlider: qs('#affectSlider'),
    submitAffect: qs('#submitAffect'),
    surveyModal: qs('#surveyModal'),
    trustSlider: qs('#trustSlider'),
    submitSurvey: qs('#submitSurvey'),
    exportBox: qs('#exportBox'),
    exportCsv: qs('#exportCsv'),
    chart: qs('#worryChart'),
  };

  // >= 6 base items (generic, non-factual)
  // Dynamically load 6 random items from rewritten_news.csv
  async function loadRewrittenNews() {
    const res = await fetch("rewritten_news.csv");
    const text = await res.text();
    const lines = text.trim().split("\n");
    const headers = lines.shift().split(",");
    const items = lines.map(line => {
      const cols = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/); // safe CSV split
      const obj = {};
      headers.forEach((h,i)=> obj[h.trim()] = cols[i] ? cols[i].replace(/^"|"$/g,"") : "");
      return obj;
    });
    // shuffle and take 6
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items.slice(0,6);
  }

  const SOURCES = ['official','major','social'];

  const state = {
    sessionId: ('S'+Math.random().toString(36).slice(2)),
    userId: ('U'+Math.random().toString(36).slice(2)),
    conditions: {frame:'auto', source:'auto', uncertainty:'auto', cadence:'auto'},
    items: [],
    shownIndex: -1,
    logs: [],
    affect: [],
    affectAsked:false,
    quiz:{}, trust:null, actions: {},
    chartPoints: [],
    timers: {reveal:null},
  };

  function decideConditions(){
    const autoPick = {
      frame: rnd(['neutral','alarming']),
      cadence: (qs('#cadenceMode').value==='auto') ? 'auto' : qs('#cadenceMode').value,
    };
    state.conditions.frame = (ui.frameTone.value==='auto') ? autoPick.frame : ui.frameTone.value;
    state.conditions.source = ui.sourceLabel.value; // may be 'auto' → per-item
    state.conditions.uncertainty = ui.uncertaintyFlag.value; // may be 'auto' → per-item
    state.conditions.cadence = autoPick.cadence;
  }

  function renderConditions(){
    ui.conditionBox.innerHTML = '';
    const c = state.conditions;
    [['Frame',c.frame],['Source',c.source],['Uncertainty',c.uncertainty],['Cadence',c.cadence]].forEach(([k,v])=>{
      const span = document.createElement('span');
      span.className = 'cond';
      span.textContent = `${k}: ${v}`;
      ui.conditionBox.appendChild(span);
    });
  }

  async function buildItems() {
  const frame = state.conditions.frame;
  const rows = await loadRewrittenNews();
  state.items = rows.map((r, i) => {
    const title = frame === "alarming" ? r.alarming_title : r.neutral_title;
    const summary = frame === "alarming" ? r.alarming_version : r.neutral_version;
    return {
      id: "row" + i,
      title: title || "Untitled",
      summary: summary || "",
      // facts: ["From rewritten_news.csv"]
    };
  });
}

  function mkCard(item){
    const effSource = (state.conditions.source==='auto') ? rnd(SOURCES) : state.conditions.source;
    const effUnc = (state.conditions.uncertainty==='auto') ? (Math.random()<0.5) : (state.conditions.uncertainty==='on');
    const card = document.createElement('article');
    card.className = 'card';
    card.dataset.id = item.id;
    card.dataset.effSource = effSource;
    card.dataset.effUnc = String(effUnc);
    card.innerHTML = `
      <div class="meta">
        <span class="badge-pill source-${effSource}">${srcLabel(effSource)}</span>
        ${effUnc? `<span class="badge-pill uncertain">Developing · may change</span>`:''}
        <span class="badge-pill">${new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
      </div>
      <h3>${escapeHtml(item.title)}</h3>
      <p class="summary">${escapeHtml(item.summary)}</p>
      // <div class="facts">${item.facts.map(f=>`<span class="fact">${escapeHtml(f)}</span>`).join('')}</div>
    `;
    observeCard(card);
    return card;
  }

  function srcLabel(k){
    if(k==='official') return 'Official (simulated)';
    if(k==='major') return 'Major outlet (simulated)';
    if(k==='social') return 'Social post (simulated)';
    return 'Source';
  }

  const cardObs = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      const el = e.target;
      const id = el.dataset.id;
      const visible = e.isIntersecting && e.intersectionRatio>0.5;
      if(visible){
        el.dataset.enterTs = performance.now();
      }else{
        if(el.dataset.enterTs){
          const dwell = performance.now() - Number(el.dataset.enterTs);
          log('cardDwell', {card_id:id, ms:Math.round(dwell), effSource: el.dataset.effSource, effUnc: el.dataset.effUnc});
          el.dataset.enterTs = '';
        }
      }
    });
  }, {threshold: [0.5]});

  function observeCard(el){ cardObs.observe(el); }

  function escapeHtml(s){
    return s.replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;'}[m]));
  }

  function log(type, payload){
    state.logs.push({ t: nowIso(), session: state.sessionId, uid: state.userId, type, ...payload, condition: state.conditions });
    try{ localStorage.setItem('h1bLogs', JSON.stringify(state.logs)); }catch(e){}
  }

  async function startSession(){
    if(!ui.agree.checked){ alert('Please agree to continue.'); return; }
    decideConditions();
    renderConditions();
    await buildItems();
    ui.cards.innerHTML = '';
    ui.kpiCards.textContent = '0';
    ui.kpiAffect.textContent = '–';
    ui.kpiClarity.textContent = '–';
    state.affect = [];
    state.affectAsked = false;
    state.chartPoints = [];
    drawChart();
    state.shownIndex = -1;
    ui.endSession.disabled = true;
    log('sessionStart', {});
    ui.consent.style.display='none';
    ui.showDigest.disabled = false;
    ui.showNext.disabled = true; // autoplay per spec
    showNext();
    scheduleReveal(); // run for rapid/batched/auto
  }

  function cadenceDelay(){
    const mode = state.conditions.cadence;
    if(mode==='rapid') return 1500;
    if(mode==='batched') return 2500;
    // auto: random non-constant
    const min=1200, max=3200;
    return Math.floor(min + Math.random()*(max-min));
  }

  function scheduleReveal(){
    clearTimeout(state.timers.reveal);
    state.timers.reveal = setTimeout(()=>{
      showNext();
      if(state.shownIndex < state.items.length-1){
        scheduleReveal();
      }
    }, cadenceDelay());
  }

  function showNext(){
    if(state.shownIndex >= state.items.length-1){ return; }
    state.shownIndex++;
    const item = state.items[state.shownIndex];
    const el = mkCard(item);
    ui.cards.appendChild(el);
    log('cardShown', {card_id:item.id, idx: state.shownIndex, effSource: el.dataset.effSource, effUnc: el.dataset.effUnc});
    ui.kpiCards.textContent = String(state.shownIndex+1);

    // Mid-session affect after HALF of items shown
    const halfIdx = Math.floor(state.items.length/2) - 1;
    if(!state.affectAsked && state.shownIndex === halfIdx){
      queueMidAffect();
    }
  }

  function queueMidAffect(){
    if(state.affectAsked) return;
    state.affectAsked = true;
    setTimeout(()=> openAffect('midSession'), 400);
  }

  function showDigest(){
    while(state.shownIndex < state.items.length-1){
      showNext();
    }
    if(!state.affect.length){
      queueMidAffect();
    }
  }

  function openAffect(tag){
    ui.affectModal.hidden = false;
    ui.affectSlider.value = '4';
    ui.submitAffect.onclick = ()=>{
      const val = Number(ui.affectSlider.value);
      ui.affectModal.hidden = true;
      state.affect.push({cardId:tag, val});
      log('affect', {card_id:tag, val});
      const avg = state.affect.reduce((a,b)=>a+b.val,0)/state.affect.length;
      ui.kpiAffect.textContent = avg.toFixed(2);
      state.chartPoints.push(val);
      drawChart();
      ui.endSession.disabled = false;
    };
  }

  function drawChart(){
    const c = ui.chart.getContext('2d');
    c.clearRect(0,0,ui.chart.width, ui.chart.height);
    const W = ui.chart.width, H = ui.chart.height;
    c.globalAlpha = 1;
    c.strokeStyle = '#2a303b';
    c.lineWidth = 1;
    c.beginPath(); c.moveTo(36,10); c.lineTo(36,H-26); c.lineTo(W-10,H-26); c.stroke();
    c.fillStyle = '#a7adbb'; c.font = '12px system-ui';
    for(let y=1;y<=7;y++){
      const yy = map(y,1,7,H-26,14);
      c.fillText(String(y), 12, yy+4);
      c.strokeStyle = '#1d222c'; c.beginPath(); c.moveTo(36, yy); c.lineTo(W-10, yy); c.stroke();
    }
    const pts = state.chartPoints;
    if(pts.length){
      const step = (W-56) / Math.max(1, pts.length-1);
      c.strokeStyle = '#7aa2ff'; c.lineWidth = 2; c.beginPath();
      pts.forEach((v,i)=>{
        const x = 36 + i*step;
        const y = map(v,1,7,H-26,14);
        if(i===0) c.moveTo(x,y); else c.lineTo(x,y);
        c.fillStyle = '#9ab7ff'; c.beginPath(); c.arc(x,y,3,0,Math.PI*2); c.fill();
      });
      c.stroke();
    }
  }

  function map(v,a1,b1,a2,b2){ return a2 + (v-a1)*(b2-a2)/(b1-a1); }

  function endSession(){
    ui.surveyModal.hidden = false;
    log('sessionPauseForSurvey', {});
  }

  function submitSurvey(){
    const q1 = (document.querySelector('input[name="q1"]:checked')||{}).value || null;
    const trust = Number(ui.trustSlider.value);
    const actions = {
      dso: document.querySelector('#act_dso').checked,
      lawyer: document.querySelector('#act_lawyer').checked,
      wait: document.querySelector('#act_wait').checked
    };
    state.quiz.q1 = q1;
    state.trust = trust;
    state.actions = actions;
    const clarity = (q1==='B')? 100 : 0;
    ui.kpiClarity.textContent = String(clarity);
    ui.surveyModal.hidden = true;
    log('survey', {q1, trust, actions, clarity});
    ui.exportBox.style.display = 'block';
    clearTimeout(state.timers.reveal);
    log('sessionEnd', {});
  }

  function exportCsv(){
    const rows = [];
    const header = [
      't','session','uid','type','card_id','idx','val','ms',
      'effSource','effUnc',
      'condition.frame','condition.source','condition.uncertainty','condition.cadence',
      'q1','trust','act_dso','act_lawyer','act_wait','clarity'
    ];
    rows.push(header.join(','));
    state.logs.forEach(e=>{
      rows.push([
        e.t, e.session, e.uid, e.type, (e.card_id??''), (e.idx??''), (e.val??''), (e.ms??''),
        (e.effSource??''), (e.effUnc??''),
        e.condition?.frame??'', e.condition?.source??'', e.condition?.uncertainty??'', e.condition?.cadence??'',
        e.q1??'', e.trust??'', e.actions?.dso??'', e.actions?.lawyer??'', e.actions?.wait??'', e.clarity??''
      ].join(','));
    });
    const blob = new Blob([rows.join('\n')], {type:'text/csv'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `h1b_news_lab_logs_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  }

  // Wire
  ui.startBtn.addEventListener('click', startSession);
  ui.showNext.addEventListener('click', showNext);
  ui.showDigest.addEventListener('click', showDigest);
  ui.endSession.addEventListener('click', endSession);
  ui.submitSurvey.addEventListener('click', submitSurvey);
  ui.exportCsv.addEventListener('click', exportCsv);

  ['frameTone','sourceLabel','uncertaintyFlag','cadenceMode'].forEach(id=>{
    qs('#'+id).addEventListener('change', ()=>{
      log('configChange', {id, value: qs('#'+id).value});
    });
  });

  log('prototypeLoad', {});

})();