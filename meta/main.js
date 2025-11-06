// 1) Import D3 (ESM)
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

// ---------- Data loading ----------
async function loadData() {
  const data = await d3.csv('loc.csv', (row) => ({
    ...row,
    line: Number(row.line),
    depth: Number(row.depth),
    length: Number(row.length),
    date: new Date(row.date + 'T00:00' + row.timezone),
    datetime: new Date(row.datetime),
  }));
  return data;
}

// ---------- Commit processing ----------
function processCommits(data) {
  return d3
    .groups(data, (d) => d.commit)
    .map(([commit, lines]) => {
      const f = lines[0];
      const ret = {
        id: commit,
        url: `https://github.com/matthew-vaught/portfolio/commit/${commit}`,
        author: f.author,
        date: f.date,
        time: f.time,
        timezone: f.timezone,
        datetime: f.datetime,
        hourFrac: f.datetime.getHours() + f.datetime.getMinutes() / 60,
        totalLines: lines.length,
      };
      // keep original lines (hidden)
      Object.defineProperty(ret, { 
        value: lines, enumerable: false, writable: false, configurable: false 
      });
      Object.defineProperty(ret, 'lines', {
        value: lines, enumerable: false, writable: false, configurable: false
      });
      return ret;
    });
}

// ---------- Summary stats ----------
function renderCommitInfo(data, commits) {
  const dl = d3.select('#stats').append('dl').attr('class', 'stats');

  const totalLOC = data.length;
  const totalCommits = commits.length;
  const filesCount = d3.group(data, d => d.file).size;
  const maxDepth = d3.max(data, d => d.depth);
  const longestLine = d3.max(data, d => d.length);

  const perFileMaxLine = d3.rollups(
    data,
    v => d3.max(v, d => d.line),
    d => d.file
  );
  const maxLines = d3.max(perFileMaxLine, d => d[1]);
  const avgFileLength = Math.round(d3.mean(perFileMaxLine, d => d[1]));

  const workByPeriod = d3.rollups(
    data,
    v => v.length,
    d => new Date(d.datetime).toLocaleString('en', { dayPeriod: 'short' })
  );
  const mostActivePeriod = d3.greatest(workByPeriod, d => d[1])?.[0] ?? 'n/a';

  const row = (label, value, useHtml=false) => {
    useHtml ? dl.append('dt').html(label) : dl.append('dt').text(label);
    dl.append('dd').text(value);
  };

  row('Total <abbr title="Lines of code">LOC</abbr>', totalLOC, true);
  row('Total commits', totalCommits);
  row('Files', filesCount);
  row('Max depth', maxDepth);
  row('Longest line', longestLine);
  row('Max lines (file)', maxLines);
  row('Avg file length', avgFileLength);
  row('Most active period', mostActivePeriod);
}

// ---------- Tooltip helpers ----------
function renderTooltipContent(commit) {
  if (!commit || Object.keys(commit).length === 0) return;

  const link   = document.getElementById('commit-link');
  const dateEl = document.getElementById('commit-date');
  const timeEl = document.getElementById('commit-time');
  const authEl = document.getElementById('commit-author');
  const linesEl= document.getElementById('commit-lines');

  link.href = commit.url;
  link.textContent = commit.id;
  dateEl.textContent = commit.datetime.toLocaleString('en', { dateStyle: 'full' });
  timeEl.textContent = commit.datetime.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
  authEl.textContent = commit.author ?? '—';
  linesEl.textContent = String(commit.totalLines ?? commit.lines?.length ?? '—');
}
function updateTooltipVisibility(show) {
  const tip = document.getElementById('commit-tooltip');
  tip.classList.toggle('visible', !!show);
}
function updateTooltipPosition(event) {
  const tip = document.getElementById('commit-tooltip');
  const OFFSET = 12;
  tip.style.left = `${event.clientX + OFFSET}px`;
  tip.style.top  = `${event.clientY + OFFSET}px`;
}

// ---------- Globals used by brush selection ----------
let xScale;  // assigned inside renderScatterPlot
let yScale;
let commitsGlobal = []; // for selection-based summaries

