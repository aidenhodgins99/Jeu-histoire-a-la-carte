(function () {
  const RES_META = {
    nourriture: { label: "Nourriture", ic: "🌾", code: "N" },
    production: { label: "Production", ic: "🔨", code: "P" },
    argent: { label: "Argent", ic: "🪙", code: "A" },
    science: { label: "Science", ic: "🔬", code: "S" },
    culture: { label: "Culture", ic: "🎭", code: "C" },
  };
  const MOODS = ["😡", "🙁", "😐", "🙂", "😄"];

  const appEl = document.getElementById("app");
  const toastEl = document.getElementById("toast");

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove("show"), 2600);
  }

  async function api(path, opts) {
    const res = await fetch(path, {
      method: opts?.method || "GET",
      credentials: "same-origin",
      headers: opts?.body ? { "Content-Type": "application/json" } : undefined,
      body: opts?.body ? JSON.stringify(opts.body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch (e) { /* no body */ }
    if (!res.ok) throw new Error((data && data.error) || `Erreur ${res.status}`);
    return data;
  }

  // ---------------- State ----------------
  let screen = "loading"; // loading | login | dashboard | harvest | student
  let loginMode = "create";
  let loginError = "";
  let classInfo = null; // {id, name, join_code, turns_unlocked}
  let roster = [];
  let harvestTasks = null;
  let harvestDraft = {}; // civId -> { checked: Set(taskKey), excluded: bool }
  let allCards = null;
  let selectedCivId = null;
  let selectedCiv = null; // teacher civViewModel

  function fieldLabel(text, forId) {
    return `<label class="field-label" for="${forId}">${text}</label>`;
  }

  // ---------------- Boot ----------------
  async function boot() {
    try {
      await loadDashboard();
      screen = "dashboard";
    } catch (e) {
      screen = "login";
    }
    render();
  }

  async function loadDashboard() {
    const res = await api("/api/teacher/class");
    classInfo = res.class;
    roster = res.roster;
  }

  // ---------------- Login / Create ----------------
  function renderLogin() {
    const tabs = `<div class="teacher-tabs">
      <button class="${loginMode === "create" ? "active" : ""}" id="tabCreate">Créer une classe</button>
      <button class="${loginMode === "join" ? "active" : ""}" id="tabJoin">Se connecter</button>
    </div>`;
    const form = loginMode === "create"
      ? `${fieldLabel("Nom de la classe", "className")}
         <input class="field-input" id="className" placeholder="Ex. Secondaire 1 — Groupe A" autocomplete="off" />
         ${fieldLabel("Choisis un code enseignant (4 caractères min.)", "teacherPasscode")}
         <input class="field-input" id="teacherPasscode" type="password" autocomplete="off" />
         <button class="btn btn-primary" id="btnSubmit">🔥 Créer la classe</button>`
      : `${fieldLabel("Code de la classe", "joinCode")}
         <input class="field-input" id="joinCode" placeholder="Ex. AB3XQ9" maxlength="6" style="text-transform:uppercase;" autocomplete="off" />
         ${fieldLabel("Code enseignant", "teacherPasscode")}
         <input class="field-input" id="teacherPasscode" type="password" autocomplete="off" />
         <button class="btn btn-primary" id="btnSubmit">▶ Se connecter</button>`;
    appEl.innerHTML = `<div class="awz-stage">
      <h1 style="font-size:24px; margin-bottom:14px;">Tableau de bord enseignant</h1>
      ${tabs}
      ${form}
      ${loginError ? `<div class="awz-error">${loginError}</div>` : ""}
    </div>`;
    document.getElementById("tabCreate").onclick = () => { loginMode = "create"; renderLogin(); };
    document.getElementById("tabJoin").onclick = () => { loginMode = "join"; renderLogin(); };
    document.getElementById("btnSubmit").onclick = async () => {
      const teacherPasscode = document.getElementById("teacherPasscode").value;
      try {
        if (loginMode === "create") {
          const className = document.getElementById("className").value.trim();
          if (!className || teacherPasscode.length < 4) throw new Error("Nom de classe et code (4+ caractères) requis.");
          const created = await api("/api/classes", { method: "POST", body: { className, teacherPasscode } });
          await api(`/api/classes/${created.joinCode}/teacher-login`, { method: "POST", body: { teacherPasscode } });
          loginError = "";
          renderClassCreated(created.joinCode, created.className);
          return;
        }
        const joinCode = document.getElementById("joinCode").value.trim().toUpperCase();
        if (!joinCode || !teacherPasscode) throw new Error("Code de classe et code enseignant requis.");
        await api(`/api/classes/${joinCode}/teacher-login`, { method: "POST", body: { teacherPasscode } });
        await loadDashboard();
        loginError = "";
        screen = "dashboard";
        render();
      } catch (e) {
        loginError = e.message;
        renderLogin();
      }
    };
  }

  function renderClassCreated(joinCode, className) {
    appEl.innerHTML = `<div class="awz-stage">
      <h1 style="font-size:22px; margin-bottom:10px;">« ${className} » est créée !</h1>
      <p class="awz-sub" style="margin-bottom:14px;">Donne ce code à tes élèves pour qu'ils rejoignent la classe :</p>
      <div class="join-code-label">Code de la classe</div>
      <div class="join-code-display">${joinCode}</div>
      <button class="btn btn-primary" id="btnContinue" style="margin-top:20px;">Aller au tableau de bord ▶</button>
    </div>`;
    document.getElementById("btnContinue").onclick = async () => {
      await loadDashboard();
      screen = "dashboard";
      render();
    };
  }

  // ---------------- Dashboard (roster overview) ----------------
  function renderDashboard() {
    const rows = roster.map((r) => {
      const chips = Object.entries(RES_META).map(([k, m]) => `<span title="${m.label}">${m.ic}${r.resources[k] ?? 0}</span>`).join(" ");
      return `<tr>
        <td class="rname">${r.student_name}</td>
        <td>${r.civ_name || "—"}</td>
        <td>${r.onboarded ? r.turn_number : "—"}</td>
        <td class="rmini">${chips}</td>
        <td>${MOODS[r.bonheur_index] ?? "😐"}</td>
        <td>${r.onboarded ? `<span class="badge ${r.harvest_claimed ? "yes" : "no"}">${r.harvest_claimed ? "✔ comptabilisée" : "en attente"}</span>` : '<span class="badge no">pas fondée</span>'}</td>
        <td><button class="btn btn-secondary" data-civ="${r.id}" style="padding:6px 12px; font-size:13px;">Voir</button></td>
      </tr>`;
    }).join("");
    appEl.innerHTML = `<div class="awz-stage">
      <div class="class-head">
        <div>
          <h1>${classInfo.name}</h1>
          <p class="awz-sub">${roster.length} élève(s)</p>
        </div>
        <div>
          <div class="join-code-label">Code de la classe</div>
          <div class="join-code-display">${classInfo.join_code}</div>
        </div>
      </div>
      <div class="pace-row">
        <b>🔓 Tours débloqués : ${classInfo.turns_unlocked}</b>
        <div class="stepper">
          <button id="btnPaceMinus">−</button>
          <span class="sval" id="paceVal">${classInfo.turns_unlocked}</span>
          <button id="btnPacePlus">+</button>
        </div>
        <span class="awz-sub" style="margin:0;">Les élèves ne peuvent pas dépasser ce tour tant que tu ne l'avances pas.</span>
      </div>
      <div class="awz-links" style="margin-bottom:18px;">
        <button class="btn btn-secondary" id="btnHarvestView">🌾 Récolte du jour (classe entière)</button>
        <button class="btn btn-secondary" id="btnRefresh">🔄 Rafraîchir</button>
      </div>
      <table class="roster-table">
        <thead><tr><th>Élève</th><th>Civilisation</th><th>Tour</th><th>Ressources</th><th>Bonheur</th><th>Récolte</th><th></th></tr></thead>
        <tbody>${rows || '<tr><td colspan="7">Aucun élève n\'a encore rejoint.</td></tr>'}</tbody>
      </table>
    </div>`;

    let pace = classInfo.turns_unlocked;
    const applyPace = async (delta) => {
      pace = Math.max(1, pace + delta);
      document.getElementById("paceVal").textContent = pace;
      try {
        const res = await api("/api/teacher/class/turns-unlocked", { method: "POST", body: { turnsUnlocked: pace } });
        classInfo.turns_unlocked = res.class.turns_unlocked;
        toast(`Tours débloqués : ${classInfo.turns_unlocked} ✅`);
      } catch (e) {
        toast(e.message);
      }
    };
    document.getElementById("btnPaceMinus").onclick = () => applyPace(-1);
    document.getElementById("btnPacePlus").onclick = () => applyPace(1);
    document.getElementById("btnHarvestView").onclick = () => { screen = "harvest"; render(); };
    document.getElementById("btnRefresh").onclick = async () => {
      try { await loadDashboard(); renderDashboard(); toast("Tableau de bord à jour ✅"); } catch (e) { toast(e.message); }
    };
    appEl.querySelectorAll("[data-civ]").forEach((btn) => {
      btn.onclick = async () => {
        selectedCivId = btn.dataset.civ;
        try {
          selectedCiv = await api(`/api/teacher/civ/${selectedCivId}`);
          screen = "student";
          render();
        } catch (e) { toast(e.message); }
      };
    });
  }

  // ---------------- Bulk "Récolte du jour" for the whole class ----------------
  async function renderHarvest() {
    if (!harvestTasks) harvestTasks = (await api("/api/teacher/harvest-tasks")).tasks;
    const onboardedRoster = roster.filter((r) => r.onboarded);
    for (const r of onboardedRoster) {
      if (!harvestDraft[r.id]) harvestDraft[r.id] = { checked: new Set(), excluded: r.harvest_claimed };
    }
    const headerCells = harvestTasks.map((t) => `<th>${t.label}<br/><span style="font-weight:400; text-transform:none;">${RES_META[t.resKey].ic}+${t.amount}</span></th>`).join("");
    const rows = onboardedRoster.map((r) => {
      const draft = harvestDraft[r.id];
      const cells = harvestTasks.map((t) => {
        const checked = draft.checked.has(t.key);
        return `<td style="text-align:center;"><input type="checkbox" data-civ="${r.id}" data-task="${t.key}" ${checked ? "checked" : ""} ${draft.excluded ? "disabled" : ""} /></td>`;
      }).join("");
      return `<tr class="${draft.excluded ? "" : ""}">
        <td class="rname">${r.student_name}${r.harvest_claimed ? ' <span class="badge yes" style="margin-left:6px;">déjà comptabilisée</span>' : ""}</td>
        ${cells}
        <td style="text-align:center;"><input type="checkbox" data-exclude="${r.id}" ${draft.excluded ? "checked" : ""} /></td>
      </tr>`;
    }).join("");
    appEl.innerHTML = `<div class="awz-stage">
      <h2 style="margin-bottom:6px;">🌾 Récolte du jour — ${classInfo.name}</h2>
      <p class="step-help">Coche le travail complété par chaque élève, puis enregistre en un clic. Décoche « ne pas comptabiliser » pour exclure un élève absent (ses réponses restent en attente).</p>
      <div style="overflow-x:auto;">
        <table class="roster-table">
          <thead><tr><th>Élève</th>${headerCells}<th>Ne pas<br/>comptabiliser</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="6">Aucun élève fondé pour le moment.</td></tr>'}</tbody>
        </table>
      </div>
      <div class="awz-nav">
        <button class="btn btn-ghost" id="btnBack">◀ Retour</button>
        <button class="btn btn-primary" id="btnSaveHarvest" style="margin-top:0;">✅ Enregistrer la récolte</button>
      </div>
    </div>`;
    appEl.querySelectorAll("[data-civ][data-task]").forEach((cb) => {
      cb.onchange = () => {
        const draft = harvestDraft[cb.dataset.civ];
        if (cb.checked) draft.checked.add(cb.dataset.task); else draft.checked.delete(cb.dataset.task);
      };
    });
    appEl.querySelectorAll("[data-exclude]").forEach((cb) => {
      cb.onchange = () => { harvestDraft[cb.dataset.exclude].excluded = cb.checked; renderHarvest(); };
    });
    document.getElementById("btnBack").onclick = () => { screen = "dashboard"; render(); };
    document.getElementById("btnSaveHarvest").onclick = async () => {
      const targets = onboardedRoster.filter((r) => !harvestDraft[r.id].excluded);
      try {
        for (const r of targets) {
          await api(`/api/teacher/civ/${r.id}/harvest`, { method: "POST", body: { completed: Array.from(harvestDraft[r.id].checked) } });
        }
        harvestDraft = {};
        await loadDashboard();
        toast(`Récolte enregistrée pour ${targets.length} élève(s) ✅`);
        screen = "dashboard";
        render();
      } catch (e) {
        toast(e.message);
      }
    };
  }

  // ---------------- Student detail ----------------
  function resetHud(civ) {
    return Object.entries(RES_META).map(([k, m]) => `<div class="chip ${k}"><span class="ic">${m.ic}</span>${civ.resources[k] ?? 0}<span class="code">${m.code}</span></div>`).join("")
      + `<div class="chip bonheur"><span class="ic">${MOODS[civ.bonheurIndex]}</span></div>`;
  }

  async function renderStudent() {
    const civ = selectedCiv.civ;
    if (!allCards) allCards = (await api("/api/teacher/cards")).cards;
    if (!harvestTasks) harvestTasks = (await api("/api/teacher/harvest-tasks")).tasks;

    const harvestSection = civ.turnState.harvestClaimed
      ? `<div class="awz-note">✔ La récolte du jour a déjà été comptabilisée pour le tour ${civ.turnNumber}.</div>`
      : `<div class="harvest-list">${harvestTasks.map((t) => `<button class="harvest-item" data-task="${t.key}">
          <span class="hcheck"></span><span class="hlabel">${t.label}</span>
          <span class="chip ${t.resKey}"><span class="ic">${RES_META[t.resKey].ic}</span>+${t.amount}</span>
        </button>`).join("")}</div>
        <button class="btn btn-primary" id="btnHarvestOne">🌾 Enregistrer la récolte</button>`;

    const journalHtml = [...civ.journal].reverse().map((e) => `
      <div class="journal-entry">
        <div class="jhead"><span>Tour ${e.turn}</span></div>
        <p>${e.eventTitle || ""}${e.choiceLabel ? " — " + e.choiceLabel : ""}</p>
        ${e.text ? `<blockquote>« ${e.text} »</blockquote>` : ""}
      </div>`).join("") || '<p class="awz-sub">Aucune entrée pour le moment.</p>';

    const ownedHtml = selectedCiv.ownedCardDetails.map((c) => `<span>${c.title}</span>`).join("") || '<span>Aucune</span>';

    const cardOptions = allCards.filter((c) => !civ.ownedCards.includes(c.id))
      .map((c) => `<option value="${c.id}">${c.title} (${c.type === "science" ? "Science" : "Culture"})</option>`).join("");

    appEl.innerHTML = `<div class="awz-stage">
      <button class="btn btn-ghost" id="btnBack" style="margin-bottom:14px;">◀ Retour au tableau de bord</button>
      <div class="awz-home-head">
        <h1>${civ.civName || "(pas encore fondée)"}</h1>
        <div class="era-badge">Tour ${civ.turnNumber}</div>
      </div>
      <p class="awz-sub">${civ.studentName} &middot; ${civ.languageName || ""}</p>
      <div class="awz-hud">${resetHud(civ)}</div>

      <div class="section-title">🌾 Récolte du jour</div>
      ${harvestSection}

      <div class="section-title">💰 Créditer ou pénaliser</div>
      ${Object.entries(RES_META).map(([k, m]) => `
        <div class="stepper-row">
          <span class="slabel">${m.ic} ${m.label}</span>
          <div class="stepper"><button data-res="${k}" data-delta="-1">−</button><span class="sval" id="val-${k}">${civ.resources[k] ?? 0}</span><button data-res="${k}" data-delta="1">+</button></div>
        </div>`).join("")}
      <div class="stepper-row">
        <span class="slabel">😀 Bonheur</span>
        <div class="stepper"><button data-bonheur="-1">−</button><span class="sval" id="val-bonheur">${civ.bonheurIndex}</span><button data-bonheur="1">+</button></div>
      </div>

      <div class="section-title">🃏 Accorder une carte</div>
      <select class="select-input" id="cardSelect"><option value="">— Choisir une carte —</option>${cardOptions}</select>
      <button class="btn btn-secondary" id="btnGrantCard">Accorder la carte</button>

      <div class="section-title">📖 Journal de bord</div>
      ${journalHtml}

      <div class="section-title">🗂️ Cartes obtenues</div>
      <div class="owned-mini-grid">${ownedHtml}</div>

      <div class="section-title">⏱️ Régler le numéro de tour</div>
      <div class="stepper-row">
        <input class="field-input" id="turnOverride" type="number" min="1" value="${civ.turnNumber}" style="width:90px; margin-bottom:0;" />
        <button class="btn btn-secondary" id="btnSetTurn">Régler</button>
      </div>
    </div>`;

    document.getElementById("btnBack").onclick = () => { screen = "dashboard"; render(); };

    const harvestOneBtn = document.getElementById("btnHarvestOne");
    if (harvestOneBtn) {
      const checkedTasks = new Set();
      appEl.querySelectorAll(".harvest-item").forEach((btn) => {
        btn.onclick = () => {
          const key = btn.dataset.task;
          if (checkedTasks.has(key)) { checkedTasks.delete(key); btn.classList.remove("checked"); btn.querySelector(".hcheck").textContent = ""; }
          else { checkedTasks.add(key); btn.classList.add("checked"); btn.querySelector(".hcheck").textContent = "✓"; }
        };
      });
      harvestOneBtn.onclick = async () => {
        try {
          const result = await api(`/api/teacher/civ/${selectedCivId}/harvest`, { method: "POST", body: { completed: Array.from(checkedTasks) } });
          selectedCiv = result;
          toast("Récolte enregistrée ✅");
          renderStudent();
        } catch (e) { toast(e.message); }
      };
    }

    appEl.querySelectorAll("[data-res]").forEach((btn) => {
      btn.onclick = async () => {
        try {
          const result = await api(`/api/teacher/civ/${selectedCivId}/grant`, { method: "POST", body: { resourceDelta: { [btn.dataset.res]: Number(btn.dataset.delta) } } });
          selectedCiv = result;
          document.getElementById(`val-${btn.dataset.res}`).textContent = result.civ.resources[btn.dataset.res];
        } catch (e) { toast(e.message); }
      };
    });
    appEl.querySelectorAll("[data-bonheur]").forEach((btn) => {
      btn.onclick = async () => {
        try {
          const result = await api(`/api/teacher/civ/${selectedCivId}/grant`, { method: "POST", body: { bonheurDelta: Number(btn.dataset.bonheur) } });
          selectedCiv = result;
          document.getElementById("val-bonheur").textContent = result.civ.bonheurIndex;
        } catch (e) { toast(e.message); }
      };
    });
    document.getElementById("btnGrantCard").onclick = async () => {
      const cardId = document.getElementById("cardSelect").value;
      if (!cardId) { toast("Choisis une carte d'abord."); return; }
      try {
        selectedCiv = await api(`/api/teacher/civ/${selectedCivId}/grant`, { method: "POST", body: { cardId } });
        toast("Carte accordée ✅");
        renderStudent();
      } catch (e) { toast(e.message); }
    };
    document.getElementById("btnSetTurn").onclick = async () => {
      const turnNumber = Number(document.getElementById("turnOverride").value);
      try {
        selectedCiv = await api(`/api/teacher/civ/${selectedCivId}/set-turn`, { method: "POST", body: { turnNumber } });
        toast("Tour réglé ✅");
        renderStudent();
      } catch (e) { toast(e.message); }
    };
  }

  // ---------------- Render dispatcher ----------------
  function render() {
    if (screen === "login") return renderLogin();
    if (screen === "dashboard") return renderDashboard();
    if (screen === "harvest") return renderHarvest();
    if (screen === "student") return renderStudent();
  }

  boot();
})();
