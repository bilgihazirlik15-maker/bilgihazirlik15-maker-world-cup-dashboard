(() => {
  let latestStandings = new Map();
  const baseRenderGroups = renderGroups;
  const baseRenderBracket = renderBracket;

  const style = document.createElement("style");
  style.textContent = `
    .third-place-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
    .third-place-card{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px;padding:12px;background:linear-gradient(145deg,var(--panel),var(--panel-soft));border:1px solid #31547e;border-radius:13px}
    .third-place-qualified{background:linear-gradient(145deg,rgba(11,81,62,.86),rgba(12,104,76,.52));border-color:var(--green)}
    .third-place-rank{display:grid;width:28px;height:28px;place-items:center;color:#a9cdf7;background:#071426;border-radius:50%;font-size:.72rem;font-weight:850}
    .third-place-team{display:flex;min-width:0;flex-direction:column;gap:3px;font-size:.76rem}
    .third-place-team span,.third-place-points span,.third-place-detail{color:var(--muted);font-size:.64rem}
    .third-place-points{display:flex;flex-direction:column;align-items:flex-end;font-size:1rem;font-weight:850}
    .third-place-detail{grid-column:2/-1}
    .podium{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:18px}
    .podium-card{display:flex;min-height:82px;flex-direction:column;justify-content:center;gap:7px;padding:15px;background:linear-gradient(145deg,var(--panel),var(--panel-soft));border:1px solid #31547e;border-radius:14px;text-align:center}
    .podium-card span{color:var(--muted);font-size:.68rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
    .podium-champion{border-color:var(--gold);box-shadow:0 12px 30px rgba(247,201,72,.1)}
    @media(max-width:1200px){.third-place-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:800px){.podium{grid-template-columns:1fr}}
    @media(max-width:620px){.third-place-grid{grid-template-columns:1fr}}
  `;
  document.head.append(style);

  const bracketSection = document.getElementById("bracket").closest(".content-section");
  const thirdSection = document.createElement("section");
  thirdSection.className = "content-section";
  thirdSection.innerHTML = `
    <div class="section-heading">
      <div><div class="eyebrow">Son 32 yarışı</div><h2>En iyi grup üçüncüleri</h2></div>
      <p id="thirdPlaceNote" class="section-note">Grup maçları oynandıkça ilk sekiz takım vurgulanır.</p>
    </div>
    <div id="thirdPlaceGrid" class="third-place-grid"></div>
  `;
  bracketSection.after(thirdSection);

  const podium = document.createElement("div");
  podium.id = "podium";
  podium.className = "podium";
  bracketSection.append(podium);

  function compareRows(a, b) {
    return b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.team.localeCompare(b.team);
  }

  function groupComplete(rows) {
    return rows.length === 4 && rows.every(row => row.played === 3);
  }

  function thirdPlaceRanking(standings) {
    const rows = [...standings].map(([group, groupRows]) => ({
      ...groupRows[2],
      group,
      groupComplete: groupComplete(groupRows)
    })).filter(row => row.team).sort(compareRows);
    const hasResults = rows.some(row => row.played > 0);
    return {
      rows,
      hasResults,
      complete: rows.length === 12 && rows.every(row => row.groupComplete),
      qualified: new Set(hasResults ? rows.slice(0, 8).map(row => normalize(row.team)) : [])
    };
  }

  function renderThirdPlaces(ranking) {
    document.getElementById("thirdPlaceNote").textContent = ranking.complete
      ? "Grup aşaması tamamlandı. İlk sekiz takım Son 32 turuna katılır."
      : ranking.hasResults
        ? "Geçici sıralama: grup maçları tamamlandıkça değişebilir."
        : "Sıralama, ilk grup sonuçları girildiğinde otomatik olarak başlayacak.";

    document.getElementById("thirdPlaceGrid").innerHTML = ranking.rows.map((row, index) => {
      const qualified = ranking.qualified.has(normalize(row.team));
      return `
        <article class="third-place-card ${qualified ? "third-place-qualified" : ""}">
          <div class="third-place-rank">${index + 1}</div>
          <div class="third-place-team"><strong>${teamWithFlag(row.team)}</strong><span>Grup ${escapeHtml(row.group)}${qualified ? " &bull; Son 32" : ""}</span></div>
          <div class="third-place-points">${row.points}<span>puan</span></div>
          <div class="third-place-detail">AV ${row.gd >= 0 ? "+" : ""}${row.gd} &bull; AG ${row.gf}</div>
        </article>
      `;
    }).join("");
  }

  renderGroups = standings => {
    latestStandings = standings;
    baseRenderGroups(standings);
    const ranking = thirdPlaceRanking(standings);
    const cards = [...document.querySelectorAll(".group-card")];
    [...standings].sort(([a], [b]) => a.localeCompare(b)).forEach(([, rows], index) => {
      const thirdRow = cards[index]?.querySelector("tbody tr:nth-child(3)");
      if (thirdRow && ranking.qualified.has(normalize(rows[2].team))) thirdRow.classList.add("group-qualified");
    });
    renderThirdPlaces(ranking);
  };

  function winnerTeam(match) {
    const winner = knockoutWinner(match);
    return winner ? match[`${winner}_team`] : "";
  }

  function loserTeam(match) {
    const winner = knockoutWinner(match);
    if (!winner) return "";
    return winner === "home" ? match.away_team : match.home_team;
  }

  function groupParticipant(label) {
    const winner = String(label).match(/^Winner Group ([A-L])$/i);
    const runnerUp = String(label).match(/^Runner-up Group ([A-L])$/i);
    const reference = winner || runnerUp;
    if (!reference) return "";
    const rows = latestStandings.get(reference[1].toUpperCase());
    if (!rows || !groupComplete(rows)) return "";
    return rows[winner ? 0 : 1]?.team || "";
  }

  function resolveParticipants(matches) {
    let resolved = matches.map(match => ({ ...match }));
    for (let pass = 0; pass < 4; pass += 1) {
      const byId = new Map(resolved.map(match => [String(match.match_id), match]));
      const semiFinals = resolved.filter(match => match.stage === "Semi-final")
        .sort((a, b) => parseMatchDate(a.match_date, a.match_time) - parseMatchDate(b.match_date, b.match_time));

      const resolveLabel = label => {
        const groupTeam = groupParticipant(label);
        if (groupTeam) return groupTeam;
        const matchReference = String(label).match(/^(Winner|Loser) Match (\d+)$/i);
        if (matchReference) {
          const source = byId.get(matchReference[2]);
          return source ? (matchReference[1].toLowerCase() === "winner" ? winnerTeam(source) : loserTeam(source)) : "";
        }
        const semiReference = String(label).match(/^Semi-final (Winner|Loser) (\d+)$/i);
        if (semiReference) {
          const source = semiFinals[Number(semiReference[2]) - 1];
          return source ? (semiReference[1].toLowerCase() === "winner" ? winnerTeam(source) : loserTeam(source)) : "";
        }
        return "";
      };

      resolved = resolved.map(match => ({
        ...match,
        home_team: resolveLabel(match.home_team) || match.home_team,
        away_team: resolveLabel(match.away_team) || match.away_team
      }));
    }
    return resolved;
  }

  function renderPodium(matches) {
    const final = matches.find(match => match.stage === "Final");
    const thirdPlace = matches.find(match => match.stage === "Third place");
    const champion = final ? winnerTeam(final) : "";
    const runnerUp = final ? loserTeam(final) : "";
    const third = thirdPlace ? winnerTeam(thirdPlace) : "";
    podium.innerHTML = `
      <article class="podium-card podium-champion"><span>Şampiyon</span><strong>${champion ? teamWithFlag(champion) : "Final sonucu bekleniyor"}</strong></article>
      <article class="podium-card"><span>Finalist</span><strong>${runnerUp ? teamWithFlag(runnerUp) : "Final sonucu bekleniyor"}</strong></article>
      <article class="podium-card"><span>Üçüncü</span><strong>${third ? teamWithFlag(third) : "Üçüncülük sonucu bekleniyor"}</strong></article>
    `;
  }

  renderBracket = matches => {
    const resolved = resolveParticipants(matches);
    baseRenderBracket(resolved);
    renderPodium(resolved);
  };
})();
