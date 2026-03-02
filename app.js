const DEFAULT_SEARCH_URL = 'https://www.google.com/search?q=%28site%3Ajobs.ashbyhq.com+OR+site%3Ajob-boards.greenhouse.io+OR+site%3Ajobs.lever.co+OR+site%3Ajobs.workable.com+OR+site%3Ajobs.smartrecruiters.com+OR+site%3Ajobs.jobvite.com%29+%28%22Enterprise+Customer+Success%22+OR+%22Strategic+Customer+Success%22+OR+%22Senior+Customer+Success+Manager%22+OR+%22Customer+Success+Manager%22%29+%28remote+OR+%22remote+US%22%29&tbs=qdr:d';
const STORAGE_KEY = 'job-search-tracker-v1';

const STAGES = [
  { key: 'new', label: 'New Lead' },
  { key: 'applied', label: 'Applied' },
  { key: 'interview1', label: '1st Round' },
  { key: 'interview2', label: '2nd Round' },
  { key: 'final', label: 'Final Round' },
  { key: 'offer', label: 'Offer' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'not_interested', label: 'Not Interested' }
];

const state = { jobs: [] };
const el = {
  searchUrl: document.querySelector('#searchUrl'),
  pullJobsBtn: document.querySelector('#pullJobsBtn'),
  openSearchBtn: document.querySelector('#openSearchBtn'),
  seedDemoBtn: document.querySelector('#seedDemoBtn'),
  fetchStatus: document.querySelector('#fetchStatus'),
  metricsGrid: document.querySelector('#metricsGrid'),
  jobsContainer: document.querySelector('#jobsContainer'),
  template: document.querySelector('#jobCardTemplate'),
  searchInput: document.querySelector('#searchInput'),
  stageFilter: document.querySelector('#stageFilter'),
  sortBy: document.querySelector('#sortBy')
};

function stageLabel(stage) {
  return STAGES.find((s) => s.key === stage)?.label || stage;
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.jobs));
}

function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  state.jobs = raw ? JSON.parse(raw) : [];
}

function upsertJobs(newJobs) {
  const byUrl = new Map(state.jobs.map((job) => [job.url, job]));
  let added = 0;
  for (const job of newJobs) {
    if (!byUrl.has(job.url)) {
      state.jobs.push(job);
      byUrl.set(job.url, job);
      added += 1;
    }
  }
  return added;
}

function updateStage(job, stage) {
  job.stage = stage;
  job.updatedAt = Date.now();
  if (stage === 'applied' && !job.appliedAt) {
    job.appliedAt = Date.now();
  }
  if (['interview1', 'interview2', 'final', 'offer', 'accepted', 'rejected'].includes(stage)) {
    job.lastOutcomeAt = Date.now();
  }
}

function computeMetrics(jobs) {
  const total = jobs.length;
  const count = (stage) => jobs.filter((j) => j.stage === stage).length;
  const applied = count('applied') + count('interview1') + count('interview2') + count('final') + count('offer') + count('accepted') + count('rejected');
  const interviews = count('interview1') + count('interview2') + count('final');
  const offers = count('offer') + count('accepted');
  const accepted = count('accepted');
  const rejected = count('rejected');

  const responseDays = jobs
    .filter((j) => j.appliedAt && j.lastOutcomeAt)
    .map((j) => (j.lastOutcomeAt - j.appliedAt) / (1000 * 60 * 60 * 24));

  const avgResponse = responseDays.length
    ? (responseDays.reduce((sum, day) => sum + day, 0) / responseDays.length).toFixed(1)
    : '—';

  return [
    ['Total Leads', total],
    ['Applied', applied],
    ['Not Interested', count('not_interested')],
    ['Interviews', interviews],
    ['Offers', offers],
    ['Accepted', accepted],
    ['Rejected', rejected],
    ['Apply Rate', total ? `${Math.round((applied / total) * 100)}%` : '0%'],
    ['Interview Rate', applied ? `${Math.round((interviews / applied) * 100)}%` : '0%'],
    ['Offer Rate', interviews ? `${Math.round((offers / interviews) * 100)}%` : '0%'],
    ['Win Rate', offers ? `${Math.round((accepted / offers) * 100)}%` : '0%'],
    ['Avg Days to Outcome', avgResponse]
  ];
}

function formatDate(ts) {
  return ts ? new Date(ts).toLocaleDateString() : '—';
}

function renderMetrics(filteredJobs) {
  el.metricsGrid.innerHTML = '';
  for (const [label, value] of computeMetrics(filteredJobs)) {
    const metric = document.createElement('div');
    metric.className = 'metric';
    metric.innerHTML = `<div class="label">${label}</div><div class="value">${value}</div>`;
    el.metricsGrid.appendChild(metric);
  }
}

function renderStageFilter() {
  const current = el.stageFilter.value || 'all';
  el.stageFilter.innerHTML = '<option value="all">All Stages</option>';
  for (const stage of STAGES) {
    const option = document.createElement('option');
    option.value = stage.key;
    option.textContent = stage.label;
    el.stageFilter.appendChild(option);
  }
  el.stageFilter.value = current;
}

