(function () {
    const app = window.SagnikApp;
    let posterModal;
    let domains = [];
    let domainIndex = 0;
    let domainInterval = null;
    let rotatingKpis = [];
    let currentKpiSet = 0;
    let currentKpiActions = [];

    function submitHeroSearch() {
        const input = document.getElementById("hero-search-input");
        const query = input?.value.trim();

        if (!query) return;
        app.askSagnikGPT(query);
    }

    function focusSagnikGPT() {
        const input = document.getElementById("hero-search-input");

        if (input) {
            input.scrollIntoView({ behavior: "smooth", block: "center" });
            input.focus();
        }
    }

    function applyHomeHero(hero = {}) {
        const values = {
            ...hero,
            subtitle: hero.sections?.subtitle || hero.description || ""
        };

        app.setTextByDataset("[data-home-hero]", "homeHero", values);

        const name = document.getElementById("home-hero-name");
        if (name) {
            name.innerHTML = `${app.escapeHtml(values.namePrefix)} <span>${app.escapeHtml(values.nameHighlight)}</span><br>${app.escapeHtml(values.nameSuffix)}`;
        }

        const search = document.getElementById("hero-search-input");
        if (search) search.placeholder = values.searchPlaceholder || "";

        domains = String(hero.sections?.domains || "")
            .split(/\r?\n/)
            .map(item => item.trim())
            .filter(Boolean);

        domainIndex = 0;
        const domainText = document.getElementById("domain-text");
        if (domainText) domainText.textContent = domains[0] || "";
    }

    function rotateDomain() {
        const domainText = document.getElementById("domain-text");
        if (!domains.length || !domainText) return;

        domainIndex = (domainIndex + 1) % domains.length;
        domainText.style.opacity = 0;

        setTimeout(() => {
            domainText.textContent = domains[domainIndex];
            domainText.style.opacity = 1;
        }, 250);
    }

    function startDomainRotation() {
        if (domainInterval) clearInterval(domainInterval);
        if (domains.length > 1) domainInterval = setInterval(rotateDomain, 2200);
    }

    function renderSimpleLinks(links) {
        return app.parseLinks(links).map(link => {
            if (link.url === "#focus-sagnikgpt") {
                return `<button type="button" class="section-text-link button-link" data-focus-sagnikgpt>${app.escapeHtml(link.label)} -></button>`;
            }

            return `<a href="${app.escapeHtml(link.url)}" target="${app.externalTarget(link.url)}">${app.escapeHtml(link.label)} -></a>`;
        }).join("");
    }

    function renderHomeRows(content) {
        const misc = content.misc || {};
        const areas = document.getElementById("home-research-areas");
        if (areas) {
            areas.innerHTML = (misc.homeResearchAreas || []).map(area => `
                <article class="research-area-card improved-area-card" data-ask-sagnik="${app.escapeHtml(area.question)}">
                    <div class="area-icon-block ${app.escapeHtml(area.iconClass)}">
                        <i class="fa-solid ${app.escapeHtml(area.icon)}"></i>
                    </div>
                    <div>
                        <h3>${app.escapeHtml(area.title)}</h3>
                        <p>${app.escapeHtml(area.description)}</p>
                        <span class="card-action-link">Ask SagnikGPT about this -></span>
                    </div>
                </article>
            `).join("");
        }

        const demos = document.getElementById("home-demo-row");
        if (demos) {
            demos.innerHTML = (misc.homeDemos || []).map(demo => `
                <article class="compact-demo-card ${app.escapeHtml(demo.cardClass)} visual-demo-card">
                    <div class="demo-visual-preview ${app.escapeHtml(demo.previewClass)}">
                        <div class="preview-overlay"><i class="fa-solid ${app.escapeHtml(demo.icon)}"></i></div>
                    </div>
                    <div class="compact-demo-content">
                        <span class="demo-label">${app.escapeHtml(demo.label)}</span>
                        <h3>${app.escapeHtml(demo.title)}</h3>
                        <p>${app.escapeHtml(demo.description)}</p>
                        <div class="compact-link-row">${renderSimpleLinks(demo.links)}</div>
                    </div>
                </article>
            `).join("");
        }

        const skills = document.getElementById("home-skill-showcase");
        if (skills) {
            skills.innerHTML = (misc.homeSkillShowcase || []).map(skill => `
                <article class="skill-showcase-card" data-ask-sagnik="${app.escapeHtml(skill.question)}">
                    <div class="skill-icon"><i class="fa-solid ${app.escapeHtml(skill.icon)}"></i></div>
                    <span>${app.escapeHtml(skill.number)}</span>
                    <h4>${app.escapeHtml(skill.title)}</h4>
                    <p>${app.escapeHtml(skill.description)}</p>
                    <em>Explore evidence -></em>
                </article>
            `).join("");
        }

        const proof = document.getElementById("home-proof-row");
        if (proof) {
            proof.innerHTML = content.resolveHighlights("homeProof").map((item, index) => {
                const classes = `proof-card${index === 3 ? " emphasis-card" : ""}${index === 4 ? " final-card" : ""}`;
                const actionAttrs = getProofActionAttrs(item);

                return `
                    <article class="${classes}" ${actionAttrs}>
                        <div class="proof-icon"><i class="fa-solid ${app.escapeHtml(item.icon)}"></i></div>
                        <span class="proof-label">${app.escapeHtml(item.label)}</span>
                        <h3>${app.escapeHtml(item.title)}</h3>
                        <p>${app.escapeHtml(item.description)}</p>
                        <span class="card-action-link">${app.escapeHtml(item.actionLabel)} -></span>
                    </article>
                `;
            }).join("");
        }
    }

    function getProofActionAttrs(item) {
        if (item.actionType === "open") return `data-open-url="${app.escapeHtml(item.target)}"`;
        if (item.actionType === "poster") {
            return `data-poster-src="${app.escapeHtml(item.target)}" data-poster-title="${app.escapeHtml(item.title)}"`;
        }
        if (item.actionType === "ask") return `data-ask-sagnik="${app.escapeHtml(item.prompt)}"`;
        return `data-link-url="${app.escapeHtml(item.target)}"`;
    }

    async function hydrateHome() {
        if (!window.SagnikContent) return;

        try {
            const content = await window.SagnikContent.loadAll();

            if (content.metrics?.length) {
                rotatingKpis = content.metrics;
                currentKpiSet = 0;
                currentKpiActions = rotatingKpis[0].map(item => item.action);
            }

            window.SagnikContent.renderNav(content.misc?.pages || []);
            window.SagnikContent.renderFooterContacts(content.misc?.contactLinks || []);
            applyHomeHero(content.misc?.homeHero || {});
            startDomainRotation();
            renderHomeRows(content);
        } catch (error) {
            console.warn("Homepage content files could not be loaded.", error);
        }
    }

    function updateKpiCards() {
        if (!rotatingKpis.length) return;

        const cards = document.querySelectorAll(".rotating-kpi-card");
        if (!cards.length) return;

        cards.forEach(card => card.classList.add("fade-kpi"));

        setTimeout(() => {
            currentKpiSet = (currentKpiSet + 1) % rotatingKpis.length;
            renderKpiCards(rotatingKpis[currentKpiSet]);
            cards.forEach(card => card.classList.remove("fade-kpi"));
        }, 260);
    }

    function renderKpiCards(group) {
        const grid = document.getElementById("rotating-kpi-grid");
        if (!grid || !group) return;

        currentKpiActions = group.map(item => item.action);

        grid.innerHTML = group.map((item, index) => `
            <div class="rotating-kpi-card" data-kpi-index="${index}">
                <span class="kpi-source">${app.escapeHtml(item.source)}</span>
                <h3>${app.escapeHtml(item.value)}</h3>
                <p>${app.escapeHtml(item.label)}</p>
                <span class="kpi-action">${app.escapeHtml(item.actionLabel || "Open project ->")}</span>
            </div>
        `).join("");
    }

    function initializeKpiCards() {
        if (!rotatingKpis.length) return;
        renderKpiCards(rotatingKpis[currentKpiSet]);
    }

    function bindEvents() {
        const input = document.getElementById("hero-search-input");
        if (input) {
            input.addEventListener("keydown", event => {
                if (event.key === "Enter") submitHeroSearch();
            });
        }

        document.getElementById("hero-search-button")?.addEventListener("click", submitHeroSearch);

        document.querySelectorAll("[data-search-chip]").forEach(button => {
            button.addEventListener("click", () => {
                if (!input) return;
                input.value = button.dataset.searchChip || "";
                input.focus();
            });
        });

        document.addEventListener("click", event => {
            const focusLink = event.target.closest("[data-focus-sagnikgpt]");
            if (focusLink) {
                event.preventDefault();
                focusSagnikGPT();
                return;
            }

            const poster = event.target.closest("[data-poster-src]");
            if (poster) {
                posterModal.open(poster.dataset.posterSrc, poster.dataset.posterTitle);
                return;
            }

            const openUrl = event.target.closest("[data-open-url]");
            if (openUrl) {
                window.open(openUrl.dataset.openUrl, "_blank");
                return;
            }

            const linkUrl = event.target.closest("[data-link-url]");
            if (linkUrl) {
                window.location.href = linkUrl.dataset.linkUrl;
                return;
            }

            const kpiCard = event.target.closest(".rotating-kpi-card");
            if (kpiCard) {
                const action = currentKpiActions[Number(kpiCard.dataset.kpiIndex)];
                if (action) action();
            }
        });
    }

    document.addEventListener("DOMContentLoaded", async () => {
        app.initCommon();
        posterModal = window.SagnikModal.createPosterModalController("home-poster-modal", "home-poster-modal-img");
        bindEvents();
        await hydrateHome();
        initializeKpiCards();
        setInterval(updateKpiCards, 4600);
    });
})();
