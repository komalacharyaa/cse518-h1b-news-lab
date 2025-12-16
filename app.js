// H1B News Lab — prototype (v3: participant + 5 iterations)
(function(){
  const qs = (sel, el=document)=> el.querySelector(sel);
  const rnd = arr => arr[Math.floor(Math.random()*arr.length)];
  const nowIso = ()=> new Date().toISOString();

  const ui = {
    frameTone: qs('#frameTone'),
    sourceLabel: qs('#sourceLabel'),
    uncertaintyFlag: qs('#uncertaintyFlag'),
    cadenceMode: qs('#cadenceMode'),

    consent: qs('#consent'),
    agree: qs('#agreeBox'),
    nameField: qs('#nameField'),
    roleField: qs('#roleField'),
    startBtn: qs('#startBtn'),

    webcamOptIn: qs('#webcamOptIn'),
    camVideo: qs('#cam'),
    kpiCam: qs('#kpiCam'),

    liveMeterFill: qs('#liveMeterFill'),
    liveMeterVal: qs('#liveMeterVal'),

    cards: qs('#cards'),

    endSession: qs('#endSession'),
    conditionBox: qs('#conditionBox'),

    kpiIter: qs('#kpiIter'),
    kpiCards: qs('#kpiCards'),
    kpiAffect: qs('#kpiAffect'),

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

  const SOURCES = ['official','major','social'];
  const MAX_ITERS = 3;
  const EXPORT_AFTER = 3;
  const CARDS_PER_ITER = 6;

  async function loadRewrittenNews() {
    const res = await fetch("rewritten_news.csv");
    const text = await res.text();
    const lines = text.trim().split("\n");
    const headers = lines.shift().split(",");
    const items = lines.map(line => {
      const cols = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
      const obj = {};
      headers.forEach((h,i)=> obj[h.trim()] = cols[i] ? cols[i].replace(/^"|"$/g,"") : "");
      return obj;
    });
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items.slice(0, CARDS_PER_ITER);
  }

  const state = {
    participantId: ('P'+Math.random().toString(36).slice(2)),
    participant: { name: '', role: '' },

    iter: 0,
    iterSessionId: '',
    iterStartPerf: null,
    iterStartIso: null,

    conditions: {frame:'auto', source:'auto', uncertainty:'auto', cadence:'auto'},
    items: [],
    shownIndex: -1,

    logs: [],
    chartPoints: [],

    timers: {reveal:null},
    affectAsked: false,
    lastAffect: null,

    webcam: {
      enabled: false,
      ready: false,
      modelLoaded: false,
      stream: null,
      sampleTimer: null,
      samples: [] // {t, neutral, confusion}
    },
  };

  function srcLabel(k) {
    if (k === 'official') return { label: 'uscis.gov', css: 'official' };
    if (k === 'major') return { label: 'BBC news', css: 'major' };
    if (k === 'social') return { label: 'Google news', css: 'social' };
    if (k === 'auto') {
      const options = [
        { label: 'uscis.gov', css: 'official' },
        { label: 'BBC news', css: 'major' },
        { label: 'Google news', css: 'social' }
      ];
      return options[Math.floor(Math.random() * options.length)];
    }
    return { label: 'Source', css: '' };
  }

  function escapeHtml(s){
    return String(s ?? '').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;'}[m]));
  }

  function csvSafe(x){
    const s = String(x ?? '');
    if(/[,"\n]/.test(s)) return '"' + s.replaceAll('"','""') + '"';
    return s;
  }

  // --- Webcam-based expression sensing (neutral vs confused) ---
  // This is NOT identity recognition. No video is stored; we only sample expression probabilities.
  // Proxy used: confusionScore = 1 - neutralProbability (0..1), mapped to 1..7 worry score.
  async function loadFaceModels() {
    if (state.webcam.modelLoaded) return true;
    if (typeof window.faceapi === 'undefined') {
      console.warn('face-api.js not loaded (check network or script tag).');
      return false;
    }

    // Try local first (./models), then fall back to CDN (no manual downloads needed).
    const localBase = './models';
    const cdnBase = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights';

    async function tryLoad(base) {
      await faceapi.nets.tinyFaceDetector.loadFromUri(base);
      await faceapi.nets.faceExpressionNet.loadFromUri(base);
      return true;
    }

    try {
      await tryLoad(localBase);
      state.webcam.modelLoaded = true;
      return true;
    } catch (e1) {
      console.warn('Local models not found; trying CDN weights…');
      try {
        await tryLoad(cdnBase);
        state.webcam.modelLoaded = true;
        return true;
      } catch (e2) {
        console.error('Failed to load face models (local and CDN).', e2);
        return false;
      }
    }
  }

  async function startWebcam() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      state.webcam.stream = stream;
      ui.camVideo.srcObject = stream;
      ui.camVideo.hidden = false; // show preview inside the panel
      ui.kpiCam.textContent = 'on';
      return true;
    } catch (e) {
      console.warn('Webcam permission denied or unavailable', e);
      ui.kpiCam.textContent = 'off';
    setLiveMeter(null);
      return false;
    }
  }

  function stopWebcam() {
    if (state.webcam.stream) {
      state.webcam.stream.getTracks().forEach(t => t.stop());
      state.webcam.stream = null;
    }
    ui.kpiCam.textContent = 'off';
    setLiveMeter(null);
  }

  function startSamplingExpressions() {
    stopSamplingExpressions();
    state.webcam.samples = [];
    state.webcam.sampleTimer = setInterval(async () => {
      if (!state.webcam.stream || !state.webcam.modelLoaded) return;
      try {
        const det = await faceapi
          .detectSingleFace(ui.camVideo, new faceapi.TinyFaceDetectorOptions())
          .withFaceExpressions();

        if (!det || !det.expressions) return;

        const neutral = Number(det.expressions.neutral ?? 0);
        const confusion = Math.max(0, Math.min(1, 1 - neutral));

        state.webcam.samples.push({ t: Date.now(), neutral, confusion });

        // keep last ~90 samples (~30s) max
        if (state.webcam.samples.length > 90) state.webcam.samples.shift();

        // Rolling worry estimate for the current iteration (smooth over last ~8 samples)
        const roll = state.webcam.samples.slice(-8);
        const avgConf = roll.reduce((acc, x) => acc + x.confusion, 0) / roll.length;
        const worryNow = Math.round(1 + avgConf * 6);
        setLiveMeter(worryNow);
      } catch (e) {
        // ignore intermittent errors
      }
    }, 350);
  }

  function stopSamplingExpressions() {
    if (state.webcam.sampleTimer) {
      clearInterval(state.webcam.sampleTimer);
      state.webcam.sampleTimer = null;
    }
  }

  function computeWorryFromSamples() {
    const s = state.webcam.samples;
    if (!s || s.length < 6) return null;

    // last ~10 samples (~3–4s) as "post-reading" proxy
    const tail = s.slice(-10);
    const avgConf = tail.reduce((acc, x) => acc + x.confusion, 0) / tail.length; // 0..1
    const worry = Math.round(1 + avgConf * 6); // 1..7
    return Math.max(1, Math.min(7, worry));
  }

  function setLiveMeter(worry){
    if(!ui.liveMeterFill || !ui.liveMeterVal) return;
    if(worry == null){
      ui.liveMeterVal.textContent = '–';
      ui.liveMeterFill.style.height = '0%';
      return;
    }
    const v = Math.max(1, Math.min(7, Number(worry)));
    ui.liveMeterVal.textContent = String(v);
    const pct = ((v - 1) / 6) * 100;
    ui.liveMeterFill.style.height = `${pct}%`;
  }



  function log(type, payload){
    state.logs.push({
      t: nowIso(),
      participant_id: state.participantId,
      name: state.participant.name,
      role: state.participant.role,
      iteration: state.iter + 1,
      iter_session: state.iterSessionId,
      type,
      ...payload,
      condition: {...state.conditions}
    });
    try { localStorage.setItem('h1bLogs', JSON.stringify(state.logs)); } catch(e) {}
  }

  function cadenceDelay(){
    const mode = state.conditions.cadence;
    if(mode==='rapid') return 1500;
    if(mode==='batched') return 2500;
    const min=1200, max=3200;
    return Math.floor(min + Math.random()*(max-min));
  }

  function decideConditions(){
    const autoPick = {
      frame: rnd(['neutral','alarming']),
      cadence: (ui.cadenceMode.value==='auto') ? 'auto' : ui.cadenceMode.value,
    };
    state.conditions.frame = (ui.frameTone.value==='auto') ? autoPick.frame : ui.frameTone.value;
    state.conditions.source = ui.sourceLabel.value;
    state.conditions.uncertainty = ui.uncertaintyFlag.value;
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
        title: (title || "Untitled").trim(),
        summary: (summary || "").trim(),
      };
    });
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
          log('cardDwell', {
            card_id: id,
            ms: Math.round(dwell),
            effSource: el.dataset.effSource || '',
            effUnc: el.dataset.effUnc || ''
          });
          el.dataset.enterTs = '';
        }
      }
    });
  }, {threshold: [0.5]});

  function observeCard(el){ cardObs.observe(el); }

  function mkCard(item) {
    const effSourceKey = (state.conditions.source === 'auto') ? rnd(SOURCES) : state.conditions.source;
    const src = srcLabel(effSourceKey);

    const effUnc = (state.conditions.uncertainty === 'auto')
      ? (Math.random() < 0.5)
      : (state.conditions.uncertainty === 'on');

    const card = document.createElement('article');
    card.className = 'card';
    card.dataset.id = item.id;
    card.dataset.effSource = src.css;
    card.dataset.effUnc = String(effUnc);

    card.innerHTML = `
      <div class="meta">
        <span class="badge-pill source-${src.css}">${escapeHtml(src.label)}</span>
        ${effUnc ? `<span class="badge-pill uncertain">Developing · may change</span>` : ''}
        <span class="badge-pill">${new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
      </div>
      <h3>${escapeHtml(item.title)}</h3>
      <p class="summary">${escapeHtml(item.summary)}</p>
    `;

    observeCard(card);
    return card;
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

    log('cardShown', {
      card_id: item.id,
      idx: state.shownIndex,
      effSource: el.dataset.effSource,
      effUnc: el.dataset.effUnc
    });

    ui.kpiCards.textContent = String(state.shownIndex+1);

    if(state.shownIndex === state.items.length-1){
      let worry = null;

      if (state.shownIndex === state.items.length - 1) {
        if (state.affectAsked) return;
        state.affectAsked = true;

        state.sensedWorry = null;
        if (state.webcam.enabled && state.webcam.ready) {
          const sensed = computeWorryFromSamples();
          if (sensed !== null) {
            state.sensedWorry = sensed;
            log('affect_sensed', { card_id: 'endOfReading', sensed_val: sensed, method: '1-neutral' });
          }
        }

        // allow clicking Finish now (but we’ll force affect inside endSession if needed)
        ui.endSession.disabled = false;

        setTimeout(() => openAffect('endOfReading'), 350);
      }


    }
  }

  function openAffect(tag){
  ui.affectModal.hidden = false;
  ui.affectModal.style.display = 'flex';

  ui.affectSlider.value = '4';
  ui.submitAffect.onclick = ()=>{
    const val = Number(ui.affectSlider.value);

    ui.affectModal.hidden = true;
    ui.affectModal.style.display = 'none';

    state.lastAffect = val;
    if (ui.kpiAffect) ui.kpiAffect.textContent = String(val);

    // ✅ THIS is what makes the chart update for manual slider
    state.chartPoints[state.iter] = val;
    drawChart();

    log('affect', { card_id: tag, val });

    ui.endSession.disabled = false;
  };
}

  function drawChart(){
    const c = ui.chart.getContext('2d');
    c.clearRect(0,0,ui.chart.width, ui.chart.height);
    const W = ui.chart.width, H = ui.chart.height;

    c.strokeStyle = '#2a303b';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(36,10); c.lineTo(36,H-26); c.lineTo(W-10,H-26);
    c.stroke();

    c.fillStyle = '#a7adbb';
    c.font = '12px system-ui';
    for(let y=1;y<=7;y++){
      const yy = map(y,1,7,H-26,14);
      c.fillText(String(y), 12, yy+4);
      c.strokeStyle = '#1d222c';
      c.beginPath(); c.moveTo(36, yy); c.lineTo(W-10, yy); c.stroke();
    }

    const pts = state.chartPoints
      .map((v, i) => (v == null ? null : ({ v: Number(v), i })))
      .filter(Boolean);

    if (pts.length) {
      // fixed spacing across the full 5 iterations
      const step = (W - 56) / Math.max(1, MAX_ITERS - 1);

      // 1) draw the line first
      c.strokeStyle = '#7aa2ff';
      c.lineWidth = 2;
      c.beginPath();
      pts.forEach((p, k) => {
        const x = 36 + p.i * step;
        const y = map(p.v, 1, 7, H - 26, 14);
        if (k === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      });
      c.stroke();

      // 2) then draw dots + labels (no path reset issues)
      pts.forEach((p) => {
        const x = 36 + p.i * step;
        const y = map(p.v, 1, 7, H - 26, 14);

        c.fillStyle = '#9ab7ff';
        c.beginPath();
        c.arc(x, y, 3, 0, Math.PI * 2);
        c.fill();

        c.fillStyle = '#a7adbb';
        c.font = '11px system-ui';
        c.fillText(String(p.i + 1), x - 3, H - 10);
      });
    }
  }

  function map(v,a1,b1,a2,b2){ return a2 + (v-a1)*(b2-a2)/(b1-a1); }

  function endSession(){
    if (state.lastAffect === null) {
      openAffect('forcedBeforeSurvey');
      return;
    }
    ui.surveyModal.hidden = false;
    log('sessionPauseForSurvey', {});
  }

  function computeIterDurationMs(){
    if(state.iterStartPerf === null) return null;
    return Math.round(performance.now() - state.iterStartPerf);
  }

  function maybeShowExport(){
    if(state.iter >= EXPORT_AFTER){
      ui.exportBox.style.display = 'block';
    }
  }

  function showIterationEndCard(durationMs){
    const remaining = MAX_ITERS - state.iter;
    const isDone = (state.iter >= MAX_ITERS);

    const card = document.createElement('div');
    card.className = 'iter-card';

    const durSec = (durationMs==null) ? '—' : (durationMs/1000).toFixed(1);
    const nextIter = state.iter + 1;

    if(isDone){
      card.innerHTML = `
        <h3>All iterations complete ✅</h3>
        <p>Thank you! The session is finished. You can export the cumulative log using the panel on the right.</p>
        <div class="row">
          <span class="pill">Participant: ${escapeHtml(state.participant.name)} (${escapeHtml(state.participant.role)})</span>
          <span class="pill">Iterations: ${MAX_ITERS}/${MAX_ITERS}</span>
        </div>
      `;
      ui.cards.appendChild(card);
      return;
    }

    card.innerHTML = `
      <h3>Iteration ${state.iter} complete</h3>
      <p>
        Time taken: <b>${durSec}s</b>. Please adjust the four parameters in the top bar if needed,
        then click <b>Restart</b> to begin iteration ${nextIter}.
      </p>
      <div class="row">
        <span class="pill">Participant: ${escapeHtml(state.participant.name)} (${escapeHtml(state.participant.role)})</span>
        <span class="pill">Remaining: ${remaining}</span>
        <button id="restartBtn" class="primary">Restart (Iteration ${nextIter})</button>
      </div>
    `;
    ui.cards.appendChild(card);

    const restartBtn = qs('#restartBtn', card);
    restartBtn.addEventListener('click', ()=> startIteration());
  }

  function exportCsv(){
    const rows = [];
    const header = [
      't',
      'participant_id','name','role',
      'iteration','iter_session',
      'type','card_id','idx','val','sensed_val','ms',
      'effSource','effUnc',
      'condition.frame','condition.source','condition.uncertainty','condition.cadence',
      'q1','trust','act_dso','act_lawyer','act_wait',
      'iter_duration_ms'
    ];
    rows.push(header.join(','));

    state.logs.forEach(e=>{
      rows.push([
        e.t,
        e.participant_id, csvSafe(e.name), csvSafe(e.role),
        e.iteration, e.iter_session,
        e.type, (e.card_id??''), (e.idx??''), (e.val??''), (e.sensed_val??''), (e.ms??''),
        (e.effSource??''), (e.effUnc??''),
        e.condition?.frame??'', e.condition?.source??'', e.condition?.uncertainty??'', e.condition?.cadence??'',
        (e.q1??''), (e.trust??''),
        (e.actions?.dso ?? ''),
        (e.actions?.lawyer ?? ''),
        (e.actions?.wait ?? ''),
        (e.iter_duration_ms ?? '')
      ].join(','));
    });

    const blob = new Blob([rows.join('\n')], {type:'text/csv'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `h1b_news_lab_logs_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  }

  async function startIteration(){
    if(state.iter === 0 && !state.participant.name){
      state.participant.name = (ui.nameField.value || '').trim();
      state.participant.role = ui.roleField.value;

      if(!state.participant.name){
        alert('Please enter your name.');
        return;
      }
      if(!state.participant.role){
        alert('Please select your status (F-1 / H-1B / Dependent).');
        return;
      }
      if(!ui.agree.checked){
        alert('Please agree to continue.');
        return;
      }

      state.webcam.enabled = !!ui.webcamOptIn.checked;
      log('participantInfo', { name: state.participant.name, role: state.participant.role, webcamOptIn: state.webcam.enabled });
      if (state.webcam.enabled) {
        const modelsOk = await loadFaceModels();
        const camOk = modelsOk ? await startWebcam() : false;
        state.webcam.ready = !!camOk;
        log('webcamStatus', { enabled: state.webcam.enabled, modelsOk, camOk });
      } else {
        ui.kpiCam.textContent = 'off';
    setLiveMeter(null);
      }

      ui.consent.style.display = 'none';
    }

    if(state.iter >= MAX_ITERS){
      return;
    }

    clearTimeout(state.timers.reveal);
    ui.cards.innerHTML = '';
    ui.kpiCards.textContent = '0';
    ui.endSession.disabled = true;
    state.affectAsked = false;
    state.lastAffect = null;
    setLiveMeter(null);

    decideConditions();
    renderConditions();

    state.iterSessionId = `${state.participantId}_i${state.iter+1}_${Math.random().toString(36).slice(2,7)}`;
    state.iterStartPerf = performance.now();
    state.iterStartIso = nowIso();

    ui.kpiIter.textContent = `${state.iter+1}/${MAX_ITERS}`;

    log('iterationStart', { iter_start: state.iterStartIso });

    if (state.webcam.enabled && state.webcam.ready) {
      startSamplingExpressions();
    } else {
      setLiveMeter(null);
    }


    await buildItems();
    state.shownIndex = -1;

    showNext();
    scheduleReveal();
  }

  function submitSurvey(){
    const q1 = (document.querySelector('input[name="q1"]:checked')||{}).value || null;
    const trust = Number(ui.trustSlider.value);
    const actions = {
      dso: qs('#act_dso').checked,
      lawyer: qs('#act_lawyer').checked,
      wait: qs('#act_wait').checked
    };

    ui.surveyModal.hidden = true;
    clearTimeout(state.timers.reveal);

    const durationMs = computeIterDurationMs();

    log('survey', { q1, trust, actions });
    log('iterationEnd', {
      val: state.lastAffect,                  
      sensed_val: (state.sensedWorry ?? null),
      iter_duration_ms: durationMs
    });



    // Completed count becomes (state.iter+1) after increment below
    state.iter += 1;

    maybeShowExport();

    showIterationEndCard(durationMs);

    if(state.iter >= MAX_ITERS){
      ui.exportBox.style.display = 'block';
      ui.endSession.disabled = true;
      stopSamplingExpressions();
      stopWebcam();
    }
  }

  ui.startBtn.addEventListener('click', startIteration);
  ui.endSession.addEventListener('click', endSession);
  ui.submitSurvey.addEventListener('click', submitSurvey);
  ui.exportCsv.addEventListener('click', exportCsv);

  ['frameTone','sourceLabel','uncertaintyFlag','cadenceMode'].forEach(id=>{
    qs('#'+id).addEventListener('change', ()=>{
      log('configChange', { id, value: qs('#'+id).value });
    });
  });

  ui.kpiIter.textContent = `0/${MAX_ITERS}`;
  drawChart();
  log('prototypeLoad', {});

  window.addEventListener('beforeunload', ()=>{
    stopSamplingExpressions();
    stopWebcam();
  });

})();
