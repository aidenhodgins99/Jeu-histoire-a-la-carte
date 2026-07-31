(function () {
  const RES_META = {
    nourriture: { label: "Nourriture", ic: "🌾", code: "N", desc: "Sert à faire naître de nouveaux citoyens." },
    production: { label: "Production", ic: "🔨", code: "P", desc: "Sert à construire des quartiers et des bâtiments." },
    argent: { label: "Argent", ic: "🪙", code: "A", desc: "Sert à acheter certaines cartes spéciales." },
    science: { label: "Science", ic: "🔬", code: "S", desc: "Sert à faire des découvertes scientifiques." },
    culture: { label: "Culture", ic: "🎭", code: "C", desc: "Sert à découvrir des cartes culturelles." },
  };
  const MOODS = ["😡", "🙁", "😐", "🙂", "😄"];
  const MOOD_LABELS = ["Révolte", "Mécontent", "Neutre", "Content", "Âge d'or"];
  const STEP_LABELS = ["Choisir une carte", "Production de l'établissement", "Actions des citoyens", "Carte historique", "Résumé"];
  // Icons are only ever a fallback for a terrain/citizen without a real photo yet.
  // Plaine deliberately avoids anything wheat/crop-shaped — agriculture doesn't
  // exist yet at game start, a stalk-of-grain icon would be historically backwards.
  const TERRAIN_META = {
    territoire_forestier: { ic: "🌲", label: "Forêt", color: "#3f5a3d" },
    territoire_de_plaine: { ic: "🐾", label: "Plaine", color: "#8a7a4a" },
    territoire_de_toundra: { ic: "❄️", label: "Toundra", color: "#7791a1" },
    territoire_montagneux: { ic: "⛰️", label: "Montagne", color: "#6b6157" },
    territoire_fluvial: { ic: "🏞️", label: "Rivière", color: "#3d6c85" },
    territoire_cotier: { ic: "🌊", label: "Côte", color: "#2f6e8a" },
    territoire_agricole: { ic: "🌱", label: "Territoire agricole", color: "#6c8a3f" },
    territoire_urbain: { ic: "🏘️", label: "Territoire urbain", color: "#7a6a52" },
  };
  const UNIT_ICONS = { chasseur_cueilleur: "🏹", travailleur: "🧑‍🌾", agriculteur: "🌾", lancier: "🗡️", guerrier: "⚔️", archer: "🏹", artisan: "🏺", prophete: "🔥", explorateur: "🧭", bateaux: "⛵", colon: "🏕️" };
  const RESOURCE_ICONS = { pierre: "🪨", epices: "🌶️", mammouths: "🦣", tigres_dents_de_sabre: "🐅", caribous: "🦌", loups: "🐺" };

  const appEl = document.getElementById("app");
  const toastEl = document.getElementById("toast");
  const civLabelEl = document.getElementById("civLabel");

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

  // A frame-shaped card image forced into object-fit:cover can crop badly
  // when the photo's aspect ratio doesn't match the frame (e.g. a near-square
  // artifact photo losing its top/bottom in a wide card frame) — the same
  // problem already solved for the print pipeline (card-generator/generate_cards.js
  // chooseObjectFit), reimplemented here client-side since Render has no
  // ImageMagick to precompute it server-side.
  function applySmartObjectFit(imgEl) {
    const decide = () => {
      const frame = imgEl.parentElement;
      if (!frame || !imgEl.naturalWidth || !imgEl.naturalHeight) return;
      const frameAspect = frame.clientWidth / frame.clientHeight;
      const imgAspect = imgEl.naturalWidth / imgEl.naturalHeight;
      imgEl.style.objectFit = imgAspect >= frameAspect ? "cover" : "contain";
    };
    if (imgEl.complete && imgEl.naturalWidth) decide();
    else imgEl.addEventListener("load", decide, { once: true });
  }
  new MutationObserver(() => {
    appEl.querySelectorAll("img:not([data-fit-done])").forEach((img) => {
      img.dataset.fitDone = "1";
      applySmartObjectFit(img);
    });
  }).observe(appEl, { childList: true, subtree: true });

  // ---------------- App state ----------------
  let vm = null; // last civViewModel from the server
  let screen = "loading"; // loading | join | onboard | home | wizard | journal | library
  let step = 1;
  let wizard = { actedUnitIds: new Set(), selectedTileIndex: null, selectedUnitId: null, moveMode: false, eventChoiceKey: null, eventText: "", producedThisTurn: false };
  let turnInfo = null;
  let joinError = "";
  let onboardError = "";
  let pendingCardReveal = null; // a just-bought card, shown once before returning to the grid

  function resKey(cardType) { return cardType === "science" ? "science" : "culture"; }

  // Renders a real photo when available, otherwise falls back to an emoji —
  // used for cards, map tiles and citizen tokens alike.
  function imgOrEmoji(imageUrl, emoji, altLabel) {
    return imageUrl
      ? `<img src="${imageUrl}" alt="${altLabel || ""}" loading="lazy" />`
      : `<span>${emoji}</span>`;
  }

  function territoireMap() {
    const map = {};
    for (const t of vm.content.territoires) map[t.id] = t;
    return map;
  }

  function unitMap() {
    const map = {};
    for (const u of vm.unlockedUnits) map[u.id] = u;
    return map;
  }

  function resourceMap() {
    const map = {};
    for (const r of vm.content.mapResources || []) map[r.id] = r;
    return map;
  }

  function hud(bumpKey) {
    const chips = Object.entries(RES_META).map(([key, m]) => {
      const val = vm.civ.resources[key] ?? 0;
      return `<div class="chip ${key} ${key === bumpKey ? "bump" : ""}" title="${m.desc}"><span class="ic">${m.ic}</span>${val}<span class="code">${m.code}</span></div>`;
    }).join("");
    const mood = `<div class="chip bonheur" id="moodChip"><span class="ic">${MOODS[vm.civ.bonheurIndex]}</span>${MOOD_LABELS[vm.civ.bonheurIndex]}</div>`;
    return `<div class="awz-hud">${chips}${mood}</div>`;
  }

  function tracker(current) {
    let out = '<div class="awz-tracker">';
    for (let i = 1; i <= 5; i++) {
      const cls = i < current ? "done" : i === current ? "current" : "";
      out += `<div class="hexnode ${cls}" title="${STEP_LABELS[i - 1]}">${i}</div>`;
      if (i < 5) out += `<div class="hextrack-line ${i < current ? "done" : ""}"></div>`;
    }
    return out + "</div>";
  }

  function stageWrap(inner, bumpKey, withTracker) {
    appEl.innerHTML = `<div class="awz-stage">${hud(bumpKey)}${withTracker ? tracker(step) : ""}${inner}</div>`;
  }

  function navRow(canBack, nextLabel, nextEnabled) {
    return `<div class="awz-nav">
      ${canBack ? '<button class="btn btn-ghost" id="btnBack">◀ Retour</button>' : ""}
      <button class="btn btn-primary" id="btnNext" ${nextEnabled === false ? "disabled" : ""} style="margin-top:0;">${nextLabel}</button>
    </div>`;
  }
  function wireNav(onBack, onNext) {
    const b = document.getElementById("btnBack");
    if (b) b.onclick = onBack;
    const n = document.getElementById("btnNext");
    if (n) n.onclick = onNext;
  }

  function tradingCard(card, { locked = false, selected = false, owned = false, lockMsg = "" } = {}) {
    const type = card.type || "culture";
    const fallbackIcon = card.type === "science" ? "🔬" : "🎭";
    return `<button class="trading-card ${selected ? "selected" : ""} ${locked ? "locked" : ""} ${owned ? "owned" : ""}" data-id="${card.id}" ${locked || owned ? "disabled" : ""}>
      <div class="tc-frame ${type}">${imgOrEmoji(card.imageUrl, fallbackIcon, card.title)}</div>
      <div class="tc-body">
        <span class="tc-type">${card.type === "science" ? "Carte scientifique" : "Carte culturelle"}</span>
        <span class="tc-title">${card.title}</span>
        <span class="tc-desc">${card.description || ""}</span>
      </div>
      <div class="tc-foot ${type}">
        ${owned ? '<span class="tc-owned">✔ Obtenue</span>' : `<span>${RES_META[resKey(card.type)].ic} ${card.cost ?? 0}</span>`}
        <span class="tc-hex">⬡</span>
      </div>
      ${locked ? `<span class="tc-lock">🔒 ${lockMsg}</span>` : ""}
    </button>`;
  }

  // ---------------- Boot ----------------
  async function boot() {
    try {
      vm = await api("/api/civ/me");
      screen = vm.civ.onboarded ? "home" : "onboard";
    } catch (e) {
      screen = "join";
    }
    render();
  }

  // ---------------- Join ----------------
  function renderJoin() {
    appEl.innerHTML = `<div class="awz-stage">
      <h1 style="font-size:24px;">Rejoindre ta classe</h1>
      <p class="awz-sub" style="margin-bottom:20px;">Demande à ton enseignant le code de la classe, puis entre ton prénom et ton nom exactement comme il te l'indique.</p>
      <label class="field-label" for="joinCode">Code de la classe</label>
      <input class="field-input" id="joinCode" placeholder="Ex. AB3XQ9" maxlength="6" autocomplete="off" style="text-transform:uppercase;" />
      <label class="field-label" for="studentName">Ton nom</label>
      <input class="field-input" id="studentName" placeholder="Ex. Camille T." autocomplete="off" />
      ${joinError ? `<div class="awz-error">${joinError}</div>` : ""}
      <button class="btn btn-primary" id="btnJoin">▶ Rejoindre</button>
      <p class="awz-sub" style="margin-top:16px; text-align:center;">Tu es l'enseignant·e ? <a href="/teacher.html">Accède au tableau de bord</a></p>
    </div>`;
    document.getElementById("btnJoin").onclick = async () => {
      const code = document.getElementById("joinCode").value.trim();
      const name = document.getElementById("studentName").value.trim();
      if (!code || !name) { joinError = "Le code de classe et ton nom sont requis."; renderJoin(); return; }
      try {
        vm = await api(`/api/classes/${encodeURIComponent(code)}/join`, { method: "POST", body: { studentName: name } });
        civLabelEl.textContent = vm.className || "Assistant de tour";
        joinError = "";
        screen = vm.civ.onboarded ? "home" : "onboard";
        render();
      } catch (e) {
        joinError = e.message;
        renderJoin();
      }
    };
  }

  // ---------------- Onboard (epic opening) ----------------
  function renderOnboard() {
    appEl.innerHTML = `<div class="awz-stage">
      <div class="step-eyebrow">Aux origines du monde</div>
      <h1 style="font-size:24px; margin-bottom:14px;">Fonde ta civilisation</h1>
      <p class="epic-intro">Il y a des dizaines de milliers d'années, un petit clan cherche un endroit où s'installer. Le vent tourne, les saisons changent, et bientôt, il te faudra un nom — et une langue pour raconter votre histoire aux générations suivantes.</p>
      <label class="field-label" for="civName">Nom de ta civilisation</label>
      <input class="field-input" id="civName" placeholder="Ex. Clan du Héron" autocomplete="off" />
      <label class="field-label" for="langName">Nom de votre langue</label>
      <input class="field-input" id="langName" placeholder="Ex. le héronais" autocomplete="off" />
      ${onboardError ? `<div class="awz-error">${onboardError}</div>` : ""}
      <button class="btn btn-primary" id="btnFound">🔥 Fonder ma civilisation</button>
    </div>`;
    document.getElementById("btnFound").onclick = async () => {
      const civName = document.getElementById("civName").value.trim();
      const languageName = document.getElementById("langName").value.trim();
      if (!civName || !languageName) { onboardError = "Le nom de la civilisation et le nom de la langue sont requis."; renderOnboard(); return; }
      try {
        vm = await api("/api/civ/me/onboard", { method: "POST", body: { civName, languageName } });
        onboardError = "";
        screen = "home";
        render();
        toast(`${civName} est née ! 🔥`);
      } catch (e) {
        onboardError = e.message;
        renderOnboard();
      }
    };
  }

  // ---------------- Tutorial overlay ----------------
  function showTutorial(onClose) {
    const items = [
      { ic: "🌾", t: "Nourriture (N)", d: "Sert à faire naître de nouveaux citoyens." },
      { ic: "🔨", t: "Production (P)", d: "Sert à construire des quartiers et des bâtiments." },
      { ic: "🪙", t: "Argent (A)", d: "Sert à acheter certaines cartes spéciales." },
      { ic: "🔬", t: "Science (S)", d: "Sert à faire des découvertes scientifiques." },
      { ic: "🎭", t: "Culture (C)", d: "Sert à découvrir des cartes culturelles, croyances et formes de gouvernance." },
      { ic: "😄", t: "Bonheur (en haut à droite)", d: "L'humeur de ta civilisation — elle monte ou descend selon tes décisions." },
    ];
    const overlay = document.createElement("div");
    overlay.className = "tutorial-overlay";
    overlay.innerHTML = `<div class="tutorial-card">
      <h2 style="margin-bottom:10px;">Bienvenue, chef de clan</h2>
      <p class="awz-sub" style="margin-bottom:14px;">Voici les cinq ressources de ta civilisation :</p>
      ${items.map((i) => `<div class="tutorial-item"><span class="ic">${i.ic}</span><div><b>${i.t}</b><span>${i.d}</span></div></div>`).join("")}
      <button class="btn btn-primary" id="btnCloseTutorial">J'ai compris ▶</button>
    </div>`;
    document.body.appendChild(overlay);
    document.getElementById("btnCloseTutorial").onclick = async () => {
      overlay.remove();
      if (onClose) onClose();
    };
  }

  // ---------------- Home ----------------
  // Two independent gates before a student can start a turn: canPlay (the
  // teacher hasn't opened this turn class-wide yet) and harvestClaimed (the
  // teacher hasn't recorded this student's completed schoolwork yet — that's
  // a teacher action now, not student self-report, see routes/teacher.js).
  async function renderHome() {
    if (!turnInfo) turnInfo = await api("/api/civ/me/turn");
    const govCard = vm.ownedCardDetails.find((c) => c.id === "chefferie" || c.id === "vie_tribale");
    let playButton;
    if (!turnInfo.canPlay) {
      playButton = `<div class="locked-note"><span class="lic">⏳</span>Ce tour n'est pas encore débloqué par ton enseignant.<br/>Reviens à la prochaine période de classe !</div>`;
    } else if (!turnInfo.harvestClaimed) {
      playButton = `<div class="locked-note"><span class="lic">📝</span>Fais tes travaux (quiz, cahier, i+, travail additionnel…) pour rapporter des ressources et des points à ta civilisation.<br/>Ton enseignant les comptabilisera avant de débloquer ton prochain tour.</div>`;
    } else {
      playButton = '<button class="btn btn-primary" id="btnStart">▶ Jouer mon tour</button>';
    }
    appEl.innerHTML = `<div class="awz-stage">
      <div class="awz-home-head">
        <h1>${vm.civ.civName}</h1>
        <div class="era-badge">${turnInfo.epoch} &middot; Tour ${vm.civ.turnNumber}</div>
      </div>
      <p class="awz-sub">Langue : ${vm.civ.languageName} &middot; ${turnInfo.yearLabel}</p>
      ${hud()}
      ${playButton}
      <div class="awz-links">
        <button class="btn btn-secondary" id="btnJournal">📖 Journal de bord</button>
        <button class="btn btn-secondary" id="btnLibrary">🗂️ Ma bibliothèque de cartes</button>
      </div>
      <div class="awz-links">
        <button class="btn btn-secondary" id="btnTutorial">🎓 Revoir le tutoriel</button>
      </div>
      ${govCard ? `<div class="awz-note">Gouvernance actuelle : <b>${govCard.title}</b></div>` : ""}
    </div>`;
    const startBtn = document.getElementById("btnStart");
    if (startBtn) startBtn.onclick = async () => {
      wizard = { actedUnitIds: new Set(), selectedTileIndex: null, selectedUnitId: null, moveMode: false, eventChoiceKey: null, eventText: "", producedThisTurn: false };
      step = 1;
      screen = "wizard";
      render();
    };
    document.getElementById("btnJournal").onclick = () => { screen = "journal"; render(); };
    document.getElementById("btnLibrary").onclick = () => { screen = "library"; render(); };
    document.getElementById("btnTutorial").onclick = () => showTutorial();
  }

  // ---------------- Wizard step 1: choisir une carte ----------------
  function renderStep1(bumpKey) {
    if (pendingCardReveal) return renderCardReveal();
    const cardsHtml = vm.discoverableCards.map((c) => {
      const bal = vm.civ.resources[resKey(c.type)] ?? 0;
      const cost = c.cost ?? 0;
      const locked = bal < cost;
      return tradingCard(c, { locked, lockMsg: locked ? `Il te manque ${cost - bal} point(s) de ${RES_META[resKey(c.type)].label.toLowerCase()}` : "" });
    }).join("");
    const inner = `
      <div class="step-eyebrow">Étape 1 / 5</div>
      <h2 class="step-title">Choisir une carte</h2>
      <p class="step-help">Voici les cartes mystères que tu peux découvrir maintenant. Chaque achat est immédiat et définitif — les points sont déduits tout de suite. Tu peux aussi n'en choisir aucune.</p>
      <div class="trading-grid">${cardsHtml || '<p class="awz-sub">Aucune carte à découvrir pour le moment.</p>'}</div>
      ${navRow(true, "Continuer ▶")}
    `;
    stageWrap(inner, bumpKey, true);
    appEl.querySelectorAll(".trading-card:not(.locked):not(.owned)").forEach((btn) => {
      btn.onclick = async () => {
        try {
          vm = await api(`/api/civ/me/cards/${encodeURIComponent(btn.dataset.id)}/buy`, { method: "POST" });
          const card = vm.ownedCardDetails.find((c) => c.id === btn.dataset.id);
          pendingCardReveal = card;
          renderCardReveal();
        } catch (e) {
          toast(e.message);
        }
      };
    });
    wireNav(() => { screen = "home"; render(); }, () => { step = 2; render(); });
  }

  // Duolingo-style reveal: a freshly discovered card gets its own moment before
  // rejoining the grid, so students actually read the description and effects.
  function renderCardReveal() {
    const card = pendingCardReveal;
    const fallbackIcon = card.type === "science" ? "🔬" : "🎭";
    appEl.innerHTML = `<div class="awz-stage">
      <div class="reveal-card special">
        <span class="reveal-badge">✨ Nouvelle découverte</span>
        ${card.imageUrl ? `<img class="reveal-img" src="${card.imageUrl}" alt="${card.title}" />` : `<span class="reveal-icon">${fallbackIcon}</span>`}
        <div class="reveal-title">${card.title}</div>
        <p class="reveal-desc">${card.description || ""}</p>
        ${card.unlocks ? `<p class="reveal-desc"><b>Débloque :</b> ${card.unlocks}</p>` : ""}
      </div>
      <button class="btn btn-primary" id="btnRevealNext">Continuer ▶</button>
    </div>`;
    document.getElementById("btnRevealNext").onclick = () => {
      pendingCardReveal = null;
      renderStep1();
    };
  }

  // ---------------- Wizard step 2: production ----------------
  function renderStep2(bumpKey) {
    const uMap = unitMap();
    const unitOpts = vm.unlockedUnits.map((u) => ({
      kind: "unit", id: u.id, label: u.title, effet: (u.actions || []).join(", "),
      cost: u.isStarter ? 0 : (u.costFirst ?? 0), resKey: "nourriture", imageUrl: u.imageUrl,
    }));
    const districtOpts = vm.unlockedDistricts
      .filter((d) => !vm.civ.builtDistricts.includes(d.id))
      .map((d) => ({ kind: "district", id: d.id, label: `${d.title} (${d.kind})`, effet: d.effect, cost: d.costProduction ?? 0, resKey: "production", imageUrl: d.imageUrl }));
    const options = [...unitOpts, ...districtOpts];
    const bal = { nourriture: vm.civ.resources.nourriture, production: vm.civ.resources.production };
    const done = wizard.producedThisTurn;
    const optHtml = options.map((o) => {
      const locked = done || o.cost > bal[o.resKey];
      return `<button class="pick-card ${locked ? "locked" : ""}" data-kind="${o.kind}" data-id="${o.id}" ${locked ? "disabled" : ""}>
        <span class="ptitle">${o.label}</span>
        <span class="pdesc">${o.effet || ""}</span>
        <span class="pick-cost chip ${o.resKey}">${RES_META[o.resKey].ic} ${o.cost}</span>
      </button>`;
    }).join("");
    const inner = `
      <div class="step-eyebrow">Étape 2 / 5</div>
      <h2 class="step-title">Production de l'établissement</h2>
      <p class="step-help">Choisis un citoyen (coûte de la Nourriture) ou un quartier/bâtiment (coûte de la Production) à produire ce tour — une seule production par tour. Les nouveaux citoyens apparaissent sur ta tuile de départ.</p>
      <div class="card-grid">${optHtml || '<p class="awz-sub">Rien à produire pour le moment.</p>'}</div>
      ${done ? '<div class="awz-note">✔ Production choisie pour ce tour.</div>' : ""}
      ${navRow(true, "Continuer ▶")}
    `;
    stageWrap(inner, bumpKey, true);
    appEl.querySelectorAll(".pick-card:not(.locked)").forEach((btn) => {
      btn.onclick = async () => {
        try {
          const body = { kind: btn.dataset.kind, id: btn.dataset.id };
          if (btn.dataset.kind === "unit") body.tileIndex = 4; // tuile de départ (centre)
          vm = await api("/api/civ/me/production", { method: "POST", body });
          wizard.producedThisTurn = true;
          toast("Production lancée ✅");
          renderStep2(btn.dataset.kind === "unit" ? "nourriture" : "production");
        } catch (e) {
          toast(e.message);
        }
      };
    });
    wireNav(() => { step = 1; render(); }, () => { step = 3; render(); });
  }

  // ---------------- Wizard step 3: actions des citoyens (carte 3x3) ----------------
  async function loadUnitActions(tileIndex, unitId) {
    return api(`/api/civ/me/units/${tileIndex}/${unitId}/actions`);
  }

  function renderMap() {
    const tMap = territoireMap();
    const uMap = unitMap();
    const rMap = resourceMap();
    const tiles = vm.civ.map.map((tile) => {
      const meta = TERRAIN_META[tile.terrainId] || { ic: "❔", label: tile.terrainId, color: "#888" };
      const territoire = tMap[tile.terrainId];
      const bgStyle = territoire?.imageUrl ? `background-image:url('${territoire.imageUrl}');` : `background-color:${meta.color};`;
      const units = tile.units.map((u) => {
        const selected = wizard.selectedUnitId === u.id;
        const acted = wizard.actedUnitIds.has(u.id) || (vm.civ.turnState.actedUnitIds || []).includes(u.id);
        const unitDef = uMap[u.type];
        return `<div class="unit-token ${selected ? "selected" : ""}" data-unit="${u.id}" data-tile="${tile.index}" title="${unitDef?.title || u.type}${acted ? " (a agi)" : ""}">${imgOrEmoji(unitDef?.imageUrl, UNIT_ICONS[u.type] || "👤", unitDef?.title)}</div>`;
      }).join("");
      const resDef = tile.resource ? rMap[tile.resource.id] : null;
      const resourceBadge = resDef
        ? `<div class="tile-resource" title="${resDef.title} — ${resDef.description || ""}">${imgOrEmoji(resDef.imageUrl, RESOURCE_ICONS[resDef.id] || "❔", resDef.title)}</div>`
        : "";
      return `<div class="map-tile ${wizard.selectedTileIndex === tile.index ? "has-selected-unit" : ""}" style="${bgStyle}" data-tile="${tile.index}">
        <div class="tile-units">${units}</div>
        ${resourceBadge}
        <span class="tile-label">${territoire?.imageUrl ? "" : meta.ic + " "}${meta.label}${tile.hasTanningSite ? " · 🪢" : ""}</span>
      </div>`;
    }).join("");
    return `<div class="map-grid">${tiles}</div>`;
  }

  async function renderStep3(bumpKey) {
    let actionsPanel = "";
    if (wizard.selectedUnitId != null) {
      if (wizard.moveMode) {
        actionsPanel = `<p class="step-help">Touche une tuile adjacente sur la carte pour t'y déplacer.</p>`;
      } else {
        const actions = await loadUnitActions(wizard.selectedTileIndex, wizard.selectedUnitId);
        actionsPanel = actions.actions.length
          ? `<div class="unit-row acted"><div class="unit-actions">${actions.actions.map((a) => `<button class="btn btn-secondary" data-action="${a.key}">${a.label}</button>`).join("")}</div></div>`
          : `<p class="step-help">Ce citoyen a déjà agi ce tour-ci.</p>`;
      }
    }

    const inner = `
      <div class="step-eyebrow">Étape 3 / 5</div>
      <h2 class="step-title">Actions des citoyens</h2>
      <p class="step-help">Touche un citoyen sur la carte, puis choisis son action. Chaque citoyen peut agir une seule fois par tour.</p>
      ${renderMap()}
      ${actionsPanel}
      ${navRow(true, "Continuer ▶", true)}
    `;
    stageWrap(inner, bumpKey, true);

    appEl.querySelectorAll(".map-tile").forEach((tileEl) => {
      tileEl.onclick = async (evt) => {
        const tileIndex = Number(tileEl.dataset.tile);
        if (wizard.moveMode && wizard.selectedUnitId != null) {
          try {
            vm = await api("/api/civ/me/units/action", { method: "POST", body: { tileIndex: wizard.selectedTileIndex, unitId: wizard.selectedUnitId, actionKey: "se_deplacer", targetIndex: tileIndex } });
            wizard.actedUnitIds.add(wizard.selectedUnitId);
            wizard.moveMode = false;
            wizard.selectedUnitId = null;
            wizard.selectedTileIndex = null;
            renderStep3();
          } catch (e) { toast(e.message); }
          return;
        }
        const unitTokenEl = evt.target.closest(".unit-token");
        if (unitTokenEl) {
          wizard.selectedUnitId = unitTokenEl.dataset.unit;
          wizard.selectedTileIndex = Number(unitTokenEl.dataset.tile);
          wizard.moveMode = false;
          renderStep3();
        }
      };
    });
    appEl.querySelectorAll("[data-action]").forEach((btn) => {
      btn.onclick = async () => {
        if (btn.dataset.action === "se_deplacer") { wizard.moveMode = true; renderStep3(); return; }
        try {
          const res = await api("/api/civ/me/units/action", { method: "POST", body: { tileIndex: wizard.selectedTileIndex, unitId: wizard.selectedUnitId, actionKey: btn.dataset.action } });
          vm = res;
          wizard.actedUnitIds.add(wizard.selectedUnitId);
          wizard.selectedUnitId = null;
          wizard.selectedTileIndex = null;
          toast(res.resourceBonusMessage ? `Action effectuée ✅ (${res.resourceBonusMessage})` : "Action effectuée ✅");
          renderStep3();
        } catch (e) { toast(e.message); }
      };
    });
    wireNav(() => { step = 2; render(); }, () => { step = 4; render(); });
  }

  // ---------------- Wizard step 4: carte historique ----------------
  async function renderStep4(bumpKey) {
    turnInfo = await api("/api/civ/me/turn");
    const ev = turnInfo.event;
    if (!ev) {
      stageWrap(`<div class="step-eyebrow">Étape 4 / 5</div><h2 class="step-title">Carte historique</h2><p class="step-help">Aucune carte historique scénarisée pour ce tour.</p>${navRow(true, "Continuer ▶")}`, bumpKey, true);
      wireNav(() => { step = 3; render(); }, () => { step = 5; render(); });
      return;
    }
    const canContinue = (!ev.requiresText || wizard.eventText.trim().length >= 10) && (!ev.choice || wizard.eventChoiceKey);
    const choiceHtml = ev.choice ? `<div class="choice-row">
      <p style="font-weight:700; font-size:13px;">${ev.choice.prompt}</p>
      ${ev.choice.options.map((o) => `<button class="choice-btn ${wizard.eventChoiceKey === o.key ? "chosen" : ""}" data-choice="${o.key}">${o.label}</button>`).join("")}
    </div>` : "";
    const textHtml = ev.requiresText ? `<div class="write-prompt">
      <label>✍️ ${ev.textPrompt}</label>
      <textarea id="eventText" placeholder="Écris la décision de ton clan…">${wizard.eventText}</textarea>
      <p class="write-hint">Ce texte devient un extrait de l'histoire de ta civilisation dans le Journal de bord.</p>
    </div>` : "";
    const inner = `
      <div class="step-eyebrow">Étape 4 / 5</div>
      <h2 class="step-title">Carte historique</h2>
      <div class="event-card">
        <h3>${ev.title}</h3>
        <p>${ev.description}</p>
        ${choiceHtml}
        ${textHtml}
      </div>
      ${navRow(true, "Continuer ▶", canContinue)}
    `;
    stageWrap(inner, bumpKey, true);
    const ta = document.getElementById("eventText");
    if (ta) ta.oninput = () => {
      wizard.eventText = ta.value;
      const n = document.getElementById("btnNext");
      if (n) n.disabled = !((!ev.requiresText || ta.value.trim().length >= 10) && (!ev.choice || wizard.eventChoiceKey));
    };
    appEl.querySelectorAll("[data-choice]").forEach((btn) => {
      btn.onclick = () => { wizard.eventChoiceKey = btn.dataset.choice; renderStep4(); };
    });
    wireNav(() => { step = 3; render(); }, () => { step = 5; render(); });
  }

  // ---------------- Wizard step 5: résumé + confirmation ----------------
  function renderStep5() {
    const items = [
      `<li><span>Cartes en bibliothèque</span><span>${vm.ownedCardDetails.length}</span></li>`,
      `<li><span>Citoyens actifs ce tour</span><span>${wizard.actedUnitIds.size}</span></li>`,
      `<li><span>Carte historique</span><span>${turnInfo?.event?.title || "—"}</span></li>`,
    ].join("");
    const inner = `
      <div class="step-eyebrow">Étape 5 / 5</div>
      <h2 class="step-title">Résumé du tour</h2>
      <p class="step-help">Vérifie ton tour avant de le confirmer — cette étape fait avancer le calendrier de ta civilisation.</p>
      <ul class="sum-list">${items}</ul>
      ${wizard.eventText ? `<blockquote style="margin:0 0 16px; padding-left:12px; border-left:2px solid var(--line); font-style:italic; color:var(--charcoal-soft); font-size:13.5px;">« ${wizard.eventText} »</blockquote>` : ""}
      <button class="btn btn-primary" id="btnConfirm">✅ Confirmer mon tour</button>
    `;
    stageWrap(inner, null, true);
    document.getElementById("btnConfirm").onclick = async () => {
      try {
        vm = await api("/api/civ/me/turn/advance", { method: "POST", body: { eventText: wizard.eventText, choiceKey: wizard.eventChoiceKey } });
        turnInfo = null;
        screen = "home";
        step = 1;
        render();
        toast("Tour confirmé et ajouté au journal de bord ✅");
      } catch (e) {
        toast(e.message);
      }
    };
  }

  // ---------------- Journal / Library ----------------
  function renderJournal() {
    const entries = [...vm.civ.journal].reverse().map((e) => `
      <div class="journal-entry">
        <div class="jhead"><span>Tour ${e.turn}</span></div>
        <p>${e.eventTitle || ""}${e.choiceLabel ? " — " + e.choiceLabel : ""}</p>
        ${e.text ? `<blockquote>« ${e.text} »</blockquote>` : ""}
      </div>`).join("") || '<p class="awz-sub">Aucune entrée pour le moment.</p>';
    appEl.innerHTML = `<div class="awz-stage">
      <h2 style="margin-bottom:16px;">📖 Journal de bord</h2>
      ${entries}
      <button class="btn btn-ghost" id="btnHome" style="margin-top:8px;">◀ Retour à la fiche</button>
    </div>`;
    document.getElementById("btnHome").onclick = () => { screen = "home"; render(); };
  }

  function renderLibrary() {
    const cards = vm.ownedCardDetails.map((c) => tradingCard(c, { owned: true })).join("") || '<p class="awz-sub">Aucune carte pour le moment.</p>';
    appEl.innerHTML = `<div class="awz-stage">
      <h2 style="margin-bottom:8px;">🗂️ Ma bibliothèque de cartes</h2>
      <p class="awz-sub" style="margin-bottom:16px;">Seules les cartes que tu possèdes déjà apparaissent ici.</p>
      <div class="trading-grid">${cards}</div>
      <button class="btn btn-ghost" id="btnHome" style="margin-top:16px;">◀ Retour à la fiche</button>
    </div>`;
    document.getElementById("btnHome").onclick = () => { screen = "home"; render(); };
  }

  // ---------------- Render dispatcher ----------------
  async function render() {
    if (screen === "join") return renderJoin();
    if (screen === "onboard") return renderOnboard();
    if (screen === "journal") return renderJournal();
    if (screen === "library") return renderLibrary();
    if (screen === "home") {
      await renderHome();
      if (!vm.civ.tutorialSeen) {
        showTutorial(async () => {
          try { vm = await api("/api/civ/me/tutorial-seen", { method: "POST" }); } catch (e) { /* non-blocking */ }
        });
      }
      return;
    }
    if (screen === "wizard") {
      if (step === 1) return renderStep1();
      if (step === 2) return renderStep2();
      if (step === 3) return renderStep3();
      if (step === 4) return renderStep4();
      if (step === 5) return renderStep5();
    }
  }

  boot();
})();
