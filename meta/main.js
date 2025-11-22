import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import scrollama from "https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm";

// ---------- Load ----------
async function loadData() {
  return await d3.csv("loc.csv", d => ({
    ...d,
    line: +d.line,
    depth: +d.depth,
    length: +d.length,
    date: new Date(d.date + "T00:00" + d.timezone),
    datetime: new Date(d.datetime)
  }));
}

// ---------- Commits ----------
function processCommits(data) {
  const grouped = d3.groups(data, d => d.commit)
    .map(([id, lines]) => {
      const f = lines[0];

      const obj = {
        id,
        url: `https://github.com/matthew-vaught/portfolio/commit/${id}`,
        author: f.author,
        datetime: f.datetime,
        hourFrac: f.datetime.getHours() + f.datetime.getMinutes() / 60,
        totalLines: lines.length
      };

      Object.defineProperty(obj, "lines", {
        value: lines, enumerable: false
      });

      return obj;
    });

  return grouped.sort((a,b) => a.datetime - b.datetime);
}

// ---------- Top Stats ----------
function renderCommitInfo(data, commits) {
  const dl = d3.select("#stats").append("dl").attr("class","stats");

  const row = (k,v) => {
    dl.append("dt").html(k);
    dl.append("dd").text(v);
  }

  row("Commits", commits.length);
  row("Files", new Set(data.map(d => d.file)).size);
  row("Total LOC", data.length);
  row("Max depth", d3.max(data,d=>d.depth));
}

// ---------- Scatter ----------
let xScale, yScale;

function renderScatterPlot(commits) {
  const width = 1000, height = 600;

  const svg = d3.select("#chart").append("svg")
    .attr("viewBox",`0 0 ${width} ${height}`);

  const margin = {top:20,right:20,bottom:40,left:50};

  xScale = d3.scaleTime()
    .domain(d3.extent(commits,d=>d.datetime))
    .range([margin.left,width-margin.right]);

  yScale = d3.scaleLinear()
    .domain([0,24])
    .range([height-margin.bottom,margin.top]);

  svg.append("g")
    .attr("transform",`translate(0,${height-margin.bottom})`)
    .call(d3.axisBottom(xScale));

  svg.append("g")
    .attr("transform",`translate(${margin.left},0)`)
    .call(d3.axisLeft(yScale).tickFormat(d => String(d).padStart(2,'0')+":00"));

  svg.append("g")
    .attr("class","dots");
}

function updateScatter(commits) {

  const svg = d3.select("#chart svg");
  const dots = svg.select(".dots");

  const rScale = d3.scaleSqrt()
    .domain(d3.extent(commits,d=>d.totalLines))
    .range([3,30]);

  dots.selectAll("circle")
    .data(commits,d=>d.id)
    .join("circle")
    .attr("cx", d=>xScale(d.datetime))
    .attr("cy", d=>yScale(d.hourFrac))
    .attr("r", d=>rScale(d.totalLines))
    .attr("fill","steelblue")
    .attr("opacity",.7)
    .on("mouseenter",(e,d)=>{
      showTooltip(e, d);
    })
    .on("mouseleave", hideTooltip);
}

// ---------- Tooltip ----------
function showTooltip(e, d){
  const t = document.getElementById("commit-tooltip");

  t.classList.add("visible");

  t.style.left = (e.pageX + 15) + "px";
  t.style.top  = (e.pageY + 15) + "px";

  document.getElementById("commit-link").textContent = d.id;
  document.getElementById("commit-link").href = d.url;
  document.getElementById("commit-date").textContent = d.datetime.toDateString();
  document.getElementById("commit-time").textContent = d.datetime.toLocaleTimeString();
  document.getElementById("commit-author").textContent = d.author;
  document.getElementById("commit-lines").textContent = d.totalLines;
}

function hideTooltip(){
  const t = document.getElementById("commit-tooltip");
  t.hidden = true;
  t.classList.remove("visible");
}

// ---------- Files ----------
const colors = d3.scaleOrdinal(d3.schemeTableau10);

function updateFiles(commits){

  const lines = commits.flatMap(d => d.lines);

  const files = d3.groups(lines,d=>d.file)
    .map(([name,lines]) => {
      const type = d3.rollup(lines,v=>v.length,d=>d.type);
      const domType = Array.from(type).sort((a,b)=>b[1]-a[1])[0][0];
      return {name,lines, type: domType};
    });

  const sel = d3.select("#files")
    .selectAll("div")
    .data(files,d=>d.name)
    .join(enter => {
      const d = enter.append("div");
      d.append("dt").append("code");
      d.append("dd");
      return d;
    });

  sel.style("--color", d=>colors(d.type));

  sel.select("dt code")
    .html(d=>`${d.name}<small>${d.lines.length} lines</small>`);

  sel.select("dd")
    .selectAll("div")
    .data(d=>d.lines)
    .join("div")
    .attr("class","loc");
}

// ---------- Story Builders ----------
function buildStory(target, commits){
  d3.select(target)
    .selectAll(".step")
    .data(commits)
    .join("div")
    .attr("class","step")
    .html((d,i) => {
      const files = new Set(d.lines.map(l=>l.file)).size;
      return `On ${d.datetime.toLocaleString()}, I made
        <a href="${d.url}" target="_blank">a glorious commit</a>.
        I edited ${d.totalLines} lines across ${files} files.`;
    });
}

// ---------- Scrolling ----------
function setupScrolly(id, commits, callback){

  const scroller = scrollama();

  scroller
    .setup({
      container: id,
      step: `${id} .step`
    })
    .onStepEnter(r => {

      d3.selectAll(`${id} .step`)
        .classed("is-active", d => d.id === r.element.__data__.id);

      const i = commits.findIndex(c => c.id === r.element.__data__.id);

      const filtered = commits.slice(0, i+1);

      callback(filtered);
    });
}

// ---------- RUN ----------
const data = await loadData();
const commits = processCommits(data);

renderCommitInfo(data, commits);
renderScatterPlot(commits);
buildStory("#scatter-story", commits);
buildStory("#commit-story", commits);

// Start state
updateScatter(commits.slice(0,1));
updateFiles(commits.slice(0,1));

// Activate scrolling
setupScrolly("#scrolly-1", commits, (c)=>updateScatter(c));
setupScrolly("#scrolly-2", commits, (c)=>updateFiles(c));