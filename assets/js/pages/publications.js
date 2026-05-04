(function () {
    const app = window.SagnikApp;
    let posterModal;
    let assistant;

    if (window.marked) {
        window.marked.setOptions({
            breaks: true,
            gfm: true
        });
    }

    function bool(value) {
        return value === true || value === "true";
    }

    function orderValue(value, fallback = 99) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function linkTarget(url) {
        const value = String(url || "");
        return value.startsWith("http") || value.startsWith("assets/") ? "_blank" : "_self";
    }

    function applyPublicationsCopy(rows) {
        const copy = (rows || []).reduce((values, row) => {
            values[row.key] = row.value;
            return values;
        }, {});

        app.setTextByDataset("[data-publications-copy]", "publicationsCopy", copy);
    }

    function setCount(id, value) {
        const node = document.getElementById(id);
        if (node) node.textContent = String(value);
    }

    function renderLinks(project) {
        const links = [...(project.links || [])];

        if (project.paper && !links.some(link => link.url === project.paper)) {
            links.unshift({ label: "Paper", url: project.paper });
        }

        if (project.poster && !links.some(link => link.url === project.poster)) {
            links.push({ label: "Poster", url: project.poster, poster: true });
        }

        return links.map(link => {
            if (link.poster || link.url === project.poster) {
                return `<button class="section-text-link button-link" data-poster-src="${app.escapeHtml(link.url)}" data-poster-title="${app.escapeHtml(project.title)} Poster">${app.escapeHtml(link.label)} -></button>`;
            }

            return `<a href="${app.escapeHtml(link.url)}" target="${linkTarget(link.url)}">${app.escapeHtml(link.label)} -></a>`;
        }).join("");
    }

    function renderTalkLinks(row) {
        return app.parseLinks(row.links).map(link => {
            const isPoster = /poster/i.test(link.label);
            if (isPoster) {
                return `<button class="section-text-link button-link" data-poster-src="${app.escapeHtml(link.url)}" data-poster-title="${app.escapeHtml(row.title)} Poster">${app.escapeHtml(link.label)} -></button>`;
            }

            return `<a href="${app.escapeHtml(link.url)}" target="${linkTarget(link.url)}">${app.escapeHtml(link.label)} -></a>`;
        }).join("");
    }

    function renderAssistantPrompts(rows) {
        const grid = document.getElementById("assistant-prompt-grid");
        if (!grid) return;

        grid.innerHTML = (rows || []).map(row => `
            <button data-use-prompt="${app.escapeHtml(row.prompt)}">
                ${app.escapeHtml(row.label)}
            </button>
        `).join("");
    }

    function parsePairs(value) {
        if (!value) return [];

        return String(value).split(";").map(item => {
            const [label, ...descriptionParts] = item.split("|");
            return {
                label: label?.trim(),
                description: descriptionParts.join("|").trim()
            };
        }).filter(item => item.label || item.description);
    }

    function renderHowSteps(steps) {
        return (steps || []).map(step => `
            <div class="demo-step">
                <strong>${app.escapeHtml(step.label)}</strong>
                <span>${app.escapeHtml(step.description)}</span>
            </div>
        `).join("");
    }

    function renderAssistantHow(rows) {
        const grid = document.getElementById("assistant-how-grid");
        if (!grid) return;

        grid.innerHTML = (rows || []).map(row => `
            <div class="demo-step">
                <strong>${app.escapeHtml(row.title)}</strong>
                <span>${app.escapeHtml(row.description)}</span>
            </div>
        `).join("");
    }

    function renderPublications(projects) {
        const grid = document.getElementById("publication-card-grid");
        if (!grid) return [];

        const publications = projects
            .filter(project => bool(project.publication))
            .sort((a, b) => orderValue(a.publicationOrder) - orderValue(b.publicationOrder));

        grid.innerHTML = publications.map(project => `
            <article class="publication-card">
                <div class="publication-card-main">
                    <span>${app.escapeHtml(project.publicationVenue || project.meta)}</span>
                    <h3>${app.escapeHtml(project.title)}</h3>
                    <p>${app.escapeHtml(project.summary)}</p>
                </div>

                <div class="project-metrics-mini-v2">
                    ${(project.metrics || []).slice(0, 2).map(metric => `
                        <div><strong>${app.escapeHtml(metric[0])}</strong><span>${app.escapeHtml(metric[1])}</span></div>
                    `).join("")}
                </div>

                <div class="compact-link-row">${renderLinks(project)}</div>
            </article>
        `).join("");

        return publications;
    }

    function renderDemos(projects) {
        const grid = document.getElementById("live-demo-grid");
        if (!grid) return [];

        const demos = projects
            .filter(project => bool(project.demo))
            .sort((a, b) => orderValue(a.demoOrder) - orderValue(b.demoOrder));

        grid.innerHTML = demos.map(project => {
            const preview = project.demoImage || project.poster || "images/logo.png";
            const demoClass = `visual-demo-card live-demo-card demo-card-${app.escapeHtml(project.id || "demo")}`;
            const icon = app.escapeHtml(project.selectedIcon || project.demoIcon || "fa-arrow-right");
            const previewStyle = `style="background-image: url('${app.escapeHtml(preview)}')"`;
            const description = app.escapeHtml(project.featureLead || project.summary || "Live demo and research dashboard.");

            return `
            <article class="${demoClass}">
                <div class="demo-visual-preview ${app.escapeHtml(project.id || "demo")}-preview" ${previewStyle}>
                    <div class="preview-overlay"><i class="fa-solid ${icon}"></i></div>
                </div>

                <div class="compact-demo-content live-demo-content">
                    <span class="demo-label">${app.escapeHtml(project.demoLabel || "Live Demo")}</span>
                    <h3>${app.escapeHtml(project.demoTitle || project.title)}</h3>
                    <p>${description}</p>
                    <div class="project-metrics-mini-v2">
                        ${(project.metrics || []).slice(0, 4).map(metric => `
                            <div><strong>${app.escapeHtml(metric[0])}</strong><span>${app.escapeHtml(metric[1])}</span></div>
                        `).join("")}
                    </div>
                    <div class="compact-link-row">${renderLinks(project)}</div>
                </div>
            </article>
        `;
        }).join("");

        return demos;
    }

    function renderTalks(rows, projectData) {
        const list = document.getElementById("talk-list");
        if (!list) return [];

        list.innerHTML = (rows || []).map(row => {
            const project = projectData?.[row.projectRef] || {};
            const projectTitle = project.title ? `<span>${app.escapeHtml(project.title)}</span>` : "";

            return `
                <article class="talk-card">
                    <div class="talk-date">${app.escapeHtml(row.date)}</div>
                    <div>
                        <p class="section-eyebrow">${app.escapeHtml(row.event)} · ${app.escapeHtml(row.location)}</p>
                        <h3>${app.escapeHtml(row.title)}</h3>
                        ${projectTitle}
                        <p>${app.escapeHtml(row.description)}</p>
                        <div class="compact-link-row">${renderTalkLinks(row)}</div>
                    </div>
                </article>
            `;
        }).join("");

        return rows || [];
    }

    async function hydratePublicationsPage() {
        if (!window.SagnikContent) return;

        try {
            const content = await window.SagnikContent.loadAll();
            window.SagnikContent.renderNav(content.misc?.pages || []);
            window.SagnikContent.renderFooterContacts(content.misc?.contactLinks || []);

            applyPublicationsCopy(content.misc?.publicationsCopy || []);
            renderAssistantPrompts(content.misc?.assistantPrompts || []);
            renderAssistantHow(content.misc?.assistantArchitecture || []);
            const publications = renderPublications(content.projects || []);
            const demos = renderDemos(content.projects || []);
            const talks = renderTalks(content.misc?.publicationTalks || [], content.projectData || {});

            setCount("publication-count", publications.length);
            setCount("demo-count", demos.length + 1);
            setCount("talk-count", talks.length);
        } catch (error) {
            console.warn("Publications content files could not be loaded.", error);
        }
    }

    function bindEvents() {
        document.addEventListener("click", event => {
            const poster = event.target.closest("[data-poster-src]");
            if (!poster || !poster.dataset.posterSrc) return;

            event.preventDefault();
            posterModal.open(poster.dataset.posterSrc, poster.dataset.posterTitle || "Expanded poster");
        });

        document.addEventListener("click", event => {
            const prompt = event.target.closest("[data-use-prompt]");
            if (!prompt || !assistant) return;

            event.preventDefault();
            assistant.usePrompt(prompt.dataset.usePrompt || "", true);
        });
    }

    function hydrateSavedQuery() {
        const savedQuery = sessionStorage.getItem("sagnikgpt_query");
        if (!savedQuery || !assistant) return;

        assistant.usePrompt(savedQuery, true);
        setTimeout(assistant.sendMessage, 800);
        sessionStorage.removeItem("sagnikgpt_query");
    }

    document.addEventListener("DOMContentLoaded", () => {
        app.initCommon();
        posterModal = window.SagnikModal.createPosterModalController("poster-modal", "poster-modal-img", "");
        assistant = window.SagnikAssistant?.createResearchAssistant();
        bindEvents();
        hydratePublicationsPage();
        hydrateSavedQuery();
    });
})();
