# H1B News Lab (CSE 518)

A browser-based HCI prototype that studies how news presentation design (tone/framing, source labels, uncertainty cues, and delivery cadence) changes users’ worry, trust, and intended actions while reading H-1B / immigration-related updates.

This prototype runs locally as a single-page web app and supports:

* Controlled iterations (repeatable exposure → self-report loop)
* UI manipulations (tone, source label, uncertainty badges, cadence)
* Behavioral + self-report logging (exportable CSV)
* Optional webcam-based expression model (local-only, no video storage)
* Simple worry trend plotting in the UI (canvas)

## Demo Video / Live Demo Flow
1. Consent + webcam opt-in
2. Set conditions (tone/source/uncertainty/cadence)
3. Run an iteration → cards reveal sequentially
4. Submit Worry (1–7) + Trust + Action intent
5. Repeat for multiple iterations
6. Export CSV log
7. Show worry trend plot (updates across iterations)

Project Structure

```text
cse518-h1b-news-lab/
├── index.html                  # UI layout + controls + containers
├── styles.css                  # Styling for feed panel, study panel, badges, etc.
├── app.js                      # Main logic: state machine, rendering, timers, logging, plotting, expression model
├── rewritten_news.csv          # Stimuli: paired neutral/alarming versions for the same news
├── pilot_log.csv               # (If present) example output logs from pilot runs
├── news_sources.csv            # (If present) raw news collection (source links / titles / notes)
├── rewrite_tones.py            # (If present) script to generate rewritten_news.csv from raw news
├── collect_pilot_data.py       # (If present) helper script to summarize pilot logs / compute aggregates
└── models/                     # Local face-api model files (for expression detection)
    ├── tiny_face_detector_model-weights_manifest.json
    ├── tiny_face_detector_model-shard1
    ├── face_expression_model-weights_manifest.json
    └── face_expression_model-shard1
```

## How the App Works

### Iteration loop (experiment “state machine”)

Each session consists of repeated iterations:

#### Start → Reveal Cards → Affect → Survey → Restart

Inside `app.js`, one iteration does:

1. Start iteration (conditions locked for that iteration)
2. Reveal 6 cards sequentially (timer-based cadence)
3. Collect Worry (1–7) (end-of-reading)
4. Collect Trust + Action Intent
5. Log everything + update worry plot
6. Continue to next iteration (until max)

## Stimuli: `rewritten_news.csv`

The app loads the CSV and treats each row as one “story” with two tone variants:

Expected columns:

* neutral_title
* neutral_version (neutral summary text)
* alarming_title
* alarming_version (more alarming framing of the same facts)

At runtime, depending on the Framing Tone setting, the renderer picks either the neutral or alarming fields.

## Raw News → Rewritten News

### Step 1: Collect raw news

We first gathered real H-1B/visa-related news items into a “raw” sheet (often stored as `news_sources.csv`) containing:

* original headline
* source link / publisher
* short factual notes (what happened, where, when)

### Step 2: Rewrite into two tones

For each raw item, we produced:

* a neutral headline + summary (calm, factual, no speculation)
* an alarming headline + summary (emotionally loaded framing, still fact-consistent)

Key constraint: both versions must preserve the same factual content, only the framing changes.

### Step 3: Save paired results into `rewritten_news.csv`

That file becomes the single source of truth for the prototype.

#### Example rewriting prompt
Use this prompt with any LLM (OpenAI / etc.) to generate each pair:

> You are rewriting a news item into two versions with identical facts.
Input: (a) raw headline, (b) 2–4 factual bullet points, (c) source type.
Output fields:
1. neutral_title (max 12 words)
2. neutral_version (2 sentences, factual, no fear language)
3. alarming_title (max 12 words, emotionally alarming framing)
4. alarming_version (2 sentences, increases urgency/worry but adds NO new facts)
Rules: Do not invent numbers, dates, fees, agencies, or outcomes. If a fact is uncertain, keep it uncertain in BOTH versions.

### Expression Model

The prototype includes an optional expression signal to supplement self-report worry.

#### What we use
* Tiny Face Detector for face detection
* Face Expression Net for coarse expression inference

#### Where it lives
Model files are stored locally in:

```text
/models/
  tiny_face_detector_model-weights_manifest.json
  tiny_face_detector_model-shard1
  face_expression_model-weights_manifest.json
  face_expression_model-shard1
```

#### Privacy behavior
* Runs locally in the browser
* No identity recognition
* No video frames are stored
* Only a numeric summary (if enabled) is used as a supplemental “signal”

### Logging + Export (CSV)

At the end (or during the session), the app can export an event log CSV.

#### Log columns (from app.js)

The export includes:
* ts (timestamp)
* participant
* iter_session
* event
* card_id
* idx
* val
* ms
* effSource
* effUnc
* condition.frame
* condition.sourceMode
* condition.uncMode
* condition.cadence
* trust
* actions_dso
* actions_lawyer
* actions_wait

#### Typical events
* iterationStart
* cardShown
* cardDwell (if tracked)
* affect (worry)
* survey
* iterationEnd

### Plotting Worry (in the UI)
The UI includes a simple worry trend plot (canvas) that updates after each iteration to show how worry evolves across iterations.

If you want to generate paper-quality plots:

* Use exported logs (.csv)
* Aggregate by condition.frame, participant, iteration
* Plot mean worry, trust, and action intent

### Reproducing “Figures” for the Report / Slides
#### Figure ideas

* Iteration State Machine: Start → Reveal Cards → Affect → Survey → Restart
* System Dataflow: CSV stimuli → renderer → timers/badges → event log → export
* Results plots: worry by framing, action intents by framing, worry trajectories by participant

### Credits / Libraries
* face-api.js for face detection + expression inference
* Vanilla HTML/CSS/JS for UI + experiment runner
