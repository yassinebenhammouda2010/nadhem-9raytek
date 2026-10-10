(function () {
  /* ---------- Données ---------- */
  const STORAGE_KEY = "a9raa_sessions";

  function loadSessions() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  }

  function saveSessions(sessions) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }

  /* ---------- Chronomètre ---------- */
  let elapsedMs = 0;     // temps déjà accumulé
  let startTime = null;  // moment du dernier démarrage
  let interval = null;

  const display = document.getElementById("timer-display");
  const subjectInput = document.getElementById("subject");

  function currentMs() {
    return elapsedMs + (startTime ? Date.now() - startTime : 0);
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function updateDisplay() {
    const total = Math.floor(currentMs() / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    display.textContent = `${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  document.getElementById("btn-start").addEventListener("click", () => {
    if (startTime) return; // déjà en cours
    startTime = Date.now();
    interval = setInterval(updateDisplay, 1000);
  });

  document.getElementById("btn-pause").addEventListener("click", () => {
    if (!startTime) return;
    elapsedMs += Date.now() - startTime;
    startTime = null;
    clearInterval(interval);
    updateDisplay();
  });

  document.getElementById("btn-stop").addEventListener("click", () => {
    const seconds = Math.floor(currentMs() / 1000);
    if (seconds < 1) return;

    const sessions = loadSessions();
    sessions.push({
      date: new Date().toLocaleDateString("en-CA"), // AAAA-MM-JJ (heure locale)
      subject: subjectInput.value.trim() || "Sans matière",
      seconds: seconds
    });
    saveSessions(sessions);

    // Remise à zéro
    clearInterval(interval);
    startTime = null;
    elapsedMs = 0;
    updateDisplay();
    subjectInput.value = "";
    renderStats();
  });

  /* ---------- Statistiques ---------- */
  function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${pad(m)}min`;
  }

  function startOfWeek() {
    const d = new Date();
    const day = (d.getDay() + 6) % 7; // lundi = 0
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function renderStats() {
    const sessions = loadSessions();
    const today = new Date().toLocaleDateString("en-CA");
    const weekStart = startOfWeek();

    let todaySec = 0, weekSec = 0, totalSec = 0;

    sessions.forEach(s => {
      totalSec += s.seconds;
      if (s.date === today) todaySec += s.seconds;
      if (new Date(s.date + "T00:00:00") >= weekStart) weekSec += s.seconds;
    });

    document.getElementById("stat-today").textContent = formatDuration(todaySec);
    document.getElementById("stat-week").textContent = formatDuration(weekSec);
    document.getElementById("stat-total").textContent = formatDuration(totalSec);

    // 5 dernières sessions
    const list = document.getElementById("sessions-list");
    list.innerHTML = "";
    sessions.slice(-5).reverse().forEach(s => {
      const li = document.createElement("li");
      const left = document.createElement("span");
      left.textContent = `${s.subject} (${s.date})`;
      const right = document.createElement("strong");
      right.textContent = formatDuration(s.seconds);
      li.append(left, right);
      list.appendChild(li);
    });
  }

  renderStats();
})();