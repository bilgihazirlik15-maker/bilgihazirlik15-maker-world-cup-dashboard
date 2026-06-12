const favoriteStorageKey = "worldCupFavoriteTeam";
const $ = id => document.getElementById(id);
const normalize = value => String(value || "").trim().toLocaleLowerCase("en-US");
const normalizeGroup = value => String(value || "").replace(/^group\s+/i, "").trim().toUpperCase();

function splitCsvLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && quoted && line[index + 1] === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      cells.push(cell);
      cell = "";
    } else {
      cell += character;
    }
  }
  cells.push(cell);
  return cells;
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map(header => header.trim());
  return lines.slice(1).map(line => {
    const values = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, (values[index] || "").trim()]));
  });
}

async function loadCsv(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path} yüklenemedi`);
  return parseCsv(await response.text());
}

function parseMatchDate(dateText, timeText = "00:00") {
  const months = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11 };
  const [day, monthName, shortYear] = String(dateText || "").split("-");
  const [hour = 0, minute = 0] = String(timeText || "").split(":").map(Number);
  if (!day || months[monthName] === undefined || !shortYear) return null;
  const date = new Date(2000 + Number(shortYear), months[monthName], Number(day), hour, minute);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isPlayed(match) {
  return match.home_score !== "" && match.away_score !== "" &&
    Number.isFinite(Number(match.home_score)) && Number.isFinite(Number(match.away_score));
}

function includesTeam(match, teamName) {
  const target = normalize(teamName);
  return [match.home_team, match.away_team].some(team => normalize(team) === target);
}

function formatDate(match) {
  const date = parseMatchDate(match.match_date, match.match_time);
  return date ? new Intl.DateTimeFormat("tr-TR", {
    day: "numeric", month: "long", hour: "2-digit", minute: "2-digit"
  }).format(date) : "Tarih belirtilmedi";
}

function stageLabel(match) {
  if (match.stage === "Group") return `Grup ${normalizeGroup(match.group_name)}`;
  return {
    "Round of 32":"Son 32", "Round of 16":"Son 16", "Quarter-final":"Çeyrek final",
    "Semi-final":"Yarı final", "Third place":"Üçüncülük", Final:"Final"
  }[match.stage] || match.stage;
}

function buildTeamStats(teamName, matches) {
  const stats = { played:0, won:0, draw:0, lost:0, gf:0, ga:0, points:0 };
  matches.filter(match => match.stage === "Group" && isPlayed(match) && includesTeam(match, teamName)).forEach(match => {
    const home = normalize(match.home_team) === normalize(teamName);
    const gf = Number(home ? match.home_score : match.away_score);
    const ga = Number(home ? match.away_score : match.home_score);
    stats.played += 1;
    stats.gf += gf;
    stats.ga += ga;
    if (gf > ga) {
      stats.won += 1;
      stats.points += 3;
    } else if (gf === ga) {
      stats.draw += 1;
      stats.points += 1;
    } else {
      stats.lost += 1;
    }
  });
  return { ...stats, gd: stats.gf - stats.ga };
}

function buildGroupStandings(groupTeams, matches) {
  const rows = groupTeams.map(team => ({ team, ...buildTeamStats(team.team_name, matches) }));
  rows.sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.team.team_name.localeCompare(b.team.team_name));
  return rows;
}

function fixtureCard(match, teamName, teamsByName) {
  const home = normalize(match.home_team) === normalize(teamName);
  const opponentName = home ? match.away_team : match.home_team;
  const opponent = teamsByName.get(normalize(opponentName));
  const score = isPlayed(match)
    ? `${home ? match.home_score : match.away_score} - ${home ? match.away_score : match.home_score}`
    : match.match_time || "-";
  let resultClass = "";
  if (isPlayed(match)) {
    const own = Number(home ? match.home_score : match.away_score);
    const other = Number(home ? match.away_score : match.home_score);
    resultClass = own > other ? "result-win" : own === other ? "result-draw" : "result-loss";
  }
  const card = document.createElement("article");
  card.className = `team-fixture ${resultClass}`;
  card.innerHTML = `
    <div class="team-fixture-meta">${formatDate(match)} • ${stageLabel(match)}${match.city ? ` • ${match.city}` : ""}</div>
    <div class="team-fixture-line">
      <div class="team-fixture-opponent">${opponent?.flag ? `<img src="${opponent.flag}" alt="">` : ""}<span>${opponentName}</span></div>
      <div class="team-fixture-score">${score}</div>
    </div>`;
  return card;
}

function renderMatchList(container, matches, teamName, teamsByName, emptyText) {
  container.replaceChildren();
  if (!matches.length) {
    container.innerHTML = `<div class="empty-note">${emptyText}</div>`;
    return;
  }
  matches.forEach(match => container.appendChild(fixtureCard(match, teamName, teamsByName)));
}

function renderGroupTable(group, rows, currentTeam) {
  $("groupTitle").textContent = `Grup ${group} puan durumu`;
  $("teamGroupTable").innerHTML = `
    <table class="group-table">
      <thead><tr><th>#</th><th>Takım</th><th>O</th><th>G</th><th>B</th><th>M</th><th>AG</th><th>YG</th><th>AV</th><th>P</th></tr></thead>
      <tbody>${rows.map((row, index) => `
        <tr class="${normalize(row.team.team_name) === normalize(currentTeam) ? "group-winner" : ""}">
          <td>${index + 1}</td>
          <td>${row.team.flag ? `<img class="flag-icon" src="${row.team.flag}" alt="">` : ""}${row.team.team_name}</td>
          <td>${row.played}</td><td>${row.won}</td><td>${row.draw}</td><td>${row.lost}</td>
          <td>${row.gf}</td><td>${row.ga}</td><td>${row.gd}</td><td>${row.points}</td>
        </tr>`).join("")}</tbody>
    </table>`;
}

function updateFavoriteButton(teamName) {
  let favorite = "";
  try { favorite = localStorage.getItem(favoriteStorageKey) || ""; } catch (error) {}
  const active = normalize(favorite) === normalize(teamName);
  $("favoriteButton").classList.toggle("active", active);
  $("favoriteButton").textContent = active ? "★ Favori takımın" : "☆ Favoriye ekle";
}

async function init() {
  try {
    const requestedTeam = new URLSearchParams(location.search).get("team") || "";
    const [teams, matches] = await Promise.all([loadCsv("teams.csv"), loadCsv("matches.csv")]);
    const team = teams.find(item => normalize(item.team_name) === normalize(requestedTeam));
    if (!team) throw new Error("Takım bulunamadı");

    const teamMatches = matches.filter(match => includesTeam(match, team.team_name));
    const upcoming = teamMatches.filter(match => !isPlayed(match)).sort((a, b) => parseMatchDate(a.match_date, a.match_time) - parseMatchDate(b.match_date, b.match_time));
    const results = teamMatches.filter(isPlayed).sort((a, b) => parseMatchDate(b.match_date, b.match_time) - parseMatchDate(a.match_date, a.match_time));
    const stats = buildTeamStats(team.team_name, matches);
    const teamsByName = new Map(teams.map(item => [normalize(item.team_name), item]));
    const group = normalizeGroup(team.group_name);
    const groupRows = buildGroupStandings(teams.filter(item => normalizeGroup(item.group_name) === group), matches);

    document.title = `${team.team_name} | 2026 Dünya Kupası`;
    $("teamName").textContent = team.team_name;
    $("teamGroup").textContent = `Grup ${group} • ${team.short_name || ""}`;
    $("teamStatus").textContent = `${team.team_name} takımının fikstürü, sonuçları ve grup performansı.`;
    $("teamFlag").src = team.flag || "logo.webp";
    $("teamFlag").alt = `${team.team_name} bayrağı`;
    $("playedStat").textContent = stats.played;
    $("wonStat").textContent = stats.won;
    $("pointsStat").textContent = stats.points;
    $("nextMatchStat").textContent = upcoming[0]
      ? `${upcoming[0].home_team} - ${upcoming[0].away_team} • ${formatDate(upcoming[0])}`
      : "Planlanmış maç bulunmuyor";

    renderMatchList($("upcomingMatches"), upcoming, team.team_name, teamsByName, "Yaklaşan maç bulunmuyor.");
    renderMatchList($("resultMatches"), results, team.team_name, teamsByName, "Henüz tamamlanan maç bulunmuyor.");
    renderGroupTable(group, groupRows, team.team_name);

    $("favoriteButton").addEventListener("click", () => {
      let favorite = "";
      try { favorite = localStorage.getItem(favoriteStorageKey) || ""; } catch (error) {}
      try {
        normalize(favorite) === normalize(team.team_name)
          ? localStorage.removeItem(favoriteStorageKey)
          : localStorage.setItem(favoriteStorageKey, team.team_name);
      } catch (error) {}
      updateFavoriteButton(team.team_name);
    });
    updateFavoriteButton(team.team_name);
    $("pageStatus").className = "status success";
    $("pageStatus").textContent = "Takım bilgileri yüklendi.";
  } catch (error) {
    $("pageStatus").className = "status error";
    $("pageStatus").textContent = `Hata: ${error.message}`;
    $("teamName").textContent = "Takım bulunamadı";
  }
}

init();
