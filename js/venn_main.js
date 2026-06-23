//Data + State
let RAW = null;  // loaded JSON
let selected = ['MNZ11', 'TIGR4', 'D39'];
let odThreshold = 0.3;
let timeMaxIdx = 119;

const PALETTE = ['#e05a5a', '#4a7cdc', '#2db37e', '#f5a623'];

fetch('../data/venn.json')
  .then(r => r.json())
  .then(d => {
    RAW = d;
    timeMaxIdx = d.timePoints.length - 1;
    const ts = document.getElementById('time-slider');
    ts.max = timeMaxIdx;
    ts.value = timeMaxIdx;
    buildControls();
    render();
  });

const buildControls = () => {
  buildStrainList();
  buildSelectedTags();

  document.getElementById('od-slider').addEventListener('input', e => {
    odThreshold = +e.target.value;
    document.getElementById('od-val').textContent = odThreshold.toFixed(2);
    render();
  });

  document.getElementById('time-slider').addEventListener('input', e => {
    timeMaxIdx = +e.target.value;
    document.getElementById('time-val').textContent = RAW.timePoints[timeMaxIdx].toFixed(1);
    render();
  });
};

const buildSelectedTags = () => {
  const el = document.getElementById('selected-tags');
  el.innerHTML = '';
  selected.forEach((s, i) => {
    const tag = document.createElement('div');
    tag.className = 'strain-tag';
    tag.style.background = PALETTE[i];
    tag.innerHTML = `${s} <button class="remove-btn" title="Remove">✕</button>`;
    tag.querySelector('.remove-btn').addEventListener('click', () => {
      if (selected.length <= 2) return; // min 2
      selected = selected.filter(x => x !== s);
      buildSelectedTags();
      buildStrainList();
      render();
    });
    el.appendChild(tag);
  });
};

const buildStrainList = () => {
  const el = document.getElementById('strain-list');
  el.innerHTML = '';
  RAW.strains.forEach(s => {
    if (selected.includes(s)) return; // already selected
    const row = document.createElement('label');
    row.className = 'strain-check' + (selected.length >= 3 ? ' disabled' : '');
    row.innerHTML = `<input type="checkbox"> ${s}`;
    row.querySelector('input').addEventListener('change', e => {
      if (e.target.checked) {
        if (selected.length >= 3) { e.target.checked = false; return; }
        selected.push(s);
        buildSelectedTags();
        buildStrainList();
        render();
      }
    });
    el.appendChild(row);
  });
};

//Data Computation
const getActiveSubstrates = (strain) => {
  // Returns Set of substrates where max OD in time window >= threshold
  const active = new Set();
  const strainData = RAW.data[strain];
  if (!strainData) return active;
  for (const [substrate, values] of Object.entries(strainData)) {
    const slice = values.slice(0, timeMaxIdx + 1);
    if (Math.max(...slice) >= odThreshold) active.add(substrate);
  }
  return active;
};

const computeSets = () => {
  const sets = selected.map(s => ({ strain: s, active: getActiveSubstrates(s) }));
  const n = sets.length;

  // All region keys: bitmask where bit i = strain i is included
  const regions = {};
  for (let mask = 1; mask < (1 << n); mask++) {
    regions[mask] = [];
  }

  RAW.substrates.forEach(sub => {
    let mask = 0;
    sets.forEach(({ active }, i) => {
      if (active.has(sub)) mask |= (1 << i);
    });
    if (mask > 0) regions[mask].push(sub);
  });

  return { sets, regions, n };
};

//SVG Venn Rendering
const svg = d3.select('#venn-svg');