function getVisibleJobs() {
  const term = el.searchInput.value.trim().toLowerCase();
  const stage = el.stageFilter.value;
  const sortBy = el.sortBy.value;

  let jobs = state.jobs.filter((job) => {
    const haystack = `${job.title} ${job.company} ${job.source}`.toLowerCase();
    const termMatch = !term || haystack.includes(term);
    const stageMatch = stage === 'all' || job.stage === stage;
    return termMatch && stageMatch;
  });

  if (sortBy === 'newest') jobs.sort((a, b) => b.createdAt - a.createdAt);
  if (sortBy === 'oldest') jobs.sort((a, b) => a.createdAt - b.createdAt);
  if (sortBy === 'company') jobs.sort((a, b) => a.company.localeCompare(b.company));
  if (sortBy === 'stage') jobs.sort((a, b) => stageLabel(a.stage).localeCompare(stageLabel(b.stage)));

  return jobs;
}

function renderJobs() {
  const jobs = getVisibleJobs();
  renderMetrics(jobs);
  el.jobsContainer.innerHTML = '';

  if (!jobs.length) {
    el.jobsContainer.innerHTML = '<p>No jobs match this filter yet.</p>';
    return;
  }

  jobs.forEach((job) => {
    const node = el.template.content.cloneNode(true);
    node.querySelector('.job-title').textContent = job.title;
    node.querySelector('.stage-pill').textContent = stageLabel(job.stage);
    node.querySelector('.company').textContent = `${job.company} • ${job.source}`;
    node.querySelector('.meta').textContent = `Found: ${formatDate(job.createdAt)} | Applied: ${formatDate(job.appliedAt)} | Last update: ${formatDate(job.updatedAt)}`;

    const notes = node.querySelector('.notes');
    notes.value = job.notes || '';
    notes.addEventListener('change', () => {
      job.notes = notes.value.trim();
      job.updatedAt = Date.now();
      save();
      renderJobs();
    });

    node.querySelectorAll('button[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (action === 'remove') {
          state.jobs = state.jobs.filter((j) => j.id !== job.id);
        } else {
          updateStage(job, action);
        }
        save();
        renderJobs();
      });
    });

    const link = node.querySelector('.job-link');
    link.href = job.url;
    link.textContent = job.url;

    el.jobsContainer.appendChild(node);
  });
}

function parseJobLinks(text) {
  const pattern = /\[(.*?)\]\((https?:\/\/[^\s)]+)\)/g;
  const matches = [...text.matchAll(pattern)];
  const allowedHosts = [
    'jobs.ashbyhq.com',
    'job-boards.greenhouse.io',
    'jobs.lever.co',
    'jobs.workable.com',
    'jobs.smartrecruiters.com',
    'jobs.jobvite.com'
  ];

  return matches
    .map((m) => {
      const title = m[1] || 'Untitled Role';
      const url = m[2].replace(/\/$/, '');
      try {
        const parsed = new URL(url);
        const source = parsed.hostname;
        if (!allowedHosts.some((host) => source.includes(host))) return null;
        return {
          id: crypto.randomUUID(),
          title: title.replace(/^\d+\.\s*/, ''),
          company: parsed.pathname.split('/').filter(Boolean)[0] || 'Unknown Company',
          source,
          url,
          stage: 'new',
          notes: '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          appliedAt: null,
          lastOutcomeAt: null
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

async function pullJobsFromSearch() {
  const searchUrl = el.searchUrl.value.trim();
  if (!searchUrl) return;
  el.fetchStatus.textContent = 'Fetching results...';

  try {
    const proxyUrl = `https://r.jina.ai/http://${searchUrl.replace(/^https?:\/\//, '')}`;
    const res = await fetch(proxyUrl);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const text = await res.text();
    const jobs = parseJobLinks(text);
    const added = upsertJobs(jobs);
    save();
    renderJobs();
    el.fetchStatus.textContent = `Imported ${added} new jobs (${jobs.length} parsed links).`;
  } catch (error) {
    el.fetchStatus.textContent = `Couldn't auto-fetch due to ${error.message}. Use "Open Search in New Tab" and add Demo Jobs or paste a different search URL.`;
  }
}

function seedDemoJobs() {
  const sample = [
    ['Senior Customer Success Manager', 'Acme', 'https://jobs.lever.co/acme/123'],
    ['Enterprise Customer Success Manager', 'Nova', 'https://job-boards.greenhouse.io/nova/jobs/888'],
    ['Strategic Customer Success', 'Orbit', 'https://jobs.ashbyhq.com/orbit/role/22']
  ].map(([title, company, url]) => ({
    id: crypto.randomUUID(),
    title,
    company,
    source: new URL(url).hostname,
    url,
    stage: 'new',
    notes: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    appliedAt: null,
    lastOutcomeAt: null
  }));

  const added = upsertJobs(sample);
  save();
  renderJobs();
  el.fetchStatus.textContent = `Added ${added} demo jobs.`;
}

function init() {
  el.searchUrl.value = DEFAULT_SEARCH_URL;
  load();
  renderStageFilter();
  renderJobs();

  el.pullJobsBtn.addEventListener('click', pullJobsFromSearch);
  el.openSearchBtn.addEventListener('click', () => window.open(el.searchUrl.value, '_blank'));
  el.seedDemoBtn.addEventListener('click', seedDemoJobs);
  el.searchInput.addEventListener('input', renderJobs);
  el.stageFilter.addEventListener('change', renderJobs);
  el.sortBy.addEventListener('change', renderJobs);
}

init();
