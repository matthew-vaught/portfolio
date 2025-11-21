// 1) Import D3 (ESM) & Scrollama
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm';

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

      // keep original lines (hidden, non-enumerable)
      Object.defineProperty(ret, 'lines', {
        value: lines,
        enumerable: false,
        writable: false,
        configurable: false,
      });

      return ret;
    });
}

// ---------- Summary stats ----------
function renderCommitInfo(data, commits) {
  const dl = d3.select('#stats').append('dl').attr('class', 'stats');

  const totalLOC = data.length;
  const totalCommits = commits.length;
  const filesCount = d3.group(data, (d) => d.file).size;
  const maxDepth = d3.max(data, (d) => d.depth);
  const longestLine = d3.max(data, (d) => d.length);

  const perFileMaxLine = d3.rollups(
    data,
    (v) => d3.max(v, (d) => d.line),
    (d) => d.file,
  );
  const maxLines = d3.max(perFileMaxLine, (d) => d[1]);
  const avgFileLength = Math.round(d3.mean(perFileMaxLine, (d) => d[1]));

  const workByPeriod = d3.rollups(
    data,
    (v) => v.length,
    (d) => new Date(d.datetime).toLocaleString('en', { dayPeriod: 'short' }),
  );
  const mostActivePeriod =
    d3.greatest(workByPeriod, (d) => d[1])?.[0] ?? 'n/a';

  const row = (label, value, useHtml = false) => {
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

  const link = document.getElementById('commit-link');
  const dateEl = document.getElementById('commit-date');
  const timeEl = document.getElementById('commit-time');
  const authEl = document.getElementById('commit-author');
  const linesEl = document.getElementById('commit-lines');

  link.href = commit.url;
  link.textContent = commit.id;
  dateEl.textContent = commit.datetime.toLocaleString('en', {
    dateStyle: 'full',
  });
  timeEl.textContent = commit.datetime.toLocaleTimeString('en', {
    hour: '2-digit',
    minute: '2-digit',
  });
  authEl.textContent = commit.author ?? '—';
  linesEl.textContent = String(
    commit.totalLines ?? commit.lines?.length ?? '—',
  );
}

function updateTooltipVisibility(show) {
  const tip = document.getElementById('commit-tooltip');
  tip.classList.toggle('visible', !!show);
}

function updateTooltipPosition(event) {
  const tip = document.getElementById('commit-tooltip');
  const OFFSET = 12;
  tip.style.left = `${event.clientX + OFFSET}px`;
  tip.style.top = `${event.clientY + OFFSET}px`;
}

// ---------- Globals used by brush & slider ----------
let xScale; // assigned inside renderScatterPlot
let yScale;
let commitsGlobal = []; // for selection-based summaries

// slider / filtering globals
let commitProgress = 100;
let timeScale;
let commitMaxTime;
let filteredCommits = [];
let sliderEl;
let commitTimeEl;

// color for file types (unit viz)
const techColor = d3.scaleOrdinal(d3.schemeTableau10);

// ---------- Selection-based summaries ----------
function isCommitSelected(selection, commit) {
  if (!selection) return false;
  const [x0, x1] = selection.map((d) => d[0]);
  const [y0, y1] = selection.map((d) => d[1]);

  const x = xScale(commit.datetime);
  const y = yScale(commit.hourFrac);

  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}

function renderSelectionCount(selection) {
  const chosen = selection
    ? commitsGlobal.filter((d) => isCommitSelected(selection, d))
    : [];
  const el = document.querySelector('#selection-count');
  el.textContent = `${chosen.length || 'No'} commits selected`;
  return chosen;
}

function renderLanguageBreakdown(selection) {
  const chosen = selection
    ? commitsGlobal.filter((d) => isCommitSelected(selection, d))
    : [];
  const container = document.getElementById('language-breakdown');
  container.innerHTML = '';

  if (chosen.length === 0) return;

  const lines = chosen.flatMap((d) => d.lines);
  const total = lines.length;

  const breakdown = d3.rollup(
    lines,
    (v) => v.length,
    (d) => d.type,
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
function attachDotHandlers(selection) {
  selection
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
}

function renderScatterPlot(data, commits) {
  commitsGlobal = commits;

  const width = 1000;
  const height = 600;
  const svg = d3
    .select('#chart')
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('overflow', 'visible');

  const margin = { top: 10, right: 10, bottom: 30, left: 40 };
  const usable = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  xScale = d3
    .scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime))
    .range([usable.left, usable.right])
    .nice();

  yScale = d3.scaleLinear().domain([0, 24]).range([usable.bottom, usable.top]);

  // Gridlines
  svg
    .append('g')
    .attr('class', 'gridlines')
    .attr('transform', `translate(${usable.left}, 0)`)
    .call(d3.axisLeft(yScale).tickFormat('').tickSize(-usable.width));

  // Radius scale
  let [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
  if (minLines === maxLines) {
    minLines = 0;
  }
  const rScale = d3
    .scaleSqrt()
    .domain([minLines ?? 0, maxLines || 1])
    .range([2, 30]);

  // Dots group
  const dots = svg.append('g').attr('class', 'dots');

  const sorted = d3.sort(commits, (d) => -d.totalLines);

  dots
    .selectAll('circle')
    .data(sorted, (d) => d.id)
    .join('circle')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines))
    .attr('fill', 'steelblue')
    .style('fill-opacity', 0.7)
    .call(attachDotHandlers);

  // Axes
  const xAxis = d3.axisBottom(xScale);
  const yAxis = d3
    .axisLeft(yScale)
    .tickFormat((d) => String(d % 24).padStart(2, '0') + ':00');

  svg
    .append('g')
    .attr('transform', `translate(0, ${usable.bottom})`)
    .attr('class', 'x-axis')
    .call(xAxis);

  svg
    .append('g')
    .attr('transform', `translate(${usable.left}, 0)`)
    .attr('class', 'y-axis')
    .call(yAxis);

  // Brush
  function brushed(event) {
    const selection = event.selection;
    d3.selectAll('circle').classed('selected', (d) =>
      isCommitSelected(selection, d),
    );
    renderSelectionCount(selection);
    renderLanguageBreakdown(selection);
  }

  svg.call(d3.brush().on('start brush end', brushed));

  // Make dots above brush overlay
  svg.selectAll('.dots, .overlay ~ *').raise();
}

