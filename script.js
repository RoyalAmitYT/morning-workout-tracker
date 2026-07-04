/* =========================================================
   MORNING WORKOUT TRACKER — APP LOGIC
   Vanilla JS. All state persisted to localStorage.
========================================================= */
(function () {
  "use strict";

  const STORAGE_KEY = "mwt_state_v1";
  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const DAY_NAMES_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const QUOTES = [
    "Discipline is choosing between what you want now and what you want most.",
    "The only bad workout is the one that didn't happen.",
    "Small reps, done daily, beat huge efforts done rarely.",
    "You don't have to be extreme, just consistent.",
    "Morning miles and morning reps build the whole day's confidence.",
    "Strength is a skill you practice, not a trait you're born with.",
    "The body achieves what the mind believes.",
    "Every rep is a vote for the athlete you're becoming."
  ];

  const WORKOUT_DEFS = [
    { id: "pushups",    name: "Push-ups",    icon: "💪", unit: "reps", step: 1,  baseTarget: 22 },
    { id: "pullups",    name: "Pull-ups",    icon: "🧗", unit: "reps", step: 1,  baseTarget: 5  },
    { id: "squats",     name: "Squats",      icon: "🦵", unit: "reps", step: 5,  baseTarget: 40 },
    { id: "situps",     name: "Sit-ups",     icon: "🔁", unit: "reps", step: 5,  baseTarget: 30 },
    { id: "plank",      name: "Plank",       icon: "🧘", unit: "sec",  step: 10, baseTarget: 90 },
    { id: "running",    name: "Running",     icon: "🏃", unit: "km",   step: 0.5,baseTarget: 2  },
    { id: "stretching", name: "Stretching",  icon: "🤸", unit: "min",  step: 5,  baseTarget: 10 }
  ];

  const LEVELS = [
    { name: "Beginner", min: 0 },
    { name: "Warrior",  min: 500 },
    { name: "Elite",    min: 1500 },
    { name: "Legend",   min: 3500 },
    { name: "Titan",    min: 7000 }
  ];

  const ACHIEVEMENTS = [
    { id: "first_workout", icon: "🏅", name: "First Workout", desc: "Complete your very first full workout day.",
      check: (s) => Object.values(s.history).some(d => d.allDone) },
    { id: "streak_7", icon: "🔥", name: "7-Day Streak", desc: "Keep a workout streak alive for 7 days.",
      check: (s) => computeStreaks(s).current >= 7 },
    { id: "streak_30", icon: "🏆", name: "30-Day Streak", desc: "Reach a 30-day workout streak.",
      check: (s) => computeStreaks(s).current >= 30 },
    { id: "pushups_100", icon: "💯", name: "100 Push-ups", desc: "Hit 100 push-ups in a single set.",
      check: (s) => s.push.pb >= 100 },
    { id: "pullups_20", icon: "💪", name: "20 Pull-ups", desc: "Reach 20 pull-ups in a single set.",
      check: (s) => s.pull.pb >= 20 },
    { id: "workout_beast", icon: "🚀", name: "Workout Beast", desc: "Complete 50 full workout days.",
      check: (s) => Object.values(s.history).filter(d => d.allDone).length >= 50 },
    { id: "never_miss_monday", icon: "🎖", name: "Never Miss Monday", desc: "Never miss a Monday workout.",
      check: (s) => checkNeverMissMonday(s) }
  ];

  /* ---------------------------------------------------------
     STATE
  --------------------------------------------------------- */
  function defaultState() {
    return {
      createdAt: todayStr(),
      restDays: ["Sun", "Wed"],
      history: {},           // date -> { entries:{id:{value,done}}, allDone, isRest }
      xp: 0,
      unlocked: [],
      push: { start: 22, goal: 100, totalWeeks: 20, pb: 22 },
      pull: { start: 5, goal: 20, totalWeeks: 16, pb: 5 },
      bests: { plank: 0, running: 0 },
      health: {},             // date -> {water,sleep,weight,mood,energy,notes}
      timers: {
        warmup: 300, workout: 1200, rest: 90, cooldown: 300
      },
      settings: { accent: "indigo" },
      quoteIndex: Math.floor(Math.random() * QUOTES.length)
    };
  }

  let state = loadState();

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return Object.assign(defaultState(), parsed);
    } catch (e) {
      console.warn("Failed to load state, using defaults", e);
      return defaultState();
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  /* ---------------------------------------------------------
     DATE HELPERS
  --------------------------------------------------------- */
  function todayStr(d) {
    const dt = d || new Date();
    return dt.getFullYear() + "-" + pad(dt.getMonth() + 1) + "-" + pad(dt.getDate());
  }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function daysBetween(a, b) {
    const A = new Date(a + "T00:00:00");
    const B = new Date(b + "T00:00:00");
    return Math.round((B - A) / 86400000);
  }
  function addDays(dateStr, n) {
    const d = new Date(dateStr + "T00:00:00");
    d.setDate(d.getDate() + n);
    return todayStr(d);
  }
  function dayNameOf(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    return DAY_NAMES[d.getDay()];
  }
  function startOfWeek(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    const dow = d.getDay(); // 0 Sun..6 Sat, we want Monday start
    const diff = (dow === 0 ? -6 : 1 - dow);
    d.setDate(d.getDate() + diff);
    return todayStr(d);
  }

  /* ---------------------------------------------------------
     HISTORY / DAY RECORD HELPERS
  --------------------------------------------------------- */
  function isRestDate(dateStr) {
    return state.restDays.includes(dayNameOf(dateStr));
  }

  function ensureDayRecord(dateStr) {
    if (!state.history[dateStr]) {
      const entries = {};
      WORKOUT_DEFS.forEach(w => { entries[w.id] = { value: 0, done: false, xpGiven: false }; });
      state.history[dateStr] = { entries, allDone: false, isRest: isRestDate(dateStr), bonusGiven: false };
    }
    return state.history[dateStr];
  }

  function targetFor(id, dateStr) {
    if (id === "pushups") return computeProgTarget(state.push, currentProgWeek(state.push));
    if (id === "pullups") return computeProgTarget(state.pull, currentProgWeek(state.pull));
    const def = WORKOUT_DEFS.find(w => w.id === id);
    return def.baseTarget;
  }

  function recomputeAllDone(dateStr) {
    const rec = ensureDayRecord(dateStr);
    const allDone = WORKOUT_DEFS.every(w => rec.entries[w.id].value >= targetFor(w.id, dateStr));
    rec.allDone = allDone;
    return allDone;
  }

  /* ---------------------------------------------------------
     PROGRESSION MATH
  --------------------------------------------------------- */
  function currentProgWeek(prog) {
    const days = Math.max(0, daysBetween(state.createdAt, todayStr()));
    const week = Math.floor(days / 7) + 1;
    return Math.min(Math.max(week, 1), prog.totalWeeks);
  }
  function computeProgTarget(prog, week) {
    const ratio = Math.pow(week / prog.totalWeeks, 0.85);
    const val = prog.start + (prog.goal - prog.start) * ratio;
    return Math.min(prog.goal, Math.round(val));
  }

  /* ---------------------------------------------------------
     STREAKS
  --------------------------------------------------------- */
  function computeStreaks(s) {
    // current streak: scan backward from today
    let current = 0;
    let cursor = todayStr();
    // if today isn't finished yet and isn't rest, don't count today but still check yesterday onward
    for (let i = 0; i < 3650; i++) {
      const rec = s.history[cursor];
      const rest = s.restDays.includes(dayNameOf(cursor));
      if (rest) { cursor = addDays(cursor, -1); continue; }
      if (rec && rec.allDone) { current++; cursor = addDays(cursor, -1); continue; }
      if (cursor === todayStr()) { cursor = addDays(cursor, -1); continue; } // today pending doesn't break streak yet
      break;
    }
    // longest streak: scan all recorded dates chronologically
    const dates = Object.keys(s.history).sort();
    let longest = 0, run = 0;
    if (dates.length) {
      let start = dates[0];
      let end = todayStr();
      let d = start;
      let prevCounted = false;
      while (d <= end) {
        const rest = s.restDays.includes(dayNameOf(d));
        const rec = s.history[d];
        if (rest) { /* doesn't break, doesn't add */ }
        else if (rec && rec.allDone) { run++; }
        else { run = 0; }
        if (run > longest) longest = run;
        d = addDays(d, 1);
      }
    }
    longest = Math.max(longest, current);
    return { current, longest };
  }

  function checkNeverMissMonday(s) {
    let d = s.createdAt;
    const end = todayStr();
    let found = false;
    let ok = true;
    while (d < end) {
      if (dayNameOf(d) === "Mon") {
        found = true;
        const rest = s.restDays.includes("Mon");
        const rec = s.history[d];
        if (!rest && !(rec && rec.allDone)) { ok = false; break; }
      }
      d = addDays(d, 1);
    }
    return found && ok;
  }

  /* ---------------------------------------------------------
     XP / LEVELS
  --------------------------------------------------------- */
  function getLevelInfo(xp) {
    let current = LEVELS[0], next = LEVELS[1];
    for (let i = 0; i < LEVELS.length; i++) {
      if (xp >= LEVELS[i].min) { current = LEVELS[i]; next = LEVELS[i + 1] || null; }
    }
    return { current, next };
  }

  function addXp(amount) {
    state.xp = Math.max(0, state.xp + amount);
    saveState();
  }

  /* ---------------------------------------------------------
     ACHIEVEMENTS
  --------------------------------------------------------- */
  function checkAchievements() {
    ACHIEVEMENTS.forEach(a => {
      if (!state.unlocked.includes(a.id) && a.check(state)) {
        state.unlocked.push(a.id);
        saveState();
        showAchievementPopup(a);
      }
    });
  }

  function showAchievementPopup(a) {
    const popup = document.getElementById("achievementPopup");
    document.getElementById("achBadgeIcon").textContent = a.icon;
    document.getElementById("achBadgeName").textContent = a.name;
    document.getElementById("achBadgeDesc").textContent = a.desc;
    popup.classList.add("show");
    fireConfetti();
    playBeep(880, 0.12);
    setTimeout(() => popup.classList.remove("show"), 3600);
  }

  function showToast(msg) {
    const layer = document.getElementById("toastLayer");
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    layer.appendChild(t);
    setTimeout(() => {
      t.classList.add("leaving");
      setTimeout(() => t.remove(), 400);
    }, 2600);
  }

  /* ---------------------------------------------------------
     CONFETTI
  --------------------------------------------------------- */
  const confettiCanvas = document.getElementById("confettiCanvas");
  const cctx = confettiCanvas.getContext("2d");
  function resizeCanvas() {
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  let confettiParticles = [];
  let confettiRAF = null;
  function fireConfetti() {
    const colors = ["#5B6CFF", "#00E5A0", "#FF6A3D", "#B26BFF", "#33C2FF", "#FFD166"];
    for (let i = 0; i < 90; i++) {
      confettiParticles.push({
        x: window.innerWidth / 2 + (Math.random() - 0.5) * 200,
        y: window.innerHeight * 0.25,
        vx: (Math.random() - 0.5) * 10,
        vy: Math.random() * -8 - 4,
        size: Math.random() * 6 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rot: Math.random() * 360,
        vr: (Math.random() - 0.5) * 12,
        life: 0
      });
    }
    if (!confettiRAF) confettiRAF = requestAnimationFrame(confettiTick);
  }
  function confettiTick() {
    cctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    confettiParticles.forEach(p => {
      p.vy += 0.28; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life++;
      cctx.save();
      cctx.translate(p.x, p.y);
      cctx.rotate(p.rot * Math.PI / 180);
      cctx.fillStyle = p.color;
      cctx.globalAlpha = Math.max(0, 1 - p.life / 130);
      cctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      cctx.restore();
    });
    confettiParticles = confettiParticles.filter(p => p.life < 130 && p.y < confettiCanvas.height + 40);
    if (confettiParticles.length) {
      confettiRAF = requestAnimationFrame(confettiTick);
    } else {
      cctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      confettiRAF = null;
    }
  }

  /* ---------------------------------------------------------
     SOUND (WebAudio beep, no external assets needed)
  --------------------------------------------------------- */
  let audioCtx = null;
  function playBeep(freq, duration) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = "sine";
      o.frequency.value = freq || 660;
      g.gain.value = 0.15;
      o.connect(g); g.connect(audioCtx.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + (duration || 0.3));
      o.stop(audioCtx.currentTime + (duration || 0.3) + 0.05);
    } catch (e) { /* audio unavailable */ }
  }

  /* ---------------------------------------------------------
     NAVIGATION
  --------------------------------------------------------- */
  function initNav() {
    document.querySelectorAll(".nav-item").forEach(btn => {
      btn.addEventListener("click", () => {
        const view = btn.dataset.view;
        document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
        document.getElementById("view-" + view).classList.add("active");
        document.getElementById("sidebar").classList.remove("open");
        if (view === "analytics") renderAnalytics();
        if (view === "progressions") renderProgressions();
        if (view === "goals") renderGoals();
        if (view === "achievements") renderAchievements();
        if (view === "planner") renderPlanner();
        if (view === "health") renderHealth();
        if (view === "timer") renderTimers();
        if (view === "workouts") renderWorkouts();
      });
    });
    document.getElementById("mobileNavToggle").addEventListener("click", () => {
      document.getElementById("sidebar").classList.toggle("open");
    });
  }

  /* ---------------------------------------------------------
     HERO / DASHBOARD
  --------------------------------------------------------- */
  function greetingForHour(h) {
    if (h < 5) return "Still up training, Athlete?";
    if (h < 12) return "Good morning, Athlete";
    if (h < 17) return "Good afternoon, Athlete";
    return "Good evening, Athlete";
  }

  function animateCount(el, to, suffix) {
    suffix = suffix || "";
    const from = parseFloat(el.dataset.count || "0");
    const dur = 700;
    const start = performance.now();
    function tick(now) {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = Math.round(from + (to - from) * eased);
      el.textContent = val + suffix;
      if (p < 1) requestAnimationFrame(tick);
      else el.dataset.count = to;
    }
    requestAnimationFrame(tick);
  }

  function renderClock() {
    const now = new Date();
    document.getElementById("heroTime").textContent =
      pad(now.getHours()) + ":" + pad(now.getMinutes()) + ":" + pad(now.getSeconds());
    document.getElementById("heroDay").textContent = DAY_NAMES_FULL[now.getDay()].toUpperCase().slice(0, 3);
    document.getElementById("heroDate").textContent =
      now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
    document.getElementById("heroGreeting").textContent = greetingForHour(now.getHours());
  }

  function todayProgressPct() {
    const t = todayStr();
    ensureDayRecord(t);
    const rec = state.history[t];
    let sum = 0;
    WORKOUT_DEFS.forEach(w => {
      const target = targetFor(w.id, t);
      sum += Math.min(1, rec.entries[w.id].value / target);
    });
    return Math.round((sum / WORKOUT_DEFS.length) * 100);
  }

  function setRing(el, pctEl, pct, radiusFactor) {
    const circumference = parseFloat(el.style.strokeDasharray) || (el.classList.contains ? null : null);
  }

  function updateRing(circleId, pct) {
    const circle = document.getElementById(circleId);
    const r = circle.r.baseVal.value;
    const circumference = 2 * Math.PI * r;
    circle.style.strokeDasharray = circumference;
    circle.style.strokeDashoffset = circumference * (1 - pct / 100);
  }

  function renderDashboard() {
    renderClock();
    const t = todayStr();
    ensureDayRecord(t);
    const streaks = computeStreaks(state);
    const totalWorkoutDays = Object.values(state.history).filter(d => d.allDone).length;

    animateCount(document.getElementById("statStreak"), streaks.current);
    animateCount(document.getElementById("statLongest"), streaks.longest);
    animateCount(document.getElementById("statTotal"), totalWorkoutDays);

    const weekPct = weeklyCompletionPct();
    document.getElementById("statWeekly").textContent = weekPct + "%";

    document.getElementById("heroQuote").textContent = "\u201C" + QUOTES[state.quoteIndex] + "\u201D";

    const pct = todayProgressPct();
    updateRing("dashRing", pct);
    document.getElementById("dashRingPercent").textContent = pct + "%";

    // week strip
    const strip = document.getElementById("dashWeekStrip");
    strip.innerHTML = "";
    const monday = startOfWeek(t);
    for (let i = 0; i < 7; i++) {
      const d = addDays(monday, i);
      const isToday = d === t;
      const rest = isRestDate(d);
      const rec = state.history[d];
      let icon = "⏳", status = "Pending";
      if (rest) { icon = "🌙"; status = "Rest"; }
      else if (rec && rec.allDone) { icon = "✅"; status = "Done"; }
      else if (d < t) { icon = "❌"; status = "Missed"; }
      const div = document.createElement("div");
      div.className = "week-day-mini" + (isToday ? " today" : "");
      div.innerHTML = `<span class="wd-label">${dayNameOf(d)}</span><span class="wd-icon">${icon}</span><span class="wd-label">${status}</span>`;
      strip.appendChild(div);
    }

    // level / xp
    const { current, next } = getLevelInfo(state.xp);
    document.getElementById("levelName").textContent = current.name;
    document.getElementById("levelChip").textContent = current.name;
    document.getElementById("xpMiniLabel").textContent = state.xp + " XP";
    document.getElementById("xpCurrentLabel").textContent = state.xp + " XP";
    const span = next ? (next.min - current.min) : 1;
    const progressed = next ? (state.xp - current.min) : span;
    const xpPct = next ? Math.min(100, Math.round((progressed / span) * 100)) : 100;
    document.getElementById("xpMiniFill").style.width = xpPct + "%";
    document.getElementById("dashXpFill").style.width = xpPct + "%";
    document.getElementById("xpNextLabel").textContent = next ? `${next.min - state.xp} XP to ${next.name}` : "Max level reached";

    document.getElementById("dashPushMax").textContent = state.push.pb;
    document.getElementById("dashPullMax").textContent = state.pull.pb;

    renderCalendar();
  }

  function weeklyCompletionPct() {
    const t = todayStr();
    const monday = startOfWeek(t);
    let applicable = 0, done = 0;
    for (let i = 0; i < 7; i++) {
      const d = addDays(monday, i);
      if (d > t) continue;
      if (isRestDate(d)) continue;
      applicable++;
      const rec = state.history[d];
      if (rec && rec.allDone) done++;
    }
    if (applicable === 0) return 100;
    return Math.round((done / applicable) * 100);
  }

  function renderCalendar() {
    const wrap = document.getElementById("dashCalendar");
    wrap.innerHTML = "";
    const t = todayStr();
    const totalDays = 168; // 24 weeks
    const start = addDays(t, -(totalDays - 1));
    // align to Monday start for column grouping
    const alignedStart = startOfWeek(start);
    let d = alignedStart;
    while (d <= t) {
      const rec = state.history[d];
      let level = 0;
      if (isRestDate(d) && rec && rec.allDone) level = 2;
      else if (rec) {
        const completedCount = WORKOUT_DEFS.filter(w => rec.entries[w.id].value >= targetFor(w.id, d)).length;
        if (completedCount >= 7) level = 4;
        else if (completedCount >= 5) level = 3;
        else if (completedCount >= 2) level = 2;
        else if (completedCount >= 1) level = 1;
      }
      const cell = document.createElement("div");
      cell.className = "cal-cell" + (level ? " lvl" + level : "");
      cell.title = d;
      wrap.appendChild(cell);
      d = addDays(d, 1);
    }
  }

  /* ---------------------------------------------------------
     PLANNER
  --------------------------------------------------------- */
  function renderPlanner() {
    const grid = document.getElementById("plannerGrid");
    grid.innerHTML = "";
    const t = todayStr();
    const monday = startOfWeek(t);
    for (let i = 0; i < 7; i++) {
      const d = addDays(monday, i);
      const name = dayNameOf(d);
      const rest = state.restDays.includes(name);
      const rec = state.history[d];
      let icon = "⏳", status = "Pending";
      if (rest) { icon = "🌙"; status = "Rest Day"; }
      else if (rec && rec.allDone) { icon = "✅"; status = "Completed"; }
      else if (d < t) { icon = "❌"; status = "Missed"; }
      const card = document.createElement("div");
      card.className = "card glass planner-day" + (rest ? " is-rest" : "");
      card.innerHTML = `
        <span class="pd-name">${DAY_NAMES_FULL[new Date(d + "T00:00:00").getDay()]}</span>
        <span class="pd-date">${d.slice(5)}</span>
        <span class="pd-icon">${icon}</span>
        <span class="pd-status">${status}</span>
        <button class="pd-rest-btn" data-day="${name}">${rest ? "Remove rest" : "Set as rest"}</button>
      `;
      grid.appendChild(card);
    }
    grid.querySelectorAll(".pd-rest-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const day = btn.dataset.day;
        if (state.restDays.includes(day)) {
          state.restDays = state.restDays.filter(x => x !== day);
        } else {
          if (state.restDays.length >= 2) {
            showToast("You can only pick 2 rest days. Remove one first.");
            return;
          }
          state.restDays.push(day);
        }
        saveState();
        renderPlanner();
        renderDashboard();
      });
    });
  }

  /* ---------------------------------------------------------
     WORKOUTS (today's checklist)
  --------------------------------------------------------- */
  function renderWorkouts() {
    const t = todayStr();
    ensureDayRecord(t);
    const rec = state.history[t];
    document.getElementById("workoutDateSub").textContent =
      new Date(t + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) +
      (isRestDate(t) ? " — Rest day, but light movement still counts." : "");

    const grid = document.getElementById("workoutGrid");
    grid.innerHTML = "";
    WORKOUT_DEFS.forEach(w => {
      const target = targetFor(w.id, t);
      const entry = rec.entries[w.id];
      const pct = Math.min(100, Math.round((entry.value / target) * 100));
      const done = entry.value >= target;
      const card = document.createElement("div");
      card.className = "card glass workout-card" + (done ? " done" : "");
      card.dataset.id = w.id;
      card.innerHTML = `
        <div class="wc-top">
          <div>
            <div class="wc-icon">${w.icon}</div>
            <div class="wc-name">${w.name}</div>
          </div>
          <button class="wc-checkbox ${done ? "checked" : ""}" data-action="toggle">${done ? "✓" : ""}</button>
        </div>
        <div class="wc-numbers">
          <span>Target: <b>${formatUnit(target, w.unit)}</b></span>
          <span>Remaining: <b>${formatUnit(Math.max(0, target - entry.value), w.unit)}</b></span>
        </div>
        <div class="wc-progress-track"><div class="wc-progress-fill" style="width:${pct}%"></div></div>
        <div class="wc-controls">
          <div class="wc-stepper">
            <button class="wc-step-btn" data-action="dec">−</button>
            <span class="wc-count">${formatUnit(entry.value, w.unit)}</span>
            <button class="wc-step-btn" data-action="inc">+</button>
          </div>
          <span class="chip chip-outline">${pct}%</span>
        </div>
      `;
      grid.appendChild(card);
    });

    document.getElementById("workoutsCompletedChip").textContent =
      `${WORKOUT_DEFS.filter(w => rec.entries[w.id].value >= targetFor(w.id, t)).length} / ${WORKOUT_DEFS.length} complete`;

    grid.querySelectorAll(".wc-step-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const card = e.target.closest(".workout-card");
        const id = card.dataset.id;
        const def = WORKOUT_DEFS.find(w => w.id === id);
        const entry = state.history[t].entries[id];
        const target = targetFor(id, t);
        const dir = btn.dataset.action === "inc" ? 1 : -1;
        entry.value = Math.max(0, Math.round((entry.value + dir * def.step) * 100) / 100);
        onEntryChanged(id, t);
        renderWorkouts();
        renderDashboard();
      });
    });
    grid.querySelectorAll('[data-action="toggle"]').forEach(btn => {
      btn.addEventListener("click", (e) => {
        const card = e.target.closest(".workout-card");
        const id = card.dataset.id;
        const entry = state.history[t].entries[id];
        const target = targetFor(id, t);
        entry.value = entry.value >= target ? 0 : target;
        onEntryChanged(id, t);
        card.classList.add("pulse");
        setTimeout(() => card.classList.remove("pulse"), 500);
        renderWorkouts();
        renderDashboard();
      });
    });
  }

  function formatUnit(val, unit) {
    if (unit === "km") return val + " km";
    if (unit === "sec") return val + "s";
    if (unit === "min") return val + "m";
    return "" + val;
  }

  function onEntryChanged(id, dateStr) {
    const rec = state.history[dateStr];
    const entry = rec.entries[id];
    const target = targetFor(id, dateStr);

    // update personal bests
    if (id === "pushups" && entry.value > state.push.pb) state.push.pb = entry.value;
    if (id === "pullups" && entry.value > state.pull.pb) state.pull.pb = entry.value;
    if (id === "plank" && entry.value > state.bests.plank) state.bests.plank = entry.value;
    if (id === "running" && entry.value > state.bests.running) state.bests.running = entry.value;

    // XP award/removal on crossing target threshold
    const nowDone = entry.value >= target;
    if (nowDone && !entry.xpGiven) { addXp(10); entry.xpGiven = true; }
    if (!nowDone && entry.xpGiven) { addXp(-10); entry.xpGiven = false; }

    const wasAllDone = rec.allDone;
    const allDone = recomputeAllDone(dateStr);
    if (allDone && !rec.bonusGiven) {
      addXp(50);
      rec.bonusGiven = true;
      if (dateStr === todayStr()) {
        fireConfetti();
        playBeep(660, 0.15);
        showToast("Workout complete! +50 XP bonus 🎉");
      }
    }
    if (!allDone && rec.bonusGiven) {
      addXp(-50);
      rec.bonusGiven = false;
    }
    saveState();
    checkAchievements();
  }

  /* ---------------------------------------------------------
     PROGRESSIONS
  --------------------------------------------------------- */
  function renderProgTrack(containerId, prog) {
    const el = document.getElementById(containerId);
    el.innerHTML = "";
    const week = currentProgWeek(prog);
    for (let w = 1; w <= prog.totalWeeks; w++) {
      const target = computeProgTarget(prog, w);
      const pctHeight = Math.max(6, Math.round((target / prog.goal) * 52));
      const bar = document.createElement("div");
      bar.className = "prog-week-bar" + (w === week ? " current" : "");
      bar.innerHTML = `<div class="bar" style="height:${pctHeight}px"></div><span class="bar-lbl">${w}</span>`;
      bar.title = `Week ${w}: ${target}`;
      el.appendChild(bar);
    }
  }

  function renderProgressions() {
    const t = todayStr();
    // push
    const pw = currentProgWeek(state.push);
    const pTarget = computeProgTarget(state.push, pw);
    document.getElementById("pushWeek").textContent = pw;
    document.getElementById("pushCurrentMax").textContent = state.push.pb;
    document.getElementById("pushTodayTarget").textContent = pTarget;
    document.getElementById("pushPB").textContent = state.push.pb;
    document.getElementById("pushWeeksLeft").textContent = Math.max(0, state.push.totalWeeks - pw);
    const pushPct = Math.min(100, Math.round((state.push.pb / state.push.goal) * 100));
    updateRing("pushRing", pushPct);
    document.getElementById("pushRingPct").textContent = pushPct + "%";
    renderProgTrack("pushTrack", state.push);

    // pull
    const plw = currentProgWeek(state.pull);
    const plTarget = computeProgTarget(state.pull, plw);
    document.getElementById("pullWeek").textContent = plw;
    document.getElementById("pullCurrentMax").textContent = state.pull.pb;
    document.getElementById("pullTodayTarget").textContent = plTarget;
    document.getElementById("pullPB").textContent = state.pull.pb;
    document.getElementById("pullWeeksLeft").textContent = Math.max(0, state.pull.totalWeeks - plw);
    const pullPct = Math.min(100, Math.round((state.pull.pb / state.pull.goal) * 100));
    updateRing("pullRing", pullPct);
    document.getElementById("pullRingPct").textContent = pullPct + "%";
    renderProgTrack("pullTrack", state.pull);
  }

  /* ---------------------------------------------------------
     ANALYTICS
  --------------------------------------------------------- */
  function renderAnalytics() {
    const streaks = computeStreaks(state);
    const days = Object.values(state.history);
    const totalDays = days.filter(d => d.allDone).length;

    document.getElementById("anStreak").textContent = streaks.current;
    document.getElementById("anLongest").textContent = streaks.longest;
    document.getElementById("anDays").textContent = totalDays;
    document.getElementById("anXp").textContent = state.xp;

    const totals = { pushups: 0, pullups: 0, squats: 0, situps: 0 };
    Object.entries(state.history).forEach(([date, rec]) => {
      Object.keys(totals).forEach(k => { totals[k] += rec.entries[k] ? rec.entries[k].value : 0; });
    });
    document.getElementById("anPush").textContent = totals.pushups;
    document.getElementById("anPull").textContent = totals.pullups;
    document.getElementById("anSquat").textContent = totals.squats;
    document.getElementById("anSitup").textContent = totals.situps;

    // weekly bar chart: last 7 days completion %
    const weekChart = document.getElementById("weeklyBarChart");
    weekChart.innerHTML = "";
    const t = todayStr();
    for (let i = 6; i >= 0; i--) {
      const d = addDays(t, -i);
      const rec = state.history[d];
      let pct = 0;
      if (isRestDate(d)) pct = 100;
      else if (rec) {
        const c = WORKOUT_DEFS.filter(w => rec.entries[w.id].value >= targetFor(w.id, d)).length;
        pct = Math.round((c / WORKOUT_DEFS.length) * 100);
      }
      const col = document.createElement("div");
      col.className = "bar-col";
      col.innerHTML = `<div class="bar-fill" style="height:${Math.max(4, pct)}%"></div><span class="bar-name">${dayNameOf(d)}</span>`;
      weekChart.appendChild(col);
    }

    // monthly chart: last 6 months completion count
    const monthChart = document.getElementById("monthlyBarChart");
    monthChart.innerHTML = "";
    const now = new Date();
    for (let m = 5; m >= 0; m--) {
      const dt = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const label = dt.toLocaleDateString(undefined, { month: "short" });
      let count = 0, maxDays = 0;
      Object.entries(state.history).forEach(([date, rec]) => {
        const rd = new Date(date + "T00:00:00");
        if (rd.getFullYear() === dt.getFullYear() && rd.getMonth() === dt.getMonth()) {
          maxDays++;
          if (rec.allDone) count++;
        }
      });
      const pct = maxDays ? Math.round((count / maxDays) * 100) : 0;
      const col = document.createElement("div");
      col.className = "bar-col";
      col.innerHTML = `<div class="bar-fill" style="height:${Math.max(4, pct)}%"></div><span class="bar-name">${label}</span>`;
      monthChart.appendChild(col);
    }

    // history list
    const list = document.getElementById("historyList");
    list.innerHTML = "";
    const dates = Object.keys(state.history).sort().reverse().slice(0, 30);
    if (!dates.length) {
      list.innerHTML = `<p style="color:var(--text-tertiary);font-size:13px;">No workouts logged yet — get started today.</p>`;
    }
    dates.forEach(d => {
      const rec = state.history[d];
      const rest = isRestDate(d);
      const tagClass = rest ? "rest" : rec.allDone ? "full" : "partial";
      const tagText = rest ? "Rest day" : rec.allDone ? "Completed" : "Partial";
      const row = document.createElement("div");
      row.className = "history-row";
      row.innerHTML = `<span class="hr-date">${d}</span><span class="hr-tag ${tagClass}">${tagText}</span>`;
      list.appendChild(row);
    });
  }

  /* ---------------------------------------------------------
     ACHIEVEMENTS VIEW
  --------------------------------------------------------- */
  function renderAchievements() {
    const grid = document.getElementById("badgeGrid");
    grid.innerHTML = "";
    ACHIEVEMENTS.forEach(a => {
      const unlocked = state.unlocked.includes(a.id);
      const div = document.createElement("div");
      div.className = "card glass badge-card" + (unlocked ? " unlocked" : "");
      div.innerHTML = `
        <div class="badge-icon">${a.icon}</div>
        <div class="badge-name">${a.name}</div>
        <div class="badge-desc">${a.desc}</div>
        <span class="badge-status">${unlocked ? "Unlocked" : "Locked"}</span>
      `;
      grid.appendChild(div);
    });
  }

  /* ---------------------------------------------------------
     GOALS
  --------------------------------------------------------- */
  function renderGoals() {
    const grid = document.getElementById("goalsGrid");
    grid.innerHTML = "";
    const items = [
      { icon: "💪", name: "100 Push-ups", current: state.push.pb, target: 100 },
      { icon: "🧗", name: "20 Pull-ups", current: state.pull.pb, target: 20 },
      { icon: "🧘", name: "3-Minute Plank", current: state.bests.plank, target: 180, unit: "sec" },
      { icon: "🏃", name: "5 KM Running", current: state.bests.running, target: 5, unit: "km" }
    ];
    items.forEach(g => {
      const pct = Math.min(100, Math.round((g.current / g.target) * 100));
      const remaining = Math.max(0, g.target - g.current);
      const div = document.createElement("div");
      div.className = "card glass goal-card";
      div.innerHTML = `
        <div class="goal-icon">${g.icon}</div>
        <div class="goal-name">${g.name}</div>
        <div class="wc-progress-track"><div class="wc-progress-fill" style="width:${pct}%"></div></div>
        <div class="goal-numbers"><span>Current: <b>${g.current}${g.unit === "sec" ? "s" : g.unit === "km" ? "km" : ""}</b></span><span>Remaining: <b>${remaining}</b></span></div>
        <div class="goal-pct">${pct}%</div>
      `;
      grid.appendChild(div);
    });
  }

  /* ---------------------------------------------------------
     HEALTH
  --------------------------------------------------------- */
  function ensureHealthRecord(dateStr) {
    if (!state.health[dateStr]) {
      state.health[dateStr] = { water: 0, sleep: 7, weight: "", mood: 0, energy: 3, notes: "" };
    }
    return state.health[dateStr];
  }

  function renderHealth() {
    const t = todayStr();
    const h = ensureHealthRecord(t);

    const waterRow = document.getElementById("waterRow");
    waterRow.innerHTML = "";
    for (let i = 1; i <= 8; i++) {
      const drop = document.createElement("button");
      drop.className = "water-drop" + (i <= h.water ? " filled" : "");
      drop.textContent = "💧";
      drop.addEventListener("click", () => {
        h.water = (h.water === i) ? i - 1 : i;
        saveState();
        renderHealth();
      });
      waterRow.appendChild(drop);
    }
    document.getElementById("waterLabel").textContent = `${h.water} / 8 cups`;

    const sleepSlider = document.getElementById("sleepSlider");
    sleepSlider.value = h.sleep;
    document.getElementById("sleepLabel").textContent = `${h.sleep} h`;
    sleepSlider.oninput = () => {
      h.sleep = parseFloat(sleepSlider.value);
      document.getElementById("sleepLabel").textContent = `${h.sleep} h`;
      saveState();
    };

    const weightInput = document.getElementById("weightInput");
    weightInput.value = h.weight;
    weightInput.oninput = () => { h.weight = weightInput.value; saveState(); };

    const moodPicker = document.getElementById("moodPicker");
    moodPicker.querySelectorAll("button").forEach(btn => {
      btn.classList.toggle("active", parseInt(btn.dataset.val) === h.mood);
      btn.onclick = () => { h.mood = parseInt(btn.dataset.val); saveState(); renderHealth(); };
    });

    const energySlider = document.getElementById("energySlider");
    energySlider.value = h.energy;
    document.getElementById("energyLabel").textContent = `Level ${h.energy}`;
    energySlider.oninput = () => {
      h.energy = parseInt(energySlider.value);
      document.getElementById("energyLabel").textContent = `Level ${h.energy}`;
      saveState();
    };

    const notesInput = document.getElementById("notesInput");
    notesInput.value = h.notes;
    let notesTimeout;
    notesInput.oninput = () => {
      clearTimeout(notesTimeout);
      notesTimeout = setTimeout(() => { h.notes = notesInput.value; saveState(); }, 400);
    };
  }

  /* ---------------------------------------------------------
     TIMERS
  --------------------------------------------------------- */
  const TIMER_DEFS = [
    { id: "warmup", name: "Warm-up Timer", icon: "🔆" },
    { id: "workout", name: "Workout Timer", icon: "⏱" },
    { id: "rest", name: "Rest Timer", icon: "😮‍💨" },
    { id: "cooldown", name: "Cooldown Timer", icon: "❄️" }
  ];
  const timerRuntime = {}; // id -> { remaining, running, intervalId }

  function formatTime(sec) {
    sec = Math.max(0, Math.round(sec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return pad(m) + ":" + pad(s);
  }

  function renderTimers() {
    const grid = document.getElementById("timerGrid");
    grid.innerHTML = "";
    TIMER_DEFS.forEach(def => {
      if (!timerRuntime[def.id]) {
        timerRuntime[def.id] = { remaining: state.timers[def.id], running: false, intervalId: null };
      }
      const rt = timerRuntime[def.id];
      const card = document.createElement("div");
      card.className = "card glass timer-card" + (rt.running ? " running" : "");
      card.dataset.id = def.id;
      const mins = Math.floor(state.timers[def.id] / 60);
      const secs = state.timers[def.id] % 60;
      card.innerHTML = `
        <div class="wc-icon">${def.icon}</div>
        <div class="timer-name">${def.name}</div>
        <div class="timer-display" data-role="display">${formatTime(rt.remaining)}</div>
        <div class="timer-input-row">
          <input type="number" min="0" max="99" data-role="mins" value="${mins}" ${rt.running ? "disabled" : ""}> m
          <input type="number" min="0" max="59" data-role="secs" value="${secs}" ${rt.running ? "disabled" : ""}> s
        </div>
        <div class="timer-controls">
          <button class="timer-btn primary" data-action="startpause">${rt.running ? "Pause" : "Start"}</button>
          <button class="timer-btn" data-action="reset">Reset</button>
        </div>
      `;
      grid.appendChild(card);

      card.querySelector('[data-action="startpause"]').addEventListener("click", () => toggleTimer(def.id));
      card.querySelector('[data-action="reset"]').addEventListener("click", () => resetTimer(def.id));
      card.querySelector('[data-role="mins"]').addEventListener("change", (e) => {
        const secsInput = card.querySelector('[data-role="secs"]');
        state.timers[def.id] = Math.max(0, parseInt(e.target.value) || 0) * 60 + parseInt(secsInput.value || 0);
        timerRuntime[def.id].remaining = state.timers[def.id];
        saveState();
        updateTimerDisplay(def.id);
      });
      card.querySelector('[data-role="secs"]').addEventListener("change", (e) => {
        const minsInput = card.querySelector('[data-role="mins"]');
        state.timers[def.id] = Math.max(0, parseInt(minsInput.value) || 0) * 60 + Math.min(59, parseInt(e.target.value) || 0);
        timerRuntime[def.id].remaining = state.timers[def.id];
        saveState();
        updateTimerDisplay(def.id);
      });
    });
  }

  function updateTimerDisplay(id) {
    const card = document.querySelector(`.timer-card[data-id="${id}"]`);
    if (!card) return;
    card.querySelector('[data-role="display"]').textContent = formatTime(timerRuntime[id].remaining);
  }

  function toggleTimer(id) {
    const rt = timerRuntime[id];
    if (rt.running) {
      clearInterval(rt.intervalId);
      rt.running = false;
    } else {
      rt.running = true;
      rt.intervalId = setInterval(() => {
        rt.remaining -= 1;
        updateTimerDisplay(id);
        if (rt.remaining <= 0) {
          clearInterval(rt.intervalId);
          rt.running = false;
          playBeep(720, 0.5);
          showToast(`${TIMER_DEFS.find(d => d.id === id).name} finished!`);
          rt.remaining = state.timers[id];
          renderTimers();
        }
      }, 1000);
    }
    renderTimers();
  }

  function resetTimer(id) {
    const rt = timerRuntime[id];
    clearInterval(rt.intervalId);
    rt.running = false;
    rt.remaining = state.timers[id];
    renderTimers();
  }

  /* ---------------------------------------------------------
     SETTINGS
  --------------------------------------------------------- */
  function initSettings() {
    document.querySelectorAll("#accentPicker button").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("#accentPicker button").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        state.settings.accent = btn.dataset.accent;
        applyAccent();
        saveState();
      });
    });

    document.getElementById("exportBtn").addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `morning-workout-backup-${todayStr()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("Backup exported.");
    });

    document.getElementById("importFile").addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const imported = JSON.parse(reader.result);
          state = Object.assign(defaultState(), imported);
          saveState();
          applyAccent();
          renderAll();
          showToast("Backup imported successfully.");
        } catch (err) {
          showToast("That file couldn't be read. Try a different backup.");
        }
      };
      reader.readAsText(file);
    });

    document.getElementById("resetBtn").addEventListener("click", () => {
      if (confirm("This will permanently erase all workout data, streaks, and achievements. Continue?")) {
        localStorage.removeItem(STORAGE_KEY);
        state = defaultState();
        saveState();
        applyAccent();
        renderAll();
        showToast("All data has been reset.");
      }
    });

    const accentBtn = document.querySelector(`#accentPicker button[data-accent="${state.settings.accent}"]`);
    if (accentBtn) {
      document.querySelectorAll("#accentPicker button").forEach(b => b.classList.remove("active"));
      accentBtn.classList.add("active");
    }
  }

  function applyAccent() {
    document.body.setAttribute("data-accent", state.settings.accent);
  }

  /* ---------------------------------------------------------
     START WORKOUT BUTTON + RIPPLE
  --------------------------------------------------------- */
  function initHeroButton() {
    const btn = document.getElementById("startWorkoutBtn");
    btn.addEventListener("click", (e) => {
      const rect = btn.getBoundingClientRect();
      const ripple = document.createElement("span");
      ripple.className = "ripple";
      ripple.style.left = (e.clientX - rect.left) + "px";
      ripple.style.top = (e.clientY - rect.top) + "px";
      ripple.style.width = ripple.style.height = "10px";
      btn.appendChild(ripple);
      setTimeout(() => ripple.remove(), 650);

      document.querySelector('.nav-item[data-view="workouts"]').click();
    });
  }

  /* ---------------------------------------------------------
     GLOBAL RENDER
  --------------------------------------------------------- */
  function renderAll() {
    ensureDayRecord(todayStr());
    renderDashboard();
    renderPlanner();
    renderWorkouts();
    renderProgressions();
    renderAnalytics();
    renderAchievements();
    renderGoals();
    renderHealth();
    renderTimers();
  }

  /* ---------------------------------------------------------
     INIT
  --------------------------------------------------------- */
  function init() {
    applyAccent();
    initNav();
    initSettings();
    initHeroButton();
    renderAll();
    checkAchievements();

    setInterval(renderClock, 1000);
    setInterval(() => {
      // keep dashboard progress/streak fresh if date rolls over
      if (document.getElementById("view-dashboard").classList.contains("active")) renderDashboard();
    }, 30000);

    setTimeout(() => {
      document.getElementById("loader").classList.add("hidden");
    }, 500);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
