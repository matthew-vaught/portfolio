import { fetchJSON, renderProjects } from '../global.js';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

const projects = await fetchJSON('../lib/projects.json');

const projectsContainer = document.querySelector('.projects');

renderProjects(projects, projectsContainer, 'h2');

const titleElement = document.querySelector('.projects-title');
titleElement.textContent = `${projects.length} Projects`;

function renderPieChart(projectsGiven) {
  // Clear out old chart and legend before re-rendering
  let newSVG = d3.select('#projects-pie-plot');
  newSVG.selectAll('path').remove();

  let newLegend = d3.select('.legend');
  newLegend.selectAll('*').remove();

  // Recalculate rolled data
  let newRolledData = d3.rollups(
    projectsGiven,
    (v) => v.length,
    (d) => d.year
  );

  // Format for D3 pie
  let newData = newRolledData.map(([year, count]) => ({
    label: year,
    value: count,
  }));

  // Recreate pie chart
  let arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
  let sliceGenerator = d3.pie().value((d) => d.value);
  let arcData = sliceGenerator(newData);
  let arcs = arcData.map((d) => arcGenerator(d));

  let colors = d3.scaleOrdinal(d3.schemeTableau10);

  arcs.forEach((arc, idx) => {
    newSVG
      .append('path')
      .attr('d', arc)
      .attr('fill', colors(idx))
      .attr('stroke', 'white')
      .attr('stroke-width', 1);
  });

  // Recreate legend
  newData.forEach((d, idx) => {
    newLegend
      .append('li')
      .attr('class', 'legend-item')
      .attr('style', `--color:${colors(idx)}`)
      .html(`<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`);
  });
}

renderPieChart(projects);

searchInput.addEventListener('change', (event) => {
  // Update query value
  query = event.target.value;

  // Filter projects (case-insensitive, across all fields)
  let filteredProjects = projects.filter((project) => {
    let values = Object.values(project).join('\n').toLowerCase();
    return values.includes(query.toLowerCase());
  });

  // Re-render project cards
  renderProjects(filteredProjects, projectsContainer, 'h2');

  // Re-render pie chart and legend
  renderPieChart(filteredProjects);
});

let query = '';

let searchInput = document.querySelector('.searchBar');

searchInput.addEventListener('change', (event) => {
  // update query value
  query = event.target.value;

  // filter projects (case-insensitive, across all metadata)
  let filteredProjects = projects.filter((project) => {
    let values = Object.values(project).join('\n').toLowerCase();
    return values.includes(query.toLowerCase());
  });

  // render filtered projects
  renderProjects(filteredProjects, projectsContainer, 'h2');
});