console.log("IT'S ALIVE!");

function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

function normalizePath(pathname) {
  return pathname.replace(/index\.html$/, '').replace(/\/+$/, '');
}

const pages = [
  { url: '', title: 'Home' },
  { url: 'projects/', title: 'Projects' },
  { url: 'contact/', title: 'Contact' },
  { url: 'resume/', title: 'Resume' },
  { url: 'https://github.com/ssyquia', title: 'GitHub' },
];

const BASE_PATH = new URL('.', import.meta.url).pathname;

let nav = document.createElement('nav');
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
    a.host === location.host &&
      normalizePath(a.pathname) === normalizePath(location.pathname),
  );

  let isExternal = a.host !== location.host;
  a.toggleAttribute('target', isExternal);

  if (isExternal) {
    a.target = '_blank';
    a.rel = 'noreferrer noopener';
  }

  nav.append(a);
}

document.body.insertAdjacentHTML(
  'afterbegin',
  `
    <label class="color-scheme">
      Theme:
      <select>
        <option value="light dark">Automatic</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  `,
);

const select = document.querySelector('.color-scheme select');
const supportedColorSchemes = new Set(['light dark', 'light', 'dark']);

function setColorScheme(colorScheme) {
  document.documentElement.style.setProperty('color-scheme', colorScheme);
  select.value = colorScheme;
}

if (
  'colorScheme' in localStorage &&
  supportedColorSchemes.has(localStorage.colorScheme)
) {
  setColorScheme(localStorage.colorScheme);
}

select.addEventListener('input', (event) => {
  let colorScheme = event.target.value;
  setColorScheme(colorScheme);
  localStorage.colorScheme = colorScheme;
});

const form = document.querySelector('form[action^="mailto:"]');

form?.addEventListener('submit', (event) => {
  event.preventDefault();

  let data = new FormData(form);
  let params = [];

  for (let [name, value] of data) {
    let encodedName = encodeURIComponent(name);
    let encodedValue = encodeURIComponent(value);
    params.push(`${encodedName}=${encodedValue}`);
  }

  let query = params.join('&');
  location.href = `${form.action}?${query}`;
});
