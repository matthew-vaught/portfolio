import { fetchJSON, renderProjects } from '../global.js';

const projects = await fetchJSON('../lib/projects.json');

const projectsContainer = document.querySelector('.projects');

renderProjects(projects, projectsContainer, 'h2');

export function renderProjects(project, containerElement, headingLevel = 'h2') {
  if (!containerElement) return;

  const allowed = new Set(['h1','h2','h3','h4','h5','h6']);
  const tag = allowed.has(String(headingLevel).toLowerCase()) ? headingLevel.toLowerCase() : 'h2';

  containerElement.innerHTML = '';

  const article = document.createElement('article');
  article.innerHTML = `
    <${tag}>${project.title ?? 'Untitled Project'}</${tag}>
    <img src="${project.image ?? ''}" alt="${project.title ?? 'project image'}">
    <p>${project.description ?? ''}</p>
  `;
  containerElement.appendChild(article);
}

// TEMP for Step 6 console testing
window.projects = projects;
window.renderProjects = renderProjects;
console.log('projects + renderProjects exposed to window');