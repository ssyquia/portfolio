import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm';

const chartWidth = 1000;
const chartHeight = 600;
const chartMargin = { top: 10, right: 10, bottom: 30, left: 44 };
const chartArea = {
  top: chartMargin.top,
  right: chartWidth - chartMargin.right,
  bottom: chartHeight - chartMargin.bottom,
  left: chartMargin.left,
  width: chartWidth - chartMargin.left - chartMargin.right,
  height: chartHeight - chartMargin.top - chartMargin.bottom,
};
const colors = d3.scaleOrdinal(d3.schemeTableau10);

let data = [];
let commits = [];
let filteredCommits = [];
let commitProgress = 100;
let commitMaxTime;
let timeScale;
let xScale;
let yScale;
let activeCommitId;
let scrollFrame;

async function loadData() {
  return await d3.csv('loc.csv', (row) => ({
    ...row,
    line: Number(row.line),
    depth: Number(row.depth),
    length: Number(row.length),
    date: new Date(row.date + 'T00:00' + row.timezone),
    datetime: new Date(row.datetime),
  }));
}

function processCommits(data) {
  return d3
    .groups(data, (d) => d.commit)
    .map(([commit, lines]) => {
      const first = lines[0];
      const { author, date, time, timezone, datetime } = first;
      const ret = {
        id: commit,
        url: `https://github.com/ssyquia/portfolio/commit/${commit}`,
        author,
        date,
        time,
        timezone,
        datetime,
        hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
        totalLines: lines.length,
      };

      Object.defineProperty(ret, 'lines', {
        value: lines,
        configurable: false,
        writable: false,
        enumerable: false,
      });

      return ret;
    })
    .sort((a, b) => d3.ascending(a.datetime, b.datetime));
}

function getLines(commitData) {
  return commitData.flatMap((commit) => commit.lines);
}

function renderCommitInfo(lineData, commitData) {
  const formatNumber = d3.format(',');

  const stats = [
    ['Commits', formatNumber(commitData.length)],
    ['Files', formatNumber(d3.group(lineData, (d) => d.file).size)],
    ['Total LOC', formatNumber(lineData.length)],
    ['Max depth', formatNumber(d3.max(lineData, (d) => d.depth) ?? 0)],
    ['Longest line', formatNumber(d3.max(lineData, (d) => d.length) ?? 0)],
    ['Max lines', formatNumber(d3.max(commitData, (d) => d.totalLines) ?? 0)],
  ];

  const dl = d3
    .select('#stats')
    .selectAll('dl.stats')
    .data([stats])
    .join('dl')
    .attr('class', 'stats');

  const rows = dl
    .selectAll('div')
    .data((d) => d, (d) => d[0])
    .join('div');

  rows.selectAll('dt').data((d) => [d]).join('dt').text((d) => d[0]);
  rows.selectAll('dd').data((d) => [d]).join('dd').text((d) => d[1]);
}

function renderTooltipContent(commit) {
  if (!commit || Object.keys(commit).length === 0) return;

  const link = document.getElementById('commit-link');
  const date = document.getElementById('commit-date');
  const time = document.getElementById('tooltip-commit-time');
  const author = document.getElementById('commit-author');
  const lines = document.getElementById('commit-lines');

  link.href = commit.url;
  link.textContent = commit.id;
  date.textContent = commit.datetime?.toLocaleString('en', {
    dateStyle: 'full',
  });
  time.textContent = commit.datetime?.toLocaleString('en', {
    timeStyle: 'short',
  });
  author.textContent = commit.author;
  lines.textContent = d3.format(',')(commit.totalLines);
}

function updateTooltipVisibility(isVisible) {
  const tooltip = document.getElementById('commit-tooltip');
  tooltip.hidden = !isVisible;
}

function updateTooltipPosition(event) {
  const tooltip = document.getElementById('commit-tooltip');
  const offset = 14;
  tooltip.style.left = `${event.clientX + offset}px`;
  tooltip.style.top = `${event.clientY + offset}px`;
}

function isCommitSelected(selection, commit) {
  if (!selection) {
    return false;
  }

  const [[x0, y0], [x1, y1]] = selection;
  const x = xScale(commit.datetime);
  const y = yScale(commit.hourFrac);

  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}

function renderSelectionCount(selection) {
  const selectedCommits = selection
    ? filteredCommits.filter((commit) => isCommitSelected(selection, commit))
    : [];
  const countElement = document.querySelector('#selection-count');
  countElement.textContent = `${selectedCommits.length || 'No'} commits selected`;

  return selectedCommits;
}