const render = () => {
  svg.selectAll('*').remove();
  hideSubstratePanel();

  if (selected.length < 2) return;

  const { sets, regions, n } = computeSets();

  const W = 700, H = 580;
  svg.attr('viewBox', `0 0 ${W} ${H}`);

  const g = svg.append('g');
  const R = n === 2 ? 170 : 155;  // circle radius

  // Circle centers
  const centers = circleLayout(n, W, H, R);

  // Draw defs for clip paths
  const defs = svg.append('defs');
  centers.forEach((c, i) => {
    defs.append('clipPath')
      .attr('id', `clip-${i}`)
      .append('circle')
      .attr('cx', c.x).attr('cy', c.y).attr('r', R);
  });

  // Draw filled circles
  centers.forEach((c, i) => {
    g.append('circle')
      .attr('class', 'venn-circle')
      .attr('cx', c.x).attr('cy', c.y).attr('r', R)
      .attr('fill', PALETTE[i]);
  });

  // Draw interactive regions (hit areas + labels)
  for (let mask = 1; mask < (1 << n); mask++) {
    const subs = regions[mask];
    const isEmpty = subs.length === 0;

    // Compute region centroid for label placement
    const pos = regionCentroid(mask, n, centers, R);

    // Grey null overlay for empty regions using a rect clipped to the intersection
    if (isEmpty) {
      const clipId = `null-clip-${mask}`;
      buildIntersectionClip(defs, clipId, mask, n, centers, R, W, H);
      g.append('rect')
        .attr('class', 'null-overlay')
        .attr('x', 0).attr('y', 0).attr('width', W).attr('height', H)
        .attr('clip-path', `url(#${clipId})`);
    }

    // Invisible hit region
    const clipId2 = `hit-clip-${mask}`;
    buildIntersectionClip(defs, clipId2, mask, n, centers, R, W, H);

    const hit = g.append('rect')
      .attr('class', 'venn-region-hit')
      .attr('x', 0).attr('y', 0).attr('width', W).attr('height', H)
      .attr('clip-path', `url(#hit-clip-${mask})`)
      .datum({ mask, subs, pos });

    // Hover
    hit.on('mousemove', (event, d) => {
      const tooltip = document.getElementById('region-tooltip');
      const area = document.getElementById('diagram-area');
      const areaRect = area.getBoundingClientRect();
      const strainNames = maskToStrains(d.mask, n, sets);
      tooltip.textContent = strainNames.join(' ∩ ') + `: ${d.subs.length} substrate${d.subs.length !== 1 ? 's' : ''}`;
      tooltip.classList.add('visible');
      tooltip.style.left = (event.clientX - areaRect.left + 12) + 'px';
      tooltip.style.top = (event.clientY - areaRect.top + 12) + 'px';
    })
      .on('mouseleave', () => {
        document.getElementById('region-tooltip').classList.remove('visible');
      })
      .on('click', (event, d) => {
        svg.selectAll('.venn-region-hit').classed('active', false);
        d3.select(event.currentTarget).classed('active', true);
        showSubstratePanel(d.mask, d.subs, n, sets);
        event.stopPropagation();
      });

    // Count label
    g.append('text')
      .attr('class', 'region-label' + (isEmpty ? ' empty' : ''))
      .attr('x', pos.x).attr('y', pos.y)
      .text(subs.length);
  }

  // Strain name labels (outside circles)
  centers.forEach((c, i) => {
    const lx = c.lx !== undefined ? c.lx : c.x;
    const ly = c.ly !== undefined ? c.ly : c.y - R - 18;
    g.append('text')
      .attr('class', 'strain-label')
      .attr('x', lx).attr('y', ly)
      .text(sets[i].strain);
  });

  // Deselect on background click
  svg.on('click', () => {
    svg.selectAll('.venn-region-hit').classed('active', false);
    hideSubstratePanel();
  });
};

//Geometry Helpers
const circleLayout = (n, W, H, R) => {
  const cx = W / 2, cy = H / 2;
  if (n === 2) {
    const d = R * 0.9; // overlap distance
    return [
      { x: cx - d / 2, y: cy, lx: cx - d / 2 - R * 0.25, ly: cy - R - 18 },
      { x: cx + d / 2, y: cy, lx: cx + d / 2 + R * 0.25, ly: cy - R - 18 },
    ];
  }
  // 3 circles in triangle
  const offset = R * 0.62;
  return [
    { x: cx - offset, y: cy + offset * 0.55, lx: cx - offset - R * 0.3, ly: cy + offset * 0.55 + R + 16 },
    { x: cx + offset, y: cy + offset * 0.55, lx: cx + offset + R * 0.3, ly: cy + offset * 0.55 + R + 16 },
    { x: cx, y: cy - offset * 0.9, lx: cx, ly: cy - offset * 0.9 - R - 16 },
  ];
};

