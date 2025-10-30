import { fetchJSON, renderProjects } from '../global.js';

const projects = await fetchJSON('../lib/projects.json');

const projectsContainer = document.querySelector('.projects');

renderProjects(projects, projectsContainer, 'h2');

const titleElement = document.querySelector('.projects-title');
titleElement.textContent = `${projects.length} Projects`;

<svg id="projects-pie-plot" viewBox="-50 -50 100 100">
  <circle cx="0" cy="0" r="50" fill="red" />
</svg>