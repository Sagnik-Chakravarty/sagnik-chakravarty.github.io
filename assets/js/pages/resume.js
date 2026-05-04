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
    let longResumeMode = true;
    let removeScrollSpy;

    function panel() {
        return document.getElementById("resume-content");
    }

    function setActiveTab(section) {
        document.querySelectorAll(".resume-tab").forEach(button => button.classList.remove("active"));
        document.querySelector(`.resume-scroll-rail a[href="#${section}"]`)?.classList.add("active");
    }

    function pulseResumeControl(control) {
        if (!control) return;

        control.classList.remove("resume-control-pulse");
        void control.offsetWidth;
        control.classList.add("resume-control-pulse");
        window.clearTimeout(control._resumePulseTimer);
        control._resumePulseTimer = window.setTimeout(() => {
            control.classList.remove("resume-control-pulse");
        }, 420);
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

    function navigateResumeSection(section, smooth = true, animate = true) {
        if (!section) return;

        history.replaceState(null, "", `#${section}`);
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
                        <p class="section-eyebrow">${app.escapeHtml(resumeCopy.overviewEyebrow || "Welcome")}</p>
                        <h2>${app.escapeHtml(resumeCopy.overviewTitle || "Resume Overview")}</h2>
                        <p class="welcome-intro">${app.escapeHtml(resumeCopy.overviewLead || "")}</p>
                    </div>
                    ${askButton("Summarize Sagnik's resume for a recruiter. Highlight education, research experience, skills, strongest projects, and measurable outcomes.", "Ask summary")}
                </div>

                <div class="recruiter-summary-card-v2">
                    <div class="recruiter-summary-icon-v2">
                        <i class="fa-solid fa-bolt"></i>
                    </div>

                    <div>
                        <p class="section-eyebrow">${app.escapeHtml(resumeCopy.recruiterEyebrow || "30-second recruiter summary")}</p>
                        <h3>${app.escapeHtml(resumeCopy.recruiterTitle || "")}</h3>
                        <p>${app.escapeHtml(resumeCopy.recruiterBody || "")}</p>

                        <div class="recruiter-summary-actions-v2">
                            <button data-ask-sagnik="Give a 30-second recruiter summary of Sagnik. Highlight his strongest evidence for data science, survey methodology, NLP, LLM systems, and research roles.">Ask SagnikGPT for recruiter summary -></button>
                            <button data-ask-sagnik="Evaluate Sagnik for a data scientist role. Be specific about strengths, project evidence, tools, and possible gaps.">Evaluate for data scientist -></button>
                            <button data-ask-sagnik="Evaluate Sagnik for a survey methodologist or survey data scientist role. Use ASHA, Detroit sampling, Michigan sampling, coursework, and TA experience.">Evaluate for survey role -></button>
                        </div>
                    </div>
                </div>

                <div class="resume-overview-grid-v2">
                    ${resumeOverviewCards.map(card => `
                        <a href="#${app.escapeHtml(card.section)}" class="resume-overview-card-link" data-resume-nav="${app.escapeHtml(card.section)}">
                            <i class="fa-solid ${app.escapeHtml(card.icon)}"></i>
                            <h3>${app.escapeHtml(card.title)}</h3>
                            <p>${app.escapeHtml(card.description)}</p>
                            <span>${app.escapeHtml(card.actionLabel)} -></span>
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
                    <p class="section-eyebrow">Education Timeline</p>
                    <h2>Academic Background</h2>
                    <p class="welcome-intro">Click an institution to open coursework. Click any course to ask SagnikGPT how that subject supports my profile.</p>
                </div>
                ${askButton("Explain Sagnik's academic trajectory from Statistics to Data Science to Survey and Data Science. Connect coursework to his research profile.", "Ask academic trajectory")}
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
            <button class="back-btn-v2" data-resume-section="education">← Back to Education</button>

            <div class="detail-header-v2">
                <div>
                    <p class="section-eyebrow">Education Detail</p>
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
                <strong>Academic focus:</strong> ${app.escapeHtml(edu.focus)}
            </div>

            <div class="resume-section-header-v2 course-header-row">
                <div>
                    <h3>Coursework</h3>
                    <p>Click a subject to ask SagnikGPT how it connects to my training and research profile.</p>
                </div>
                ${askButton(`How did Sagnik perform academically at ${edu.institution}? Explain how his coursework in ${edu.degree} supports his research and job profile.`, "Ask about this degree ->")}
            </div>

            <div class="course-grid-v2">
                ${edu.courses.map(course => `
                    <button data-ask-sagnik="${app.escapeHtml(`How did Sagnik use or benefit from the course: ${course} at ${edu.institution}? Connect it to his research, projects, and technical profile.`)}">
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
                    <p class="section-eyebrow">Experience</p>
                    <h2>Research, Teaching, and Industry</h2>
                    <p class="welcome-intro">Choose a category to open a timeline. Each entry expands into responsibilities, methods, metrics, and end results.</p>
                </div>
                ${askButton("Summarize Sagnik's experience across research, teaching, and industry. Highlight evidence and role fit.", "Ask experience summary")}
            </div>

            <div class="red-divider"></div>

            <div class="resume-overview-grid-v2 three">
                ${resumeExperienceCategories.map(category => `
                    <article data-experience-section="${app.escapeHtml(category.section)}" data-experience-heading="${app.escapeHtml(category.heading)}">
                        <i class="fa-solid ${app.escapeHtml(category.icon)}"></i>
                        <h3>${app.escapeHtml(category.title)}</h3>
                        <p>${app.escapeHtml(category.description)}</p>
                        <span>Open ${app.escapeHtml(category.title.toLowerCase())} timeline -></span>
                    </article>
                `).join("")}
            </div>
        `;
    }

    function renderExperienceTimeline(sectionName, heading) {
        const entries = Object.entries(experienceData).filter(([, item]) => item.section === sectionName);

        panel().innerHTML = `
            <button class="back-btn-v2" data-resume-section="experience">← Back to Experience</button>

            <div class="resume-section-header-v2">
                <div>
                    <p class="section-eyebrow">Experience Timeline</p>
                    <h2>${app.escapeHtml(heading)}</h2>
                    <p class="welcome-intro">Click any entry to view detailed responsibilities, methods, metrics, and SagnikGPT prompt.</p>
                </div>
                ${askButton(`Summarize Sagnik's ${heading}. Give specific evidence, methods, metrics, and role fit.`, `Ask about ${heading} ->`)}
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

        const paperButton = item.paper ? `<a href="${app.escapeHtml(item.paper)}" target="_blank" class="paper-btn">Paper / Report</a>` : "";
        const websiteButton = item.website ? `<a href="${app.escapeHtml(item.website)}" target="_blank" class="paper-btn secondary-paper-btn">Dashboard</a>` : "";
        const posterButton = item.poster ? `<button class="paper-btn secondary-paper-btn" data-poster-src="${app.escapeHtml(item.poster)}" data-poster-title="${app.escapeHtml(item.org)}">Poster</button>` : "";

        panel().innerHTML = `
            <button class="back-btn-v2" data-experience-section="${app.escapeHtml(item.section)}" data-experience-heading="${app.escapeHtml(sectionTitle(item.section))}">← Back</button>

            <div class="detail-header-v2">
                <div>
                    <p class="section-eyebrow">Experience Detail</p>
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
                <strong>End result:</strong> ${app.escapeHtml(item.result)}
            </div>

            <div class="detail-body-v2">
                ${item.details}
            </div>

            <div class="project-buttons-v2">
                ${paperButton}
                ${websiteButton}
                ${posterButton}
                <button class="paper-btn secondary-paper-btn" data-ask-sagnik="${app.escapeHtml(item.question)}">Ask SagnikGPT about this role</button>
            </div>
        `;
    }

    function sectionTitle(section) {
        if (section === "research") return "Research Experience";
        if (section === "teaching") return "Teaching Experience";
        if (section === "industry") return "Industry Experience";
        return "Experience";
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
                    <p class="section-eyebrow">Projects Timeline</p>
                    <h2>Projects, Papers, Reports, and Posters</h2>
                    <p class="welcome-intro">Click a project to open objective, abstract, motivation, methods, results, metrics, paper/report, poster, GitHub, and SagnikGPT prompt.</p>
                </div>
                ${askButton("Which of Sagnik's projects are strongest for data science, NLP, survey methodology, and ML roles? Rank them using metrics and outcomes.", "Ask project fit")}
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

        const paperButton = project.paper ? `<a href="${app.escapeHtml(project.paper)}" target="_blank" class="paper-btn">Paper / Report</a>` : "";
        const slidesButton = project.slides ? `<a href="${app.escapeHtml(project.slides)}" target="_blank" class="paper-btn secondary-paper-btn">Prelim Slides</a>` : "";
        const githubButton = project.github ? `<a href="${app.escapeHtml(project.github)}" target="_blank" class="paper-btn secondary-paper-btn">GitHub</a>` : "";
        const websiteButton = project.website ? `<a href="${app.escapeHtml(project.website)}" target="_blank" class="paper-btn secondary-paper-btn">Website</a>` : "";
        const posterButton = project.poster ? `<button class="paper-btn secondary-paper-btn" data-poster-src="${app.escapeHtml(project.poster)}" data-poster-title="${app.escapeHtml(project.title)}">Poster</button>` : "";

        panel().innerHTML = `
            <button class="back-btn-v2" data-resume-section="projects">← Back to Projects</button>

            <div class="detail-header-v2">
                <div>
                    <p class="section-eyebrow">Project Detail</p>
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
                        ${detailSection("Objective", project.objective)}
                        ${detailSection("Abstract", project.abstract)}
                        ${detailSection("Motivation", project.motivation)}
                        ${detailSection("Methods", project.methods)}
                        ${detailSection("End Results", project.results)}
                        ${detailSection("Research / Business Insight", project.insight)}
                    </div>

                    <div class="project-buttons-v2">
                        ${paperButton}
                        ${slidesButton}
                        ${githubButton}
                        ${websiteButton}
                        ${posterButton}
                        <button class="paper-btn secondary-paper-btn" data-ask-sagnik="${app.escapeHtml(project.question)}">Ask SagnikGPT</button>
                    </div>
                </div>

                <aside class="project-detail-poster-v2">
                    <img src="${app.escapeHtml(project.poster)}" alt="${app.escapeHtml(project.title)} poster" data-hide-on-error="true" data-poster-src="${app.escapeHtml(project.poster)}" data-poster-title="${app.escapeHtml(project.title)}">
                    <p>Click poster to enlarge</p>
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
                    <p class="section-eyebrow">Skills</p>
                    <h2>Skills with Evidence</h2>
                    <p class="welcome-intro">Each skill block is connected to project, coursework, or experience evidence. Click any skill to ask SagnikGPT for a recruiter-style explanation.</p>
                </div>
                ${askButton("Summarize Sagnik's strongest skills with evidence from projects, coursework, research experience, and metrics.", "Ask skill summary")}
            </div>

            <div class="skill-project-matrix-v2">
                <div class="matrix-header-v2">
                    <span>Skill Area</span>
                    <span>Project Evidence</span>
                    <span>Methods / Tools</span>
                    <span>Action</span>
                </div>

                ${resumeSkillMatrix.map(row => `
                    <div class="matrix-row-v2">
                        <div>
                            <strong>${app.escapeHtml(row.title)}</strong>
                            <p>${app.escapeHtml(row.description)}</p>
                        </div>
                        <div>${app.escapeHtml(row.evidence).replaceAll("|", "·")}</div>
                        <div>${app.escapeHtml(row.methods).replaceAll("|", "·")}</div>
                        <button data-ask-sagnik="${app.escapeHtml(row.prompt)}">Ask evidence -></button>
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
                        <em>Ask SagnikGPT for evidence -></em>
                    </article>
                `).join("")}
            </div>
        `;
    }

    function bindEvents() {
        document.addEventListener("click", event => {
            const control = event.target.closest("[data-resume-nav], [data-resume-section]");
            if (!control) return;

            event.preventDefault();
            event.stopImmediatePropagation();
            pulseResumeControl(control);

            const section = control.dataset.resumeNav || control.dataset.resumeSection || "";
            if (!section) return;

            navigateResumeSection(section, true, true);
        }, true);

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
        navigateSection: navigateResumeSection
    };

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
