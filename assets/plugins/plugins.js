// Search and "your setup" filters of the plugin list pages. Entries that can't run
// on the picked flavor and platform are grayed out with the reason, like in game.
for (const list of document.querySelectorAll(".plugin-list")) {
  const form = list.querySelector(".plugin-filters");
  const loader = list.dataset.loader;
  const tables = [...list.querySelectorAll(".plugin-table")].map((table) => ({
    tbody: table.tBodies[0],
    count: table.previousElementSibling.querySelector(".plugin-count"),
    empty: table.nextElementSibling,
    rows: [...table.tBodies[0].rows].map((row) => ({
      row,
      text: row.textContent.toLowerCase(),
      reason: row.querySelector(".plugin-reason"),
      envs: row.dataset.envs.split(" ").filter(Boolean).map((e) => {
        const [flavor, platform] = e.split("/");
        return { flavor, platform };
      }),
    })),
  }));

  const update = () => {
    const query = form.q.value.trim().toLowerCase();
    const flavor = form.flavor ? form.flavor.value : "";
    const platform = form.platform.value;
    for (const table of tables) {
      let shown = 0;
      const fits = [];
      const misfits = [];
      for (const entry of table.rows) {
        const reason = entry.row.dataset.reason || whyUnavailable(entry.envs, flavor, platform);
        entry.row.classList.toggle("unavailable", !!reason);
        entry.reason.textContent = reason || "";
        entry.row.hidden = (query && !entry.text.includes(query)) || (form.hide.checked && !!reason);
        if (!entry.row.hidden) shown++;
        (reason ? misfits : fits).push(entry.row);
      }
      table.tbody.append(...fits, ...misfits);
      table.empty.hidden = shown !== 0;
      table.count.textContent = shown === table.rows.length ? shown : `${shown} of ${table.rows.length}`;
    }
  };

  const whyUnavailable = (envs, flavor, platform) => {
    if (envs.some((e) => (!flavor || e.flavor === flavor) && (!platform || e.platform === platform)))
      return null;
    const join = (values) => [...new Set(values)].join(" or ");
    if (platform && !envs.some((e) => e.platform === platform))
      return `Unavailable: needs ${join(envs.map((e) => e.platform))}, not ${platform}`;
    if (flavor && !envs.some((e) => e.flavor === flavor))
      return `Unavailable: needs ${loader} ${join(envs.map((e) => e.flavor))}, not ${flavor}`;
    const platforms = envs.filter((e) => e.flavor === flavor).map((e) => e.platform);
    return `Unavailable: ${flavor} needs ${join(platforms)}, not ${platform}`;
  };

  form.addEventListener("input", update);
  // The reset event fires before the browser restores the controls.
  form.addEventListener("reset", () => setTimeout(update, 0));
  form.addEventListener("submit", (event) => event.preventDefault());
  form.hidden = false;
  update();
}