function renderLanguageBreakdown(selection) {
  const selectedCommits = selection
    ? filteredCommits.filter((commit) => isCommitSelected(selection, commit))
    : [];
  const container = document.getElementById('language-breakdown');

  if (selectedCommits.length === 0) {
    container.innerHTML = '';
    return;
  }

  const lines = selectedCommits.flatMap((commit) => commit.lines);
  const breakdown = d3.rollup(
    lines,
    (items) => items.length,
    (line) => line.type,
  );

  container.innerHTML = '';

  for (const [language, count] of breakdown) {
    const proportion = count / lines.length;
    const formatted = d3.format('.1~%')(proportion);
    container.insertAdjacentHTML(
      'beforeend',
      `<dt>${language}</dt><dd>${count} lines (${formatted})</dd>`,
    );
  }
}

function updateScatterPlot(commitData) {
  const svg = d3.select('#chart').select('svg');

  xScale = xScale.domain(d3.extent(commitData, (d) => d.datetime)).nice();

  const [minLines, maxLines] = d3.extent(commitData, (d) => d.totalLines);
  const rScale = d3
    .scaleSqrt()
    .domain([minLines ?? 0, maxLines ?? 1])
    .range([3, 30]);

  svg.select('g.x-axis').call(d3.axisBottom(xScale));

  const dots = svg.select('g.dots');
  const sortedCommits = d3.sort(commitData, (d) => -d.totalLines);

  dots
    .selectAll('circle')
    .data(sortedCommits, (d) => d.id)
    .join('circle')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines))
    .attr('fill', 'steelblue')
    .style('fill-opacity', 0.7)
    .on('mouseenter', (event, commit) => {
      d3.select(event.currentTarget).style('fill-opacity', 1);
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on('mousemove', updateTooltipPosition)
    .on('mouseleave', (event) => {
      d3.select(event.currentTarget).style('fill-opacity', 0.7);
      updateTooltipVisibility(false);
    });

  renderSelectionCount(null);
  renderLanguageBreakdown(null);
}

function renderScatterPlot(commitData) {
  const svg = d3
    .select('#chart')
    .append('svg')
    .attr('viewBox', `0 0 ${chartWidth} ${chartHeight}`)
    .attr('role', 'img')
    .attr('aria-label', 'Scatterplot of commits by date and time of day');

  xScale = d3
    .scaleTime()
    .domain(d3.extent(commitData, (d) => d.datetime))
    .range([chartArea.left, chartArea.right])
    .nice();

  yScale = d3
    .scaleLinear()
    .domain([0, 24])
    .range([chartArea.bottom, chartArea.top]);

  svg
    .append('g')
    .attr('class', 'gridlines')
    .attr('transform', `translate(${chartArea.left}, 0)`)
    .call(d3.axisLeft(yScale).tickFormat('').tickSize(-chartArea.width));

  svg
    .append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0, ${chartArea.bottom})`);

  svg
    .append('g')
    .attr('class', 'y-axis')
    .attr('transform', `translate(${chartArea.left}, 0)`)
    .call(
      d3
        .axisLeft(yScale)
        .tickFormat((d) => String(d % 24).padStart(2, '0') + ':00'),
    );

  svg.append('g').attr('class', 'dots');

  function brushed(event) {
    const selection = event.selection;
    svg
      .select('g.dots')
      .selectAll('circle')
      .classed('selected', (commit) => isCommitSelected(selection, commit));
    renderSelectionCount(selection);
    renderLanguageBreakdown(selection);
  }

  svg.call(d3.brush().on('start brush end', brushed));
  svg.selectAll('.dots, .overlay ~ *').raise();
  updateScatterPlot(commitData);
}

function updateFileDisplay(commitData) {
  const lines = getLines(commitData);
  const files = d3
    .groups(lines, (d) => d.file)
    .map(([name, lines]) => ({ name, lines }))
    .sort((a, b) => b.lines.length - a.lines.length);

  const filesContainer = d3
    .select('#files')
    .selectAll('div')
    .data(files, (d) => d.name)
    .join((enter) =>
      enter.append('div').call((div) => {
        div.append('dt').append('code');
        div.select('dt').append('small');
        div.append('dd');
      }),
    );

  filesContainer.select('dt > code').text((d) => d.name);
  filesContainer.select('dt > small').text((d) => `${d.lines.length} lines`);

  filesContainer
    .select('dd')
    .selectAll('div')
    .data(
      (d) => d.lines,
      (d) => `${d.commit}-${d.file}-${d.line}`,
    )
    .join('div')
    .attr('class', 'loc')
    .attr('style', (d) => `--color: ${colors(d.type)}`);
}

function updateCommitFilter(maxTime) {
  commitMaxTime = maxTime;
  commitProgress = timeScale(commitMaxTime);
  filteredCommits = commits.filter((d) => d.datetime <= commitMaxTime);
  activeCommitId = filteredCommits.at(-1)?.id;

  const slider = document.getElementById('commit-progress');
  const time = document.getElementById('commit-time');

  slider.value = commitProgress;
  time.textContent = commitMaxTime.toLocaleString('en', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  renderCommitInfo(getLines(filteredCommits), filteredCommits);
  updateScatterPlot(filteredCommits);
  updateFileDisplay(filteredCommits);

  d3.selectAll('#scatter-story .step').classed(
    'active',
    (d) => d.id === activeCommitId,
  );
  d3.selectAll('#file-story .file-step').classed(
    'active',
    (d) => d.id === activeCommitId,
  );
}

function onTimeSliderChange(event) {
  updateCommitFilter(timeScale.invert(Number(event.target.value)));
}

function renderScatterStory() {
  d3.select('#scatter-story')
    .selectAll('.step')
    .data(commits, (d) => d.id)
    .join('div')
    .attr('class', 'step')
    .html(
      (d, i) => `
        <p>
          On ${d.datetime.toLocaleString('en', {
            dateStyle: 'full',
            timeStyle: 'short',
          })}, I made
          <a href="${d.url}" target="_blank" rel="noreferrer noopener">${
            i > 0 ? 'another glorious commit' : 'my first commit, and it was glorious'
          }</a>.
          I edited ${d3.format(',')(d.totalLines)} lines across ${
            d3.rollups(
              d.lines,
              (D) => D.length,
              (line) => line.file,
            ).length
          } files. Then I looked over all I had made, and I saw that it was very good.
        </p>
      `,
    );
}

function renderFileStory() {
  d3.select('#file-story')
    .selectAll('.file-step')
    .data(commits, (d) => d.id)
    .join('div')
    .attr('class', 'file-step')
    .html(
      (d, i) => `
        <p>
          On ${d.datetime.toLocaleString('en', {
            dateStyle: 'full',
            timeStyle: 'short',
          })}, I made
          <a href="${d.url}" target="_blank" rel="noreferrer noopener">${
            i > 0 ? 'another glorious commit' : 'my first commit, and it was glorious'
          }</a>.
          I edited ${d3.format(',')(d.totalLines)} lines across ${
            d3.rollups(
              d.lines,
              (D) => D.length,
              (line) => line.file,
            ).length
          } files. Then I looked over all I had made, and I saw that it was very good.
        </p>
      `,
    );
}

function onStepEnter(response) {
  updateCommitFilter(response.element.__data__.datetime);
}

function updateFromScrollPosition() {
  scrollFrame = null;

  const scrolly = document.getElementById('scrolly-1');
  const scrollyRect = scrolly.getBoundingClientRect();

  if (scrollyRect.top > window.innerHeight * 0.7 || scrollyRect.bottom < 0) {
    return;
  }

  const targetY = window.innerHeight * 0.5;
  const activeStep = Array.from(document.querySelectorAll('#scatter-story .step'))
    .map((step) => {
      const rect = step.getBoundingClientRect();
      return {
        step,
        distance: Math.abs(rect.top + rect.height / 2 - targetY),
      };
    })
    .sort((a, b) => a.distance - b.distance)[0]?.step;

  const commit = activeStep?.__data__;

  if (commit && commit.id !== activeCommitId) {
    updateCommitFilter(commit.datetime);
  }
}

function onScroll() {
  if (!scrollFrame) {
    scrollFrame = requestAnimationFrame(updateFromScrollPosition);
  }
}

data = await loadData();
commits = processCommits(data);
filteredCommits = commits;
timeScale = d3
  .scaleTime()
  .domain(d3.extent(commits, (d) => d.datetime))
  .range([0, 100]);
commitMaxTime = timeScale.invert(commitProgress);

renderCommitInfo(data, commits);
renderScatterPlot(commits);
updateFileDisplay(commits);
renderScatterStory();
renderFileStory();

document
  .getElementById('commit-progress')
  .addEventListener('input', onTimeSliderChange);
updateCommitFilter(commitMaxTime);

const scroller = scrollama();
scroller
  .setup({
    container: '#scrolly-1',
    step: '#scrolly-1 .step',
    offset: 0.5,
  })
  .onStepEnter(onStepEnter);

const fileScroller = scrollama();
fileScroller
  .setup({
    container: '#scrolly-2',
    step: '#scrolly-2 .file-step',
    offset: 0.5,
  })
  .onStepEnter(onStepEnter);
window.addEventListener('resize', scroller.resize);
window.addEventListener('resize', fileScroller.resize);
window.addEventListener('scroll', onScroll, { passive: true });
