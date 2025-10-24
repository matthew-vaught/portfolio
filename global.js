console.log('IT’S ALIVE!');

function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

// let navLinks = $$("nav a");

// let currentLink = navLinks.find(
//   (a) => a.host === location.host && a.pathname === location.pathname,
// );

// if (currentLink) {
//     currentLink.classList.add('current');
// }

let pages = [
  { url: '', title: 'Home' },
  { url: 'projects/', title: 'Projects' },
  { url: 'contact/', title: 'Contact' },
  { url: 'resume/', title: 'Resume' },
  { url: 'https://github.com/matthew-vaught', title: 'Github'}
];

const BASE_PATH = (location.hostname === "localhost" || location.hostname === "127.0.0.1")
  ? "/"                  // Local server
  : "/portfolio/";         // GitHub Pages repo name

let nav = document.createElement('nav');
nav.classList.add('nav_bar');
document.body.prepend(nav);

for (let p of pages) {
  let url = p.url;
  let title = p.title;
  url = !url.startsWith('http') ? BASE_PATH + url : url;
  let a = document.createElement('a');
  a.href = url;
  a.textContent = title;
  a.classList.toggle(
    'current',
    a.host === location.host && a.pathname === location.pathname
  );
  if (a.host !== location.host) {
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  }
  nav.append(a);
}

function automaticLabel() {
  return matchMedia("(prefers-color-scheme: dark)").matches
    ? "Automatic (Dark)"
    : "Automatic (Light)";
}

document.body.insertAdjacentHTML(
  "afterbegin",
  `
  <label class="color-scheme">
    Theme:
    <select id="theme-select" aria-label="Theme">
      <option value="light dark">${automaticLabel()}</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  </label>
  `
);

// Step 4.4 — wire up the select
const select = document.querySelector('#theme-select');

select.addEventListener('input', (event) => {
  console.log('color scheme changed to', event.target.value);

  // Set the CSS property on the root element <html>
  document.documentElement.style.setProperty('color-scheme', event.target.value);

  // Step 4.5 — persist the choice
  localStorage.colorScheme = event.target.value;
});

// Step 4.5 — restore saved preference on load
if ('colorScheme' in localStorage) {
  const saved = localStorage.colorScheme;
  document.documentElement.style.setProperty('color-scheme', saved);
  select.value = saved;   // keep the dropdown in sync
}

export async function fetchJSON(url) {
  try {
    // Fetch the JSON file from the given URL
    const response = await fetch(url);
    console.log(response);
    if (!response.ok) {
      throw new Error(`Failed to fetch projects: ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching or parsing JSON data:', error);
  }
}

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