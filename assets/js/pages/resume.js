(function () {
    const app = window.SagnikApp;
    let posterModal;
    let educationData = {};
    let experienceData = {};
    let projectData = {};
    let skillData = [];
    let resumeOverviewCards = [];
    let resumeExperienceCategories = [];
    let resumeSkillMatrix = [];
    let resumeCopy = {};
    let resumeHeroKpis = [];
    let longResumeMode = false;
    let removeScrollSpy;

    function panel() {
        return document.getElementById("resume-content");
    }

    function setActiveTab(section) {
        document.querySelectorAll(".resume-tab").forEach(button => button.classList.remove("active"));
        const legacyTab = document.getElementById(`tab-${section}`);
        if (legacyTab) legacyTab.classList.add("active");

        document.querySelectorAll(".resume-simple-tabs [data-resume-nav]").forEach(button => {
            button.classList.toggle("active", button.dataset.resumeNav === section);
        });
    }

    function applyResumeCopy() {
        app.setTextByDataset("[data-resume-copy]", "resumeCopy", resumeCopy);

        const kpis = document.getElementById("resume-hero-kpis");
        if (kpis) {
            kpis.innerHTML = resumeHeroKpis.map(item => `
                <div><strong>${app.escapeHtml(item.value)}</strong><p>${app.escapeHtml(item.label)}</p></div>
            `).join("");
        }
    }

    function copyText(key, fallback = "") {
        return resumeCopy[key] || fallback;
    }

    function formatText(template, values = {}) {
        return String(template || "").replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => values[key] ?? "");
    }

    async function hydrateResumeContent() {
        if (!window.SagnikContent) return;

        try {
            const content = await window.SagnikContent.loadAll();
            window.SagnikContent.renderNav(content.misc?.pages || []);
            window.SagnikContent.renderFooterContacts(content.misc?.contactLinks || []);

            educationData = app.mergeById(educationData, content.educationData);
            experienceData = app.mergeById(experienceData, content.experienceData);
            projectData = app.mergeById(projectData, content.projectData);
            resumeOverviewCards = content.misc?.resumeOverviewCards || [];
            resumeExperienceCategories = content.misc?.resumeExperienceCategories || [];
            resumeSkillMatrix = content.misc?.resumeSkillMatrix || [];
            resumeHeroKpis = content.misc?.resumeHeroKpis || [];
            resumeCopy = (content.misc?.resumeCopy || []).reduce((copy, row) => {
                copy[row.key] = row.value;
                return copy;
            }, {});
            applyResumeCopy();

            if (content.skills?.length) {
                skillData = content.skills.map(skill => ({
                    title: skill.title,
                    icon: skill.icon,
                    description: skill.description,
                    evidence: skill.evidence || [],
                    question: skill.question
                }));
            }
        } catch (error) {
            console.warn("Resume content files could not be loaded.", error);
        }
    }

    function showSection(section) {
        setActiveTab(section);

        if (section === "overview") showOverview();
        if (section === "education") showEducation();
        if (section === "experience") showExperienceLanding();
        if (section === "projects") showProjects();
        if (section === "skills") showSkills();
    }

    function sectionFromHash() {
        const section = window.location.hash.replace("#", "").trim().toLowerCase();
        const validSections = ["overview", "education", "experience", "projects", "skills"];
        return validSections.includes(section) ? section : "overview";
    }

    function showSectionFromHash() {
        if (longResumeMode) {
            scrollToResumeSection(sectionFromHash(), false);
            return;
        }

        showSection(sectionFromHash());
    }

    function captureSection(renderFn) {
        renderFn();
        return panel().innerHTML;
    }

    function renderLongResume() {
        const sections = [
            ["overview", captureSection(showOverview)],
            ["education", captureSection(showEducation)],
            ["experience", captureSection(showExperienceLanding)],
            ["projects", captureSection(showProjects)],
            ["skills", captureSection(showSkills)]
        ];

        panel().innerHTML = sections.map(([id, html]) => `
            <section class="resume-long-section" id="${app.escapeHtml(id)}" data-resume-long-section="${app.escapeHtml(id)}">
                ${html}
            </section>
        `).join("");

        initResumeScrollSpy();
        scrollToResumeSection(sectionFromHash(), false);
    }

    function setActiveRail(section) {
        document.querySelectorAll(".resume-scroll-rail a[href^='#']").forEach(link => {
            link.classList.toggle("active", link.getAttribute("href") === `#${section}`);
        });
    }

    function animateResumeSection(target) {
        if (!target) return;

        target.classList.remove("resume-long-section-enter");
        target.classList.add("resume-long-section-enter");
        window.clearTimeout(target._resumeEnterTimer);
        target._resumeEnterTimer = window.setTimeout(() => {
            target.classList.remove("resume-long-section-enter");
        }, 520);
    }

    function scrollToResumeSection(section, smooth = true, animate = true) {
        const target = document.getElementById(section);
        if (!target) {
            if (!document.querySelector("[data-resume-long-section]")) {
                renderLongResume();
                requestAnimationFrame(() => scrollToResumeSection(section, smooth, animate));
            }
            return;
        }

        setActiveRail(section);
        if (animate) animateResumeSection(target);

        const top = target.getBoundingClientRect().top + window.scrollY - 128;
        window.scrollTo({ top: Math.max(0, top), behavior: smooth ? "smooth" : "auto" });
    }

    function updateResumeHash(section) {
        const nextUrl = `${window.location.pathname}${window.location.search}#${section}`;
        try {
            history.replaceState(null, "", nextUrl);
        } catch (error) {
            window.location.hash = section;
        }
    }

    function navigateResumeSection(section, smooth = true, animate = true) {
        if (!section) return;

        updateResumeHash(section);
        if (longResumeMode) {
            scrollToResumeSection(section, smooth, animate);
            return;
        }

        showSection(section);
    }

    function initResumeScrollSpy() {
        if (removeScrollSpy) removeScrollSpy();

        const sections = Array.from(document.querySelectorAll("[data-resume-long-section]"));
        if (!sections.length) return;

        const updateActiveSection = () => {
            const marker = 145;
            const current = sections.find(section => {
                const box = section.getBoundingClientRect();
                return box.top <= marker && box.bottom > marker;
            }) || sections[0];

            setActiveRail(current.dataset.resumeLongSection);
        };

        window.addEventListener("scroll", updateActiveSection, { passive: true });
        window.addEventListener("resize", updateActiveSection);
        removeScrollSpy = () => {
            window.removeEventListener("scroll", updateActiveSection);
            window.removeEventListener("resize", updateActiveSection);
        };
        updateActiveSection();
    }

    function askButton(prompt, label, classes = "resume-ask-inline") {
        return `
            <button class="${classes}" data-ask-sagnik="${app.escapeHtml(prompt)}">
                <i class="fa-solid fa-message"></i>
                ${app.escapeHtml(label)}
            </button>
        `;
    }

    function showOverview() {
        panel().innerHTML = `
            <div class="resume-welcome-screen">
                <div class="resume-section-header-v2">
                    <div>
                        <p class="section-eyebrow">${app.escapeHtml(copyText("overviewEyebrow"))}</p>
                        <h2>${app.escapeHtml(copyText("overviewTitle"))}</h2>
                        <p class="welcome-intro">${app.escapeHtml(copyText("overviewLead"))}</p>
                    </div>
                    ${askButton(copyText("overviewAskPrompt"), copyText("overviewAskLabel"))}
                </div>

                <div class="recruiter-summary-card-v2">
                    <div class="recruiter-summary-icon-v2">
                        <i class="fa-solid fa-bolt"></i>
                    </div>

                    <div>
                        <p class="section-eyebrow">${app.escapeHtml(copyText("recruiterEyebrow"))}</p>
                        <h3>${app.escapeHtml(copyText("recruiterTitle"))}</h3>
                        <p>${app.escapeHtml(copyText("recruiterBody"))}</p>

                        <div class="recruiter-summary-actions-v2">
                            <button data-ask-sagnik="${app.escapeHtml(copyText("recruiterAskSummaryPrompt"))}">${app.escapeHtml(copyText("recruiterAskSummaryLabel"))}</button>
                            <button data-ask-sagnik="${app.escapeHtml(copyText("recruiterDataScientistPrompt"))}">${app.escapeHtml(copyText("recruiterDataScientistLabel"))}</button>
                            <button data-ask-sagnik="${app.escapeHtml(copyText("recruiterSurveyRolePrompt"))}">${app.escapeHtml(copyText("recruiterSurveyRoleLabel"))}</button>
                        </div>
                    </div>
                </div>

                <div class="resume-overview-grid-v2">
                    ${resumeOverviewCards.map(card => `
                        <a href="#${app.escapeHtml(card.section)}" class="resume-overview-card-link" data-resume-nav="${app.escapeHtml(card.section)}">
                            <i class="fa-solid ${app.escapeHtml(card.icon)}"></i>
                            <h3>${app.escapeHtml(card.title)}</h3>
                            <p>${app.escapeHtml(card.description)}</p>
                            <span>${app.escapeHtml(card.actionLabel)}</span>
                        </a>
                    `).join("")}
                </div>
            </div>
        `;
    }

    function showEducation() {
        panel().innerHTML = `
            <div class="resume-section-header-v2">
                <div>
                    <p class="section-eyebrow">${app.escapeHtml(copyText("educationEyebrow"))}</p>
                    <h2>${app.escapeHtml(copyText("educationTitle"))}</h2>
                    <p class="welcome-intro">${app.escapeHtml(copyText("educationLead"))}</p>
                </div>
                ${askButton(copyText("educationAskPrompt"), copyText("educationAskLabel"))}
            </div>

            <div class="red-divider"></div>

            <div class="resume-timeline-v2">
                ${Object.entries(educationData).map(([id, edu]) => `
                    <article class="resume-timeline-item-v2" data-education-id="${app.escapeHtml(id)}">
                        <div class="resume-time-v2">${app.escapeHtml(edu.date)}</div>
                        <div class="resume-timeline-card-v2">
                            <div class="timeline-card-icon"><i class="fa-solid fa-graduation-cap"></i></div>
                            <div>
                                <h3>${app.escapeHtml(edu.institution)}</h3>
                                <p class="project-meta-small">${app.escapeHtml(edu.degree)}</p>
                                <p>${app.escapeHtml(edu.focus)}</p>
                                <div class="resume-mini-metric-grid-v2">
                                    ${edu.metrics.map(metric => `<div><strong>${app.escapeHtml(metric[0])}</strong><span>${app.escapeHtml(metric[1])}</span></div>`).join("")}
                                </div>
                            </div>
                        </div>
                    </article>
                `).join("")}
            </div>
        `;
    }

    function showEducationDetail(id) {
        const edu = educationData[id];
        if (!edu) return;

        panel().innerHTML = `
            <button class="back-btn-v2" data-resume-section="education">${app.escapeHtml(copyText("educationBackLabel"))}</button>

            <div class="detail-header-v2">
                <div>
                    <p class="section-eyebrow">${app.escapeHtml(copyText("educationDetailEyebrow"))}</p>
                    <h2>${app.escapeHtml(edu.institution)}</h2>
                    <p class="detail-subtitle">${app.escapeHtml(edu.degree)}</p>
                </div>
                <span class="detail-date">${app.escapeHtml(edu.date)}</span>
            </div>

            <div class="red-divider"></div>

            <div class="resume-detail-metrics-v2">
                ${edu.metrics.map(metric => `<div><strong>${app.escapeHtml(metric[0])}</strong><span>${app.escapeHtml(metric[1])}</span></div>`).join("")}
            </div>

            <div class="resume-result-box-v2">
                <strong>${app.escapeHtml(copyText("academicFocusLabel"))}</strong> ${app.escapeHtml(edu.focus)}
            </div>

            <div class="resume-section-header-v2 course-header-row">
                <div>
                    <h3>${app.escapeHtml(copyText("courseworkTitle"))}</h3>
                    <p>${app.escapeHtml(copyText("courseworkLead"))}</p>
                </div>
                ${askButton(formatText(copyText("degreeAskPromptTemplate"), { institution: edu.institution, degree: edu.degree }), copyText("degreeAskLabel"))}
            </div>

            <div class="course-grid-v2">
                ${edu.courses.map(course => `
                    <button data-ask-sagnik="${app.escapeHtml(formatText(copyText("courseAskPromptTemplate"), { course, institution: edu.institution }))}">
                        ${app.escapeHtml(course)}
                    </button>
                `).join("")}
            </div>
        `;
    }

    function showExperienceLanding() {
        panel().innerHTML = `
            <div class="resume-section-header-v2">
                <div>
                    <p class="section-eyebrow">${app.escapeHtml(copyText("experienceEyebrow"))}</p>
                    <h2>${app.escapeHtml(copyText("experienceTitle"))}</h2>
                    <p class="welcome-intro">${app.escapeHtml(copyText("experienceLead"))}</p>
                </div>
                ${askButton(copyText("experienceAskPrompt"), copyText("experienceAskLabel"))}
            </div>

            <div class="red-divider"></div>

            <div class="resume-overview-grid-v2 three">
                ${resumeExperienceCategories.map(category => `
                    <article data-experience-section="${app.escapeHtml(category.section)}" data-experience-heading="${app.escapeHtml(category.heading)}">
                        <i class="fa-solid ${app.escapeHtml(category.icon)}"></i>
                        <h3>${app.escapeHtml(category.title)}</h3>
                        <p>${app.escapeHtml(category.description)}</p>
                        <span>${app.escapeHtml(formatText(copyText("experienceCategoryActionTemplate"), { title: category.title.toLowerCase() }))}</span>
                    </article>
                `).join("")}
            </div>
        `;
    }

    function renderExperienceTimeline(sectionName, heading) {
        const entries = Object.entries(experienceData).filter(([, item]) => item.section === sectionName);

        panel().innerHTML = `
            <button class="back-btn-v2" data-resume-section="experience">${app.escapeHtml(copyText("experienceBackLabel"))}</button>

            <div class="resume-section-header-v2">
                <div>
                    <p class="section-eyebrow">${app.escapeHtml(copyText("experienceTimelineEyebrow"))}</p>
                    <h2>${app.escapeHtml(heading)}</h2>
                    <p class="welcome-intro">${app.escapeHtml(copyText("experienceTimelineLead"))}</p>
                </div>
                ${askButton(formatText(copyText("experienceTimelineAskPromptTemplate"), { heading }), formatText(copyText("experienceTimelineAskLabelTemplate"), { heading }))}
            </div>

            <div class="red-divider"></div>

            <div class="resume-timeline-v2">
                ${entries.map(([id, item]) => `
                    <article class="resume-timeline-item-v2" data-experience-id="${app.escapeHtml(id)}">
                        <div class="resume-time-v2">${app.escapeHtml(item.date)}</div>
                        <div class="resume-timeline-card-v2">
                            <div class="timeline-card-icon"><i class="fa-solid ${app.escapeHtml(item.icon)}"></i></div>
                            <div>
                                <h3>${app.escapeHtml(item.org)}</h3>
                                <p class="project-meta-small">${app.escapeHtml(item.title)}</p>
                                <p>${app.escapeHtml(item.result)}</p>
                                <div class="tag-row-v2">
                                    ${item.tags.map(tag => `<span>${app.escapeHtml(tag)}</span>`).join("")}
                                </div>
                            </div>
                        </div>
                    </article>
                `).join("")}
            </div>
        `;
    }

    function showExperienceDetail(id) {
        const item = experienceData[id];
        if (!item) return;

        const paperButton = item.paper ? `<a href="${app.escapeHtml(item.paper)}" target="_blank" class="paper-btn">${app.escapeHtml(copyText("paperButtonLabel"))}</a>` : "";
        const websiteButton = item.website ? `<a href="${app.escapeHtml(item.website)}" target="_blank" class="paper-btn secondary-paper-btn">${app.escapeHtml(copyText("dashboardButtonLabel"))}</a>` : "";
        const posterButton = item.poster ? `<button class="paper-btn secondary-paper-btn" data-poster-src="${app.escapeHtml(item.poster)}" data-poster-title="${app.escapeHtml(item.org)}">${app.escapeHtml(copyText("posterButtonLabel"))}</button>` : "";

        panel().innerHTML = `
            <button class="back-btn-v2" data-experience-section="${app.escapeHtml(item.section)}" data-experience-heading="${app.escapeHtml(sectionTitle(item.section))}">${app.escapeHtml(copyText("experienceBackShortLabel"))}</button>

            <div class="detail-header-v2">
                <div>
                    <p class="section-eyebrow">${app.escapeHtml(copyText("experienceDetailEyebrow"))}</p>
                    <h2>${app.escapeHtml(item.org)}</h2>
                    <p class="detail-subtitle">${app.escapeHtml(item.title)}</p>
                </div>
                <span class="detail-date">${app.escapeHtml(item.date)}</span>
            </div>

            <div class="red-divider"></div>

            <div class="tag-row-v2 detail-tags">
                ${item.tags.map(tag => `<span>${app.escapeHtml(tag)}</span>`).join("")}
            </div>

            <div class="resume-detail-metrics-v2">
                ${item.metrics.map(metric => `<div><strong>${app.escapeHtml(metric[0])}</strong><span>${app.escapeHtml(metric[1])}</span></div>`).join("")}
            </div>

            <div class="resume-result-box-v2">
                <strong>${app.escapeHtml(copyText("experienceResultLabel"))}</strong> ${app.escapeHtml(item.result)}
            </div>

            <div class="detail-body-v2">
                ${item.details}
            </div>

            <div class="project-buttons-v2">
                ${paperButton}
                ${websiteButton}
                ${posterButton}
                <button class="paper-btn secondary-paper-btn" data-ask-sagnik="${app.escapeHtml(item.question)}">${app.escapeHtml(copyText("experienceAskRoleLabel"))}</button>
            </div>
        `;
    }

    function sectionTitle(section) {
        if (section === "research") return copyText("sectionTitleResearch");
        if (section === "teaching") return copyText("sectionTitleTeaching");
        if (section === "industry") return copyText("sectionTitleIndustry");
        return copyText("sectionTitleDefault");
    }

    function showProjects() {
        const sortedProjects = Object.entries(projectData).sort((a, b) => {
            const yearA = parseInt(a[1].date.match(/\d{4}/)?.[0] || "0", 10);
            const yearB = parseInt(b[1].date.match(/\d{4}/)?.[0] || "0", 10);
            return yearB - yearA;
        });

        panel().innerHTML = `
            <div class="resume-section-header-v2">
                <div>
                    <p class="section-eyebrow">${app.escapeHtml(copyText("projectsEyebrow"))}</p>
                    <h2>${app.escapeHtml(copyText("projectsTitle"))}</h2>
                    <p class="welcome-intro">${app.escapeHtml(copyText("projectsLead"))}</p>
                </div>
                ${askButton(copyText("projectsAskPrompt"), copyText("projectsAskLabel"))}
            </div>

            <div class="red-divider"></div>

            <div class="resume-timeline-v2">
                ${sortedProjects.map(([id, project]) => `
                    <article class="resume-timeline-item-v2" data-project-id="${app.escapeHtml(id)}">
                        <div class="resume-time-v2">${app.escapeHtml(project.date)}</div>
                        <div class="resume-timeline-card-v2 project-card-wide">
                            <div class="timeline-card-icon"><i class="fa-solid fa-diagram-project"></i></div>
                            <div class="timeline-project-text">
                                <h3>${app.escapeHtml(project.title)}</h3>
                                <p class="project-meta-small">${app.escapeHtml(project.meta)}</p>
                                <p>${app.escapeHtml(project.summary)}</p>
                                <div class="resume-mini-metric-grid-v2">
                                    ${project.metrics.map(metric => `<div><strong>${app.escapeHtml(metric[0])}</strong><span>${app.escapeHtml(metric[1])}</span></div>`).join("")}
                                </div>
                            </div>
                            <div class="timeline-project-poster">
                                <img src="${app.escapeHtml(project.poster)}" alt="${app.escapeHtml(project.title)} poster" data-hide-on-error="true" data-stop-card-click data-poster-src="${app.escapeHtml(project.poster)}" data-poster-title="${app.escapeHtml(project.title)}">
                            </div>
                        </div>
                    </article>
                `).join("")}
            </div>
        `;
    }

    function showProjectDetail(id) {
        const project = projectData[id];
        if (!project) return;

        const paperButton = project.paper ? `<a href="${app.escapeHtml(project.paper)}" target="_blank" class="paper-btn">${app.escapeHtml(copyText("paperButtonLabel"))}</a>` : "";
        const slidesButton = project.slides ? `<a href="${app.escapeHtml(project.slides)}" target="_blank" class="paper-btn secondary-paper-btn">${app.escapeHtml(copyText("slidesButtonLabel"))}</a>` : "";
        const githubButton = project.github ? `<a href="${app.escapeHtml(project.github)}" target="_blank" class="paper-btn secondary-paper-btn">${app.escapeHtml(copyText("githubButtonLabel"))}</a>` : "";
        const websiteButton = project.website ? `<a href="${app.escapeHtml(project.website)}" target="_blank" class="paper-btn secondary-paper-btn">${app.escapeHtml(copyText("websiteButtonLabel"))}</a>` : "";
        const posterButton = project.poster ? `<button class="paper-btn secondary-paper-btn" data-poster-src="${app.escapeHtml(project.poster)}" data-poster-title="${app.escapeHtml(project.title)}">${app.escapeHtml(copyText("posterButtonLabel"))}</button>` : "";

        panel().innerHTML = `
            <button class="back-btn-v2" data-resume-section="projects">${app.escapeHtml(copyText("projectsBackLabel"))}</button>

            <div class="detail-header-v2">
                <div>
                    <p class="section-eyebrow">${app.escapeHtml(copyText("projectDetailEyebrow"))}</p>
                    <h2>${app.escapeHtml(project.title)}</h2>
                    <p class="detail-subtitle">${app.escapeHtml(project.meta)}</p>
                </div>
                <span class="detail-date">${app.escapeHtml(project.date)}</span>
            </div>

            <div class="red-divider"></div>

            <div class="project-detail-layout-v2">
                <div class="project-detail-text-v2">
                    <div class="resume-detail-metrics-v2">
                        ${project.metrics.map(metric => `<div><strong>${app.escapeHtml(metric[0])}</strong><span>${app.escapeHtml(metric[1])}</span></div>`).join("")}
                    </div>

                    <div class="project-writing-grid">
                        ${detailSection(copyText("projectObjectiveTitle"), project.objective)}
                        ${detailSection(copyText("projectAbstractTitle"), project.abstract)}
                        ${detailSection(copyText("projectMotivationTitle"), project.motivation)}
                        ${detailSection(copyText("projectMethodsTitle"), project.methods)}
                        ${detailSection(copyText("projectResultsTitle"), project.results)}
                        ${detailSection(copyText("projectInsightTitle"), project.insight)}
                    </div>

                    <div class="project-buttons-v2">
                        ${paperButton}
                        ${slidesButton}
                        ${githubButton}
                        ${websiteButton}
                        ${posterButton}
                        <button class="paper-btn secondary-paper-btn" data-ask-sagnik="${app.escapeHtml(project.question)}">${app.escapeHtml(copyText("askSagnikButtonLabel"))}</button>
                    </div>
                </div>

                <aside class="project-detail-poster-v2">
                    <img src="${app.escapeHtml(project.poster)}" alt="${app.escapeHtml(project.title)} poster" data-hide-on-error="true" data-poster-src="${app.escapeHtml(project.poster)}" data-poster-title="${app.escapeHtml(project.title)}">
                    <p>${app.escapeHtml(copyText("posterHelpLabel"))}</p>
                </aside>
            </div>
        `;
    }

    function detailSection(title, body) {
        return `
            <section>
                <h3>${app.escapeHtml(title)}</h3>
                <p>${app.escapeHtml(body)}</p>
            </section>
        `;
    }

    function showSkills() {
        panel().innerHTML = `
            <div class="resume-section-header-v2">
                <div>
                    <p class="section-eyebrow">${app.escapeHtml(copyText("skillsEyebrow"))}</p>
                    <h2>${app.escapeHtml(copyText("skillsTitle"))}</h2>
                    <p class="welcome-intro">${app.escapeHtml(copyText("skillsLead"))}</p>
                </div>
                ${askButton(copyText("skillsAskPrompt"), copyText("skillsAskLabel"))}
            </div>

            <div class="red-divider"></div>
            <div class="skill-project-matrix-v2">
                <div class="matrix-header-v2">
                    <span>${app.escapeHtml(copyText("skillAreaHeader"))}</span>
                    <span>${app.escapeHtml(copyText("skillEvidenceHeader"))}</span>
                    <span>${app.escapeHtml(copyText("skillMethodsHeader"))}</span>
                    <span>${app.escapeHtml(copyText("skillActionHeader"))}</span>
                </div>

                ${resumeSkillMatrix.map(row => `
                    <div class="matrix-row-v2">
                        <div>
                            <strong>${app.escapeHtml(row.title)}</strong>
                            <p>${app.escapeHtml(row.description)}</p>
                        </div>
                        <div>${app.escapeHtml(row.evidence).replaceAll("|", "·")}</div>
                        <div>${app.escapeHtml(row.methods).replaceAll("|", "·")}</div>
                        <button data-ask-sagnik="${app.escapeHtml(row.prompt)}">${app.escapeHtml(copyText("skillEvidenceButtonLabel"))}</button>
                    </div>
                `).join("")}
            </div>

            <div class="resume-skill-grid-v2">
                ${skillData.map(skill => `
                    <article data-ask-sagnik="${app.escapeHtml(skill.question)}">
                        <i class="fa-solid ${app.escapeHtml(skill.icon)}"></i>
                        <h3>${app.escapeHtml(skill.title)}</h3>
                        <p>${app.escapeHtml(skill.description)}</p>
                        <div class="tag-row-v2">
                            ${skill.evidence.map(item => `<span>${app.escapeHtml(item)}</span>`).join("")}
                        </div>
                        <em>${app.escapeHtml(copyText("skillCardAskLabel"))}</em>
                    </article>
                `).join("")}
            </div>
        `;
    }

    function bindEvents() {
        document.addEventListener("click", event => {
            const poster = event.target.closest("[data-poster-src]");
            if (poster) {
                event.preventDefault();
                event.stopPropagation();
                posterModal.open(poster.dataset.posterSrc, poster.dataset.posterTitle || "Expanded");
                return;
            }

            const education = event.target.closest("[data-education-id]");
            if (education) {
                showEducationDetail(education.dataset.educationId);
                return;
            }

            const experience = event.target.closest("[data-experience-id]");
            if (experience) {
                showExperienceDetail(experience.dataset.experienceId);
                return;
            }

            const experienceSection = event.target.closest("[data-experience-section]");
            if (experienceSection) {
                renderExperienceTimeline(experienceSection.dataset.experienceSection, experienceSection.dataset.experienceHeading || sectionTitle(experienceSection.dataset.experienceSection));
                return;
            }

            const project = event.target.closest("[data-project-id]");
            if (project) {
                if (event.target.closest("[data-stop-card-click]")) return;
                showProjectDetail(project.dataset.projectId);
                return;
            }

        });

        window.addEventListener("hashchange", showSectionFromHash);
    }

    window.SagnikResume = {
        navigateSection: navigateResumeSection,
        showSection,
        showEducationDetail,
        showExperienceLanding,
        renderExperienceTimeline,
        showExperienceDetail,
        showProjects,
        showProjectDetail
    };

    window.showSection = section => navigateResumeSection(section, true, true);
    window.showEducation = showEducation;
    window.showExperienceLanding = showExperienceLanding;
    window.renderExperienceTimeline = renderExperienceTimeline;
    window.showProjects = showProjects;
    window.showSkills = showSkills;

    document.addEventListener("DOMContentLoaded", async () => {
        app.initCommon();
        posterModal = window.SagnikModal.createPosterModalController("poster-modal", "poster-modal-img");
        bindEvents();
        await hydrateResumeContent();
        if (longResumeMode) {
            renderLongResume();
        } else {
            showSectionFromHash();
        }
    });
})();
