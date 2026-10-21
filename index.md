---
layout: default
title: Space Engineers tools
---
<header class="page-heading"><h1>Tools for Space Engineers</h1><p>Open source plugin loaders and server management for players and server owners.</p></header>
<section class="section" aria-labelledby="solutions-title">
  <div class="section-heading"><h2 id="solutions-title">Solutions</h2></div>
  <div class="product-grid">
    <article class="product-card"><span class="category">CLIENT</span><h3>Pulsar</h3><p>Plugin loader for the Space Engineers game client. Install community plugins and customize your game.</p><a class="card-link" href="https://github.com/SpaceGT/Pulsar">Pulsar on GitHub <span aria-hidden="true">↗</span></a></article>
    <article class="product-card"><span class="category">DEDICATED SERVER</span><h3>Magnetar</h3><p>Server loader with CLI plugin support. Host without a UI or build custom orchestration.</p><a class="card-link" href="https://github.com/CometWorks/magnetar">Magnetar on GitHub <span aria-hidden="true">↗</span></a></article>
    <article class="product-card"><span class="category">CONTROL PLANE</span><h3>Quasar</h3><p>Supervisor control plane with a web UI to run and manage Magnetar dedicated servers.</p><a class="card-link" href="https://github.com/CometWorks/quasar">Quasar on GitHub <span aria-hidden="true">↗</span></a></article>
  </div>
</section>
<div class="home-resources">
  <section class="section" aria-labelledby="plugins-title">
    <div class="section-heading"><h2 id="plugins-title">Plugins and mods</h2><a href="{{ '/plugins/' | relative_url }}">Full catalogue <span aria-hidden="true">→</span></a></div>
    <div class="quick-hubs">{% for h in site.data.plugins.hubs %}<a href="{{ '/plugins/' | append: h.key | append: '/' | relative_url }}"><strong>{{ h.title }} <span aria-hidden="true">→</span></strong><span>{{ h.loader }} · {{ h.plugins.size }} plugin{% if h.plugins.size != 1 %}s{% endif %}{% if h.mods.size > 0 %} · {{ h.mods.size }} mod{% if h.mods.size != 1 %}s{% endif %}{% endif %}</span></a>{% endfor %}</div>
    <p class="data-stamp">Refreshed daily · {{ site.data.plugins.generated }}</p>
  </section>
  <section class="section runtime-section" aria-labelledby="support-title"><div class="section-heading"><h2 id="support-title">OS &amp; runtime support</h2></div><dl class="platform-list"><div><dt>Linux</dt><dd>.NET 10</dd></div><div><dt>Windows</dt><dd>.NET 10<br>.NET Framework 4.8</dd></div></dl><p class="data-stamp">Check the catalogue for each plugin’s supported platform and loader flavor.</p></section>
</div>