function updateScatterPlot(data, commits) {
  commitsGlobal = commits;

  const width = 1000;
  const height = 600;
  const margin = { top: 10, right: 10, bottom: 30, left: 40 };
  const usable = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  const svg = d3.select('#chart').select('svg');

  if (commits.length === 0 || svg.empty()) return;

  xScale.domain(d3.extent(commits, (d) => d.datetime));

  let [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
  if (minLines === maxLines) {
    minLines = 0;
  }
  const rScale = d3
    .scaleSqrt()
    .domain([minLines ?? 0, maxLines || 1])
    .range([2, 30]);

  const xAxis = d3.axisBottom(xScale);
  const xAxisGroup = svg.select('g.x-axis');
  xAxisGroup.selectAll('*').remove();
  xAxisGroup.call(xAxis);

  const dots = svg.select('g.dots');
  const sortedCommits = d3.sort(commits, (d) => -d.totalLines);

  dots
    .selectAll('circle')
    .data(sortedCommits, (d) => d.id)
    .join(
      (enter) =>
        enter
          .append('circle')
          .attr('cx', (d) => xScale(d.datetime))
          .attr('cy', (d) => yScale(d.hourFrac))
          .attr('r', (d) => rScale(d.totalLines))
          .attr('fill', 'steelblue')
          .style('fill-opacity', 0.7)
          .call(attachDotHandlers),
      (update) =>
        update
          .attr('cx', (d) => xScale(d.datetime))
          .attr('cy', (d) => yScale(d.hourFrac))
          .attr('r', (d) => rScale(d.totalLines)),
      (exit) => exit.remove(),
    );
}

// ---------- Unit visualization for files ----------
function updateFileDisplay(commits) {
  const container = d3.select('#files');

  if (!commits || commits.length === 0) {
    container.selectAll('div').remove();
    return;
  }

  const lines = commits.flatMap((d) => d.lines);
  const files = d3
    .groups(lines, (d) => d.file)
    .map(([name, lines]) => ({
      name,
      lines,
      type: lines[0]?.type ?? 'other',
    }))
    .sort((a, b) => b.lines.length - a.lines.length);

  const filesContainer = container
    .selectAll('div')
    .data(files, (d) => d.name)
    .join((enter) =>
      enter.append('div').call((div) => {
        div.append('dt').append('code');
        div.append('dd');
      }),
    );

  // filename + count
  filesContainer
    .select('dt > code')
    .html(
      (d) =>
        `${d.name}<small>${d.lines.length} line${
          d.lines.length === 1 ? '' : 's'
        }</small>`,
    );

  // one dot per line
  filesContainer
    .select('dd')
    .selectAll('div')
    .data((d) => d.lines)
    .join('div')
    .attr('class', 'loc');

  // color by technology
  filesContainer.style('--color', (d) => techColor(d.type));
}

// ---------- Slider logic ----------
function onTimeSliderChange(commits, data) {
  if (!sliderEl || !commitTimeEl) return;

  commitProgress = Number(sliderEl.value);
  commitMaxTime = timeScale.invert(commitProgress);

  commitTimeEl.textContent = commitMaxTime.toLocaleString('en', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  filteredCommits = commits.filter((d) => d.datetime <= commitMaxTime);

  // reset brush-based panels
  renderSelectionCount(null);
  renderLanguageBreakdown(null);

  updateScatterPlot(data, filteredCommits);
  updateFileDisplay(filteredCommits);
}

// ---------- Scrollytelling ----------
function initScrollytelling(commits, data) {
  const story = d3.select('#scatter-story');

  story
    .selectAll('.step')
    .data(commits)
    .join('div')
    .attr('class', 'step')
    .html((d, i) => {
      const filesTouched = d3.rollups(
        d.lines,
        (v) => v.length,
        (l) => l.file,
      ).length;
      return `
        <p>
          On ${d.datetime.toLocaleString('en', {
            dateStyle: 'full',
            timeStyle: 'short',
          })},
          I made <a href="${d.url}" target="_blank" rel="noopener">
            ${i === 0 ? 'my first commit to this site' : 'another commit'}
          </a>,
          editing <strong>${d.totalLines}</strong> lines across
          <strong>${filesTouched}</strong> files.
        </p>
      `;
    });

  const scroller = scrollama();

  function handleStepEnter(response) {
    const commit = response.element.__data__;
    // update max time to this commit
    commitMaxTime = commit.datetime;
    commitProgress = timeScale(commitMaxTime);

    if (sliderEl) {
      sliderEl.value = commitProgress;
    }
    if (commitTimeEl) {
      commitTimeEl.textContent = commitMaxTime.toLocaleString('en', {
        dateStyle: 'long',
        timeStyle: 'short',
      });
    }

    filteredCommits = commits.filter((d) => d.datetime <= commitMaxTime);
    renderSelectionCount(null);
    renderLanguageBreakdown(null);
    updateScatterPlot(data, filteredCommits);
    updateFileDisplay(filteredCommits);
  }

  scroller
    .setup({
      container: '#scrolly-1',
      step: '#scatter-story .step',
      offset: 0.6,
    })
    .onStepEnter(handleStepEnter);
}

// ---------- Run ----------
const data = await loadData();
const commits = processCommits(data);

// initial global filtering setup
timeScale = d3
  .scaleTime()
  .domain([
    d3.min(commits, (d) => d.datetime),
    d3.max(commits, (d) => d.datetime),
  ])
  .range([0, 100]);
commitMaxTime = timeScale.invert(commitProgress);
filteredCommits = commits;

// grab DOM elements for slider UI
sliderEl = document.querySelector('#commit-progress');
commitTimeEl = document.querySelector('#commit-time');

// render initial stats & plot
renderCommitInfo(data, commits);
renderScatterPlot(data, commits);
updateFileDisplay(filteredCommits);

// hook up slider
if (sliderEl) {
  sliderEl.value = commitProgress;
  sliderEl.addEventListener('input', () => onTimeSliderChange(commits, data));
  // initialize once so time and filtered view are in sync
  onTimeSliderChange(commits, data);
}

// initialize scrollytelling
initScrollytelling(commits, data);