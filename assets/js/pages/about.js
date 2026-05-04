(function () {
    const app = window.SagnikApp;

    function renderLinks(value) {
        return app.parseLinks(value).map(link => {
            return `<a href="${app.escapeHtml(link.url)}" target="${app.externalTarget(link.url)}">${app.escapeHtml(link.label)} -></a>`;
        }).join("");
    }

    async function hydrateAboutContent() {
        if (!window.SagnikContent) return;

        try {
            const content = await window.SagnikContent.loadAll();
            const misc = content.misc || {};
            window.SagnikContent.renderNav(misc.pages || []);
            window.SagnikContent.renderFooterContacts(misc.contactLinks || []);

            const aboutCopy = (misc.aboutCopy || []).reduce((copy, row) => {
                copy[row.key] = row.value;
                return copy;
            }, {});
            app.setTextByDataset("[data-about-copy]", "aboutCopy", aboutCopy);

            const heroImage = document.getElementById("about-hero-image");
            if (heroImage && aboutCopy.heroImage) {
                heroImage.src = aboutCopy.heroImage;
            }

            const highlights = document.getElementById("about-highlight-stack");
            if (highlights) {
                highlights.innerHTML = (misc.aboutHighlights || []).map(item => `
                    <article class="about-highlight-card">
                        <div class="about-highlight-icon"><i class="fa-solid ${app.escapeHtml(item.icon)}"></i></div>
                        <div>
                            <h3>${app.escapeHtml(item.title)}</h3>
                            <p>${app.escapeHtml(item.description)}</p>
                        </div>
                    </article>
                `).join("");
            }

            const work = document.getElementById("about-current-work-grid");
            if (work) {
                work.innerHTML = content.resolveHighlights("aboutWork").map(item => `
                    <article class="about-work-card">
                        <div class="work-card-top">
                            <div class="work-icon ${app.escapeHtml(item.iconClass)}"><i class="fa-solid ${app.escapeHtml(item.icon)}"></i></div>
                            <span>${app.escapeHtml(item.label)}</span>
                        </div>
                        <h3>${app.escapeHtml(item.title)}</h3>
                        <p>${app.escapeHtml(item.description)}</p>
                        <div class="compact-link-row">
                            <a href="${app.escapeHtml(item.target)}" target="${app.externalTarget(item.target)}">${app.escapeHtml(item.actionLabel)} -></a>
                        </div>
                    </article>
                `).join("");
            }

            const skills = document.getElementById("about-skill-grid");
            if (skills) {
                skills.innerHTML = (misc.aboutSkillCards || []).map(item => `
                    <div class="about-skill-card">
                        <i class="fa-solid ${app.escapeHtml(item.icon)}"></i>
                        <h3>${app.escapeHtml(item.title)}</h3>
                        <p>${app.escapeHtml(item.description)}</p>
                    </div>
                `).join("");
            }

            const education = document.getElementById("about-education-list");
            if (education) {
                education.innerHTML = (content.education || []).map(item => `
                    <article class="about-timeline-item">
                        <span>${app.escapeHtml(item.date)}</span>
                        <h3>${app.escapeHtml(item.institution)}</h3>
                        <p>${app.escapeHtml(item.degree)}</p>
                    </article>
                `).join("");
            }

            const experience = document.getElementById("about-experience-list");
            if (experience) {
                experience.innerHTML = (misc.aboutExperience || []).map(item => `
                    <article class="about-timeline-item">
                        <span>${app.escapeHtml(item.date)}</span>
                        <h3>${app.escapeHtml(item.title)}</h3>
                        <p>${app.escapeHtml(item.org)}</p>
                    </article>
                `).join("");
            }
        } catch (error) {
            console.warn("About content files could not be loaded.", error);
        }
    }

    function openTab(tabName, button) {
        document.querySelectorAll(".tab-links").forEach(tab => tab.classList.remove("active-link"));
        document.querySelectorAll(".tab-contents").forEach(tab => tab.classList.remove("active-tab"));

        document.getElementById(tabName)?.classList.add("active-tab");
        button?.classList.add("active-link");
    }

    document.addEventListener("DOMContentLoaded", () => {
        app.initCommon();
        document.querySelectorAll("[data-about-tab]").forEach(button => {
            button.addEventListener("click", () => openTab(button.dataset.aboutTab, button));
        });
        hydrateAboutContent();
    });
})();