// Centroid of a region (mask) for label placement
const regionCentroid = (mask, n, centers, R) => {
  const bits = maskBits(mask, n);
  const exclBits = [];
  for (let i = 0; i < n; i++) if (!(mask & (1 << i))) exclBits.push(i);

  // Base: centroid of "in" circle centers
  let x = 0, y = 0;
  bits.forEach(i => { x += centers[i].x; y += centers[i].y; });
  x /= bits.length;
  y /= bits.length;

  if (exclBits.length === 0) return { x, y }; // full intersection (e.g. ABC) — center is correct

  // Push the base position away from every excluded circle so the label
  // lands inside the correct exclusive / partial-intersection region.
  let dx = 0, dy = 0;
  exclBits.forEach(i => { dx += x - centers[i].x; dy += y - centers[i].y; });
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  // Single-circle exclusive regions need a stronger push than pairwise intersections
  const push = bits.length === 1 ? R * 0.5 : R * 0.38;
  return { x: x + (dx / len) * push, y: y + (dy / len) * push };
};

const maskBits = (mask, n) => {
  const bits = [];
  for (let i = 0; i < n; i++) if (mask & (1 << i)) bits.push(i);
  return bits;
};

const maskToStrains = (mask, n, sets) => maskBits(mask, n).map(i => sets[i].strain);

// Build a clip path that is the intersection of the specified circles (mask bits = in), minus excluded (mask bits = 0)
const buildIntersectionClip = (defs, id, mask, n, centers, R, W, H) => {
  const bits = maskBits(mask, n);
  const excl = [];
  for (let i = 0; i < n; i++) if (!(mask & (1 << i))) excl.push(i);

  if (bits.length === 1 && excl.length === 0) {
    // Simple single-circle clip
    const cp = defs.append('clipPath').attr('id', id);
    const c = centers[bits[0]];
    cp.append('circle').attr('cx', c.x).attr('cy', c.y).attr('r', R);
    return;
  }

  // Build intersection clip chain
  let prevClipId = null;
  bits.forEach((bi, idx) => {
    const chainId = `${id}_c${idx}`;
    const cp = defs.append('clipPath').attr('id', chainId);
    if (prevClipId) cp.attr('clip-path', `url(#${prevClipId})`);
    const c = centers[bi];
    cp.append('circle').attr('cx', c.x).attr('cy', c.y).attr('r', R);
    prevClipId = chainId;
  });

  // Final clip: apply the intersection result, then mask out exclusion circles via even-odd path
  const finalCp = defs.append('clipPath').attr('id', id);
  if (prevClipId) finalCp.attr('clip-path', `url(#${prevClipId})`);

  if (excl.length === 0) {
    finalCp.append('rect').attr('x', 0).attr('y', 0).attr('width', W).attr('height', H);
  } else {
    let pathStr = `M0,0 H${W} V${H} H0 Z`;
    excl.forEach(ei => {
      const c = centers[ei];
      pathStr += circlePathStr(c.x, c.y, R);
    });
    finalCp.append('path')
      .attr('d', pathStr)
      .attr('fill-rule', 'evenodd')
      .attr('clip-rule', 'evenodd');
  }
};

const circlePathStr = (cx, cy, r) =>
  // SVG path string for a circle using two arcs
  `M${cx - r},${cy} A${r},${r} 0 1,0 ${cx + r},${cy} A${r},${r} 0 1,0 ${cx - r},${cy} Z`;

const showSubstratePanel = (mask, subs, n, sets) => {
  const panel = document.getElementById('substrate-panel');
  const title = document.getElementById('substrate-panel-title');
  const list = document.getElementById('substrate-list');

  const strainNames = maskToStrains(mask, n, sets);
  title.textContent = strainNames.join(' ∩ ');

  list.innerHTML = '';
  if (subs.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty-msg';
    li.textContent = 'No substrates in this region';
    list.appendChild(li);
  } else {
    subs.forEach(s => {
      const li = document.createElement('li');
      li.textContent = s;
      list.appendChild(li);
    });
  }

  panel.classList.remove('hidden');
};

const hideSubstratePanel = () => {
  document.getElementById('substrate-panel').classList.add('hidden');
};

document.getElementById('substrate-panel-close').addEventListener('click', () => {
  hideSubstratePanel();
  svg.selectAll('.venn-region-hit').classed('active', false);
});
