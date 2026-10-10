(function () {
  "use strict";

  /* ---------- Configuration ---------- */
  const HOUR_H = 44; // hauteur d'une heure (px)
  const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  const JOURS_LONGS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

  const CATEGORIES = {
    ecole:    { nom: "École",              emoji: "🏫", color: "#3f6fa0" },
    bac:      { nom: "Bac Français",       emoji: "📖", color: "#b4536a" },
    sport:    { nom: "Sport",              emoji: "🏃", color: "#cf7418" },
    cours:    { nom: "Cours particuliers", emoji: "🎓", color: "#7a5aa6" },
    revision: { nom: "Révision",           emoji: "✏️", color: "#2e9d74" }
  };

  const KEY_HOURS = "a9raa_table_hours";
  const KEY_CELLS = "a9raa_table_cells";

  /* ---------- Outils ---------- */
  const $ = id => document.getElementById(id);

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  /* ---------- Données ---------- */
  // hours[jour] = { start: 8, end: 22 }  (heures entières, fin exclue)
  // cells["couche-jour-heure"] = { cat: "sport", text: "Football" }
  //   couche : "T" = chaque semaine, "A" = semaine A, "B" = semaine B
  function defaultHours() {
    return JOURS.map(() => ({ start: 8, end: 22 }));
  }

  function loadHours() {
    try {
      const h = JSON.parse(localStorage.getItem(KEY_HOURS));
      if (Array.isArray(h) && h.length === 7) return h;
    } catch (err) {}
    return defaultHours();
  }

  function loadCells() {
    try {
      const c = JSON.parse(localStorage.getItem(KEY_CELLS));
      if (c && typeof c === "object" && !Array.isArray(c)) {
        const out = {};
        Object.entries(c).forEach(([k, v]) => {
          // anciennes cases ("jour-heure") = chaque semaine
          out[/^\d-\d+$/.test(k) ? "T-" + k : k] = v;
        });
        return out;
      }
    } catch (err) {}
    return {};
  }

  let hours = loadHours();
  let cells = loadCells();

  const saveHours = () => localStorage.setItem(KEY_HOURS, JSON.stringify(hours));
  const saveCells = () => localStorage.setItem(KEY_CELLS, JSON.stringify(cells));

  // Contenu d'une case pour une semaine donnée ("A" ou "B")
  // (la couche A/B l'emporte sur "chaque semaine")
  function getCell(d, h, week) {
    let found = null;
    const own = cells[`${week}-${d}-${h}`];
    if (own) {
      found = own.empty ? null : { ...own, layer: week };
    } else {
      const all = cells[`T-${d}-${h}`];
      if (all) found = { ...all, layer: "T" };
    }
    return found && CATEGORIES[found.cat] ? found : null;
  }

  // Deux contenus identiques ? (vide = vide)
  function sameCell(a, b) {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return a.cat === b.cat && a.text === b.text;
  }

  /* ---------- Affichage du tableau ---------- */
  function addZone(col, top, height) {
    const z = el("div", "zone-off");
    z.style.top = top + "px";
    z.style.height = height + "px";
    col.appendChild(z);
  }

  // Calcule les blocs d'un jour : heures successives identiques = un seul bloc
  function computeBlocks(d) {
    const s = hours[d];
    const state = {};
    for (let h = s.start; h < s.end; h++) {
      const a = getCell(d, h, "A");
      const b = getCell(d, h, "B");
      state[h] = { a, b, full: sameCell(a, b) };
    }

    const blocks = [];

    // Blocs entiers (même chose les deux semaines)
    let i = s.start;
    while (i < s.end) {
      const st = state[i];
      if (st.full && st.a) {
        let j = i + 1;
        while (j < s.end && state[j].full && state[j].a && sameCell(state[j].a, st.a)) j++;
        blocks.push({ side: "full", from: i, to: j, cell: st.a });
        i = j;
      } else {
        i++;
      }
    }

    // Demi-blocs (A à gauche, B à droite)
    ["A", "B"].forEach(side => {
      let k = s.start;
      while (k < s.end) {
        const st = state[k];
        const c = side === "A" ? st.a : st.b;
        if (!st.full && c) {
          let j = k + 1;
          while (j < s.end && !state[j].full) {
            const c2 = side === "A" ? state[j].a : state[j].b;
            if (!(c2 && sameCell(c2, c))) break;
            j++;
          }
          blocks.push({ side, from: k, to: j, cell: c });
          k = j;
        } else {
          k++;
        }
      }
    });

    return blocks;
  }

  function makeBlock(b, minH) {
    const c = CATEGORIES[b.cell.cat];
    const node = el("div", "block " + b.side);
    node.style.top = (b.from - minH) * HOUR_H + "px";
    node.style.height = (b.to - b.from) * HOUR_H + "px";
    node.style.background = c.color;
    node.title = b.cell.text || c.nom;

    node.appendChild(el("strong", null, `${c.emoji} ${b.cell.text || c.nom}`));
    if (b.side === "full") {
      node.appendChild(el("small", null, `${b.from}h – ${b.to}h`));
    } else {
      node.appendChild(el("span", "badge", b.side));
    }
    return node;
  }

  function render() {
    const grid = $("plan-grid");
    grid.innerHTML = "";
    grid.style.setProperty("--hour", HOUR_H + "px");

    // Lignes affichées : de la plus petite heure de début à la plus grande heure de fin
    let minH = 24, maxH = 0;
    hours.forEach(s => {
      minH = Math.min(minH, s.start);
      maxH = Math.max(maxH, s.end);
    });
    const totalH = (maxH - minH) * HOUR_H;
    const todayIdx = (new Date().getDay() + 6) % 7; // lundi = 0

    // En-tête (jours)
    const head = el("div", "plan-head");
    head.appendChild(el("div", "corner"));
    JOURS_LONGS.forEach((nom, i) => {
      head.appendChild(el("div", "day-head" + (i === todayIdx ? " today" : ""), nom));
    });

    // Corps
    const body = el("div", "plan-body");

    const timeCol = el("div", "time-col");
    for (let h = minH; h < maxH; h++) {
      timeCol.appendChild(el("div", "hour-label", `${h}h – ${h + 1}h`));
    }
    body.appendChild(timeCol);

    hours.forEach((s, d) => {
      const col = el("div", "day-col" + (d === todayIdx ? " today" : ""));
      col.style.height = totalH + "px";

      // Zones hors horaires
      if (s.start > minH) addZone(col, 0, (s.start - minH) * HOUR_H);
      if (s.end < maxH) addZone(col, (s.end - minH) * HOUR_H, (maxH - s.end) * HOUR_H);

      // Blocs
      computeBlocks(d).forEach(b => col.appendChild(makeBlock(b, minH)));

      // Appui sur une case (ou sur un bloc)
      col.addEventListener("click", evt => {
        const rect = col.getBoundingClientRect();
        const h = minH + Math.floor((evt.clientY - rect.top) / HOUR_H);
        if (h < s.start || h >= s.end) return; // hors des horaires de ce jour
        openCell(d, h);
      });

      body.appendChild(col);
    });

    grid.append(head, body);
    renderLegend();
  }

  // Total d'heures par catégorie (semaine A et semaine B)
  function renderLegend() {
    const totA = {}, totB = {};
    Object.keys(CATEGORIES).forEach(k => { totA[k] = 0; totB[k] = 0; });

    for (let d = 0; d < 7; d++) {
      for (let h = hours[d].start; h < hours[d].end; h++) {
        const a = getCell(d, h, "A");
        const b = getCell(d, h, "B");
        if (a) totA[a.cat]++;
        if (b) totB[b.cat]++;
      }
    }

    const legend = $("plan-legend");
    legend.innerHTML = "";
    Object.entries(CATEGORIES).forEach(([k, c]) => {
      const chip = el("span", "chip");
      const dot = el("i");
      dot.style.background = c.color;
      const total = totA[k] === totB[k]
        ? `${totA[k]}h`
        : `A ${totA[k]}h · B ${totB[k]}h`;
      chip.append(dot, `${c.emoji} ${c.nom} `, el("b", null, total));
      legend.appendChild(chip);
    });
  }

  /* ---------- Fenêtre : remplir une case ---------- */
  let cellCtx = null;               // { day, hour }
  let mode = "same";                // "same" = pareil chaque semaine, "diff" = A différent de B
  let catSame = "revision";         // catégorie en mode "same"
  let catA = "revision";            // catégorie semaine A (null = rien)
  let catB = null;                  // catégorie semaine B (null = rien)
  let selectedDays = new Set();

  // Boutons de catégories (allowNone : ajoute le choix « Rien »)
  function buildPicker(boxId, current, onPick, allowNone) {
    const box = $(boxId);
    box.innerHTML = "";

    if (allowNone) {
      const none = el("button", "cat-btn" + (current === null ? " selected" : ""), "🚫 Rien");
      none.type = "button";
      none.style.setProperty("--c", "#6b7f76");
      none.addEventListener("click", () => onPick(null));
      box.appendChild(none);
    }

    Object.entries(CATEGORIES).forEach(([k, c]) => {
      const b = el("button", "cat-btn" + (k === current ? " selected" : ""), `${c.emoji} ${c.nom}`);
      b.type = "button";
      b.style.setProperty("--c", c.color);
      b.addEventListener("click", () => onPick(k));
      box.appendChild(b);
    });
  }

  function buildPickers() {
    buildPicker("cat-picker-same", catSame, k => { catSame = k; buildPickers(); }, false);
    buildPicker("cat-picker-A", catA, k => { catA = k; buildPickers(); }, true);
    buildPicker("cat-picker-B", catB, k => { catB = k; buildPickers(); }, true);
  }

  function buildModePicker() {
    const box = $("mode-picker");
    box.innerHTML = "";
    [
      ["same", "Pareil chaque semaine"],
      ["diff", "Semaine A ≠ semaine B (moitié-moitié)"]
    ].forEach(([k, label]) => {
      const b = el("button", "day-btn" + (k === mode ? " selected" : ""), label);
      b.type = "button";
      b.addEventListener("click", () => setMode(k));
      box.appendChild(b);
    });
  }

  function buildDayPicker() {
    const box = $("day-picker");
    box.innerHTML = "";

    JOURS.forEach((nom, i) => {
      const b = el("button", "day-btn" + (selectedDays.has(i) ? " selected" : ""), nom);
      b.type = "button";
      b.addEventListener("click", () => {
        if (selectedDays.has(i)) selectedDays.delete(i);
        else selectedDays.add(i);
        buildDayPicker();
      });
      box.appendChild(b);
    });

    const quick = (label, list) => {
      const b = el("button", "day-btn quick", label);
      b.type = "button";
      b.addEventListener("click", () => { selectedDays = new Set(list); buildDayPicker(); });
      box.appendChild(b);
    };
    quick("Lun–Ven", [0, 1, 2, 3, 4]);
    quick("Tous", [0, 1, 2, 3, 4, 5, 6]);
  }

  function refreshModal() {
    buildModePicker();
    buildPickers();
    $("panel-same").hidden = mode !== "same";
    $("panel-diff").hidden = mode !== "diff";
  }

  // Passer d'un mode à l'autre en gardant ce qui a déjà été choisi
  function setMode(m) {
    if (m === mode) return;
    if (m === "diff") {
      catA = catSame;
      catB = catSame;
      $("text-A").value = $("text-same").value;
      $("text-B").value = $("text-same").value;
    } else {
      catSame = catA || catB || catSame;
      $("text-same").value = $("text-A").value || $("text-B").value;
    }
    mode = m;
    refreshModal();
  }

  function openCell(day, hour) {
    cellCtx = { day, hour };

    const a = getCell(day, hour, "A");
    const b = getCell(day, hour, "B");

    if (sameCell(a, b)) {
      // Case entière (ou vide)
      mode = "same";
      catSame = a ? a.cat : "revision";
      catA = catSame;
      catB = catSame;
      const t = a ? a.text : "";
      $("text-same").value = t;
      $("text-A").value = t;
      $("text-B").value = t;
    } else {
      // Case déjà divisée en deux
      mode = "diff";
      catA = a ? a.cat : null;
      catB = b ? b.cat : null;
      $("text-A").value = a ? a.text : "";
      $("text-B").value = b ? b.text : "";
      const any = a || b;
      catSame = any.cat;
      $("text-same").value = any.text;
    }

    $("cell-title").textContent = `${JOURS_LONGS[day]} · ${hour}h`;
    $("cell-error").textContent = "";

    // "Jusqu'à" : de l'heure suivante jusqu'à la fin de ce jour
    const until = $("cell-until");
    until.innerHTML = "";
    for (let h = hour + 1; h <= hours[day].end; h++) {
      const o = document.createElement("option");
      o.value = h;
      o.textContent = `${h}h`;
      until.appendChild(o);
    }
    until.value = hour + 1;

    selectedDays = new Set([day]);
    refreshModal();
    buildDayPicker();

    $("modal-cell").hidden = false;
  }

  // clear = true : vide les cases / false : les remplit
  function applyCell(clear) {
    if (selectedDays.size === 0) {
      $("cell-error").textContent = "Choisis au moins un jour.";
      return;
    }

    const { hour } = cellCtx;
    const until = Number($("cell-until").value);
    const textSame = $("text-same").value.trim();
    const textA = $("text-A").value.trim();
    const textB = $("text-B").value.trim();

    selectedDays.forEach(d => {
      const s = hours[d];
      for (let h = hour; h < until; h++) {
        if (h < s.start || h >= s.end) continue; // hors horaires de ce jour
        const base = `${d}-${h}`;

        if (clear) {
          delete cells["T-" + base];
          delete cells["A-" + base];
          delete cells["B-" + base];
        } else if (mode === "same") {
          cells["T-" + base] = { cat: catSame, text: textSame };
          delete cells["A-" + base];
          delete cells["B-" + base];
        } else {
          delete cells["T-" + base];
          if (catA) cells["A-" + base] = { cat: catA, text: textA };
          else delete cells["A-" + base];
          if (catB) cells["B-" + base] = { cat: catB, text: textB };
          else delete cells["B-" + base];
        }
      }
    });

    saveCells();
    closeModals();
    render();
  }

  /* ---------- Fenêtre : horaires ---------- */
  let hourInputs = [];

  function hourSelect(from, to, value) {
    const s = document.createElement("select");
    for (let h = from; h <= to; h++) {
      const o = document.createElement("option");
      o.value = h;
      o.textContent = `${h}h`;
      s.appendChild(o);
    }
    s.value = value;
    return s;
  }

  function openSettings() {
    const body = $("settings-body");
    body.innerHTML = "";
    hourInputs = [];
    $("set-error").textContent = "";

    hours.forEach((s, i) => {
      const r = { start: hourSelect(0, 23, s.start), end: hourSelect(1, 24, s.end) };
      const tr = el("tr");
      [el("span", null, JOURS_LONGS[i]), r.start, r.end].forEach(node => {
        const td = el("td");
        td.appendChild(node);
        tr.appendChild(td);
      });
      body.appendChild(tr);
      hourInputs.push(r);
    });

    $("modal-settings").hidden = false;
  }

  function saveSettings() {
    const result = [];
    for (let i = 0; i < 7; i++) {
      const start = Number(hourInputs[i].start.value);
      const end = Number(hourInputs[i].end.value);
      if (end <= start) {
        $("set-error").textContent = `${JOURS_LONGS[i]} : la fin doit être après le début.`;
        return;
      }
      result.push({ start, end });
    }
    hours = result;
    saveHours();
    closeModals();
    render();
  }

  /* ---------- Événements ---------- */
  function closeModals() {
    $("modal-cell").hidden = true;
    $("modal-settings").hidden = true;
  }

  $("plan-settings").addEventListener("click", openSettings);
  $("plan-clear").addEventListener("click", () => {
    if (!confirm("Vider tout le tableau (semaines A et B) ?")) return;
    cells = {};
    saveCells();
    render();
  });

  $("cell-save").addEventListener("click", () => applyCell(false));
  $("cell-clear").addEventListener("click", () => applyCell(true));
  $("cell-cancel").addEventListener("click", closeModals);

  $("set-save").addEventListener("click", saveSettings);
  $("set-cancel").addEventListener("click", closeModals);
  $("set-copy").addEventListener("click", () => {
    const first = hourInputs[0];
    hourInputs.forEach(r => {
      r.start.value = first.start.value;
      r.end.value = first.end.value;
    });
  });

  // Fermer en cliquant à côté ou avec Échap
  ["modal-cell", "modal-settings"].forEach(id => {
    $(id).addEventListener("click", evt => { if (evt.target === $(id)) closeModals(); });
  });
  document.addEventListener("keydown", evt => { if (evt.key === "Escape") closeModals(); });

  render();
})();