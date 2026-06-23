//Data + State
let RAW = null;
let seriesByKey = null;
let color = null;
let tooltipX, tooltipY, tooltipLine, tooltipPath, tooltipPeak, tooltipDot;

fetch('../data/heatmap.json')
  .then(r => r.json())
  .then(d => {
    RAW = d;
    seriesByKey = new Map(d.series.map(s => [s.label, s]));
    color = d3.scaleSequential(d3.interpolateViridis).domain([d.global_min, d.global_max]);
    buildLegend();
    buildTooltipChart();
    buildHeatmap();
  });

//Legend
const buildLegend = () => {
  const legendSvg = d3.select('#legend-svg');
  const lw = +legendSvg.attr('width'), lh = +legendSvg.attr('height');
  const grad = legendSvg.append('defs').append('linearGradient')
    .attr('id', 'leg-grad').attr('x1', '0%').attr('x2', '100%');
  d3.range(0, 1.001, 0.05).forEach(t =>
    grad.append('stop')
      .attr('offset', (t * 100) + '%')
      .attr('stop-color', color(RAW.global_min + t * (RAW.global_max - RAW.global_min)))
  );
  legendSvg.append('rect').attr('width', lw).attr('height', lh).attr('rx', 3)
    .attr('fill', 'url(#leg-grad)');
};

//Tooltip Chart
const buildTooltipChart = () => {
  const tooltipSvg = d3.select('#ttSvg');
  const svgWidth = +tooltipSvg.attr('width'), svgHeight = +tooltipSvg.attr('height');
  const margin = { top: 8, right: 10, bottom: 22, left: 34 };
  const innerWidth = svgWidth - margin.left - margin.right;
  const innerHeight = svgHeight - margin.top - margin.bottom;
  const chartGroup = tooltipSvg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const times = RAW.times.map(Number);
  tooltipX = d3.scaleLinear().domain(d3.extent(times)).range([0, innerWidth]);
  tooltipY = d3.scaleLinear().domain([0, RAW.global_max]).nice().range([innerHeight, 0]);

  chartGroup.append('g').attr('class', 'axis').attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(tooltipX).ticks(5));
  chartGroup.append('g').attr('class', 'axis')
    .call(d3.axisLeft(tooltipY).ticks(4));

  tooltipLine = d3.line().x(d => tooltipX(d.t)).y(d => tooltipY(d.v));
  tooltipPath = chartGroup.append('path').attr('fill', 'none')
    .attr('stroke', 'rgba(17,17,17,0.8)').attr('stroke-width', 1.6);
  tooltipPeak = chartGroup.append('line')
    .attr('stroke', 'rgba(17,17,17,0.3)').attr('stroke-width', 1)
    .attr('stroke-dasharray', '3,3').attr('y1', 0).attr('y2', innerHeight);
  tooltipDot = chartGroup.append('circle').attr('r', 3.2)
    .attr('fill', 'rgba(17,17,17,0.9)')
    .attr('stroke', 'rgba(255,255,255,0.9)').attr('stroke-width', 1.4);
};

//Heatmap Layout
const buildHeatmap = () => {
  const GRID_SIDE = 900;
  const cols = RAW.cols;
  const rows = RAW.rows;
  const cellGap = 2;
  const n = Math.max(cols.length, rows.length);
  const cellSize = Math.max(14, Math.floor((GRID_SIDE - cellGap * (n - 1)) / n));
  const fontSize = Math.max(7, Math.floor(cellSize * 0.22));

  const margin = { top: 165, right: 20, bottom: 20, left: 90 };
  const gridW = cols.length * cellSize + (cols.length - 1) * cellGap;
  const gridH = rows.length * cellSize + (rows.length - 1) * cellGap;
  const svgW = margin.left + gridW + margin.right;
  const svgH = margin.top + gridH + margin.bottom;

  // index-based position helpers — no scaleBand needed
  const xPos = i => margin.left + i * (cellSize + cellGap);
  const yPos = i => margin.top + i * (cellSize + cellGap);
  const colIdx = new Map(cols.map((c, i) => [c, i]));
  const rowIdx = new Map(rows.map((r, i) => [r, i]));

  const svg = d3.select('#chart').append('svg')
    .attr('width', svgW).attr('height', svgH);

  // Column axis (top, rotated labels)
  const colAxis = svg.append('g').attr('class', 'axis');
  cols.forEach((c, i) => {
    const cx = xPos(i) + cellSize / 2;
    colAxis.append('line')
      .attr('x1', cx).attr('x2', cx)
      .attr('y1', margin.top - 4).attr('y2', margin.top)
      .attr('stroke', 'rgba(0,0,0,0.15)');
    colAxis.append('text')
      .attr('transform', `translate(${cx},${margin.top - 8}) rotate(-60)`)
      .attr('text-anchor', 'beginning')
      .attr('dominant-baseline', 'middle')
      .attr('fill', 'rgba(17,17,17,0.75)')
      .attr('font-size', 11)
      .text(c);
  });

  // Row axis (left)
  const rowAxis = svg.append('g').attr('class', 'axis');
  rows.forEach((r, i) => {
    const cy = yPos(i) + cellSize / 2;
    rowAxis.append('line')
      .attr('x1', margin.left - 4).attr('x2', margin.left)
      .attr('y1', cy).attr('y2', cy)
      .attr('stroke', 'rgba(0,0,0,0.15)');
    rowAxis.append('text')
      .attr('x', margin.left - 8)
      .attr('y', cy)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .attr('fill', 'rgba(17,17,17,0.75)')
      .attr('font-size', 11)
      .text(r);
  });

  // Cells
  svg.append('g')
    .selectAll('rect')
    .data(RAW.cells, d => d.strain + '|' + d.carb)
    .join('rect')
    .attr('class', 'cell')
    .attr('x', d => xPos(colIdx.get(d.carb)))
    .attr('y', d => yPos(rowIdx.get(d.strain)))
    .attr('width', cellSize)
    .attr('height', cellSize)
    .attr('rx', Math.max(2, Math.floor(cellSize * 0.12)))
    .attr('fill', d => color(d.max))
    .on('mouseenter', (event, d) => {
      const series = seriesByKey.get(d.series_label);
      if (!series) return;
      const tooltip = d3.select('#tooltip');
      tooltip.style('display', 'block');
      d3.select('#ttTitle').text(`${d.strain} · ${d.carb}`);
      const peak = series.values.reduce((b, c) => c.v > b.v ? c : b, series.values[0]);
      d3.select('#ttMeta').text(`peak = ${d.max.toFixed(3)} at t = ${peak.t} h`);
      tooltipPath.attr('d', tooltipLine(series.values));
      tooltipPeak.attr('x1', tooltipX(peak.t)).attr('x2', tooltipX(peak.t));
      tooltipDot.attr('cx', tooltipX(peak.t)).attr('cy', tooltipY(peak.v));
    })
    .on('mousemove', event => {
      const pad = 14;
      const { clientX, clientY } = event;
      const tooltip = d3.select('#tooltip');
      const tb = tooltip.node().getBoundingClientRect();
      let xp = clientX + pad, yp = clientY + pad;
      if (xp + tb.width > window.innerWidth) xp = clientX - tb.width - pad;
      if (yp + tb.height > window.innerHeight) yp = clientY - tb.height - pad;
      tooltip.style('left', xp + 'px').style('top', yp + 'px');
    })
    .on('mouseleave', () => d3.select('#tooltip').style('display', 'none'));

  // Value labels inside cells (skipped when cells are too small)
  if (cellSize >= 18) {
    svg.append('g')
      .selectAll('text')
      .data(RAW.cells, d => d.strain + '|' + d.carb)
      .join('text')
      .attr('x', d => xPos(colIdx.get(d.carb)) + cellSize / 2)
      .attr('y', d => yPos(rowIdx.get(d.strain)) + cellSize / 2)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', 'rgba(255,255,255,0.9)')
      .attr('font-size', fontSize)
      .attr('font-weight', 700)
      .text(d => d.max.toFixed(2));
  }
};