// Is a commit inside current brush selection?
function isCommitSelected(selection, commit) {
  if (!selection) return false;
  const [x0, x1] = selection.map(d => d[0]);
  const [y0, y1] = selection.map(d => d[1]);

  const x = xScale(commit.datetime);
  const y = yScale(commit.hourFrac);

  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}

// Count label update
function renderSelectionCount(selection) {
  const chosen = selection
    ? commitsGlobal.filter(d => isCommitSelected(selection, d))
    : [];
  const el = document.querySelector('#selection-count');
  el.textContent = `${chosen.length || 'No'} commits selected`;
  return chosen;
}

// Language breakdown panel
function renderLanguageBreakdown(selection) {
  const chosen = selection
    ? commitsGlobal.filter(d => isCommitSelected(selection, d))
    : [];
  const container = document.getElementById('language-breakdown');
  container.innerHTML = '';

  if (chosen.length === 0) return;

  const lines = chosen.flatMap(d => d.lines);
  const total = lines.length;

  const breakdown = d3.rollup(
    lines,
    v => v.length,
    d => d.type
  );

  for (const [language, count] of breakdown) {
    const prop = count / total;
    const formatted = d3.format('.1%')(prop);
    container.innerHTML += `
      <dt>${language}</dt>
      <dd>${count} lines (${formatted})</dd>
    `;
  }
}

// ---------- Scatterplot with sizes + brush ----------
function renderScatterPlot(data, commits) {
  commitsGlobal = commits;

  // Dimensions & SVG
  const width = 1000, height = 600;
  const svg = d3.select('#chart')
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('overflow', 'visible');

  // Scales (assign to globals for brush tests)
  xScale = d3.scaleTime()
    .domain(d3.extent(commits, d => d.datetime))
    .range([0, width])
    .nice();
  yScale = d3.scaleLinear()
    .domain([0, 24])
    .range([height, 0]);

  // Margins / usable area
  const margin = { top: 10, right: 10, bottom: 30, left: 40 };
  const usable = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom
  };
  xScale.range([usable.left, usable.right]);
  yScale.range([usable.bottom, usable.top]);

  // Gridlines
  svg.append('g')
    .attr('class', 'gridlines')
    .attr('transform', `translate(${usable.left}, 0)`)
    .call(d3.axisLeft(yScale).tickFormat('').tickSize(-usable.width));

  // Radius scale (√ for area correctness)
  const [minLines, maxLines] = d3.extent(commits, d => d.totalLines);
  const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([2, 30]);

  // Dots group
  const dots = svg.append('g').attr('class', 'dots');

  // Sort so small points render last (on top & easier to hover)
  const sorted = d3.sort(commits, d => -d.totalLines);

  dots.selectAll('circle')
    .data(sorted)
    .join('circle')
    .attr('cx', d => xScale(d.datetime))
    .attr('cy', d => yScale(d.hourFrac))
    .attr('r', d => rScale(d.totalLines))
    .attr('fill', 'steelblue')
    .style('fill-opacity', 0.7)
    .on('mouseenter', (event, d) => {
      d3.select(event.currentTarget).style('fill-opacity', 1);
      renderTooltipContent(d);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on('mousemove', (event) => updateTooltipPosition(event))
    .on('mouseleave', (event) => {
      d3.select(event.currentTarget).style('fill-opacity', 0.7);
      updateTooltipVisibility(false);
    });

  // Axes
  const xAxis = d3.axisBottom(xScale);
  const yAxis = d3.axisLeft(yScale).tickFormat(d => String(d % 24).padStart(2, '0') + ':00');
  svg.append('g').attr('transform', `translate(0, ${usable.bottom})`).call(xAxis);
  svg.append('g').attr('transform', `translate(${usable.left}, 0)`).call(yAxis);

  // Brush
  function brushed(event) {
    const selection = event.selection;
    // toggle the 'selected' class
    d3.selectAll('circle').classed('selected', d => isCommitSelected(selection, d));
    // update panels
    renderSelectionCount(selection);
    renderLanguageBreakdown(selection);
  }

  svg.call(d3.brush().on('start brush end', brushed));

  // Bring interactive layers above the brush overlay so tooltips still work
  svg.selectAll('.dots, .overlay ~ *').raise();
}

// ---------- Run ----------
const data = await loadData();
const commits = processCommits(data);
renderCommitInfo(data, commits);
renderScatterPlot(data, commits);