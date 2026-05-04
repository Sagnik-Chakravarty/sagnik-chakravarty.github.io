(function () {
    const TEXT_ENCODER = new TextEncoder();
    const state = {
        files: {},
        handles: {},
        activePath: "",
        activeType: "",
        writable: false,
        contentHandle: null
    };

    const guide = {
        mode: "",
        stack: []
    };

    const elements = {};

    document.addEventListener("DOMContentLoaded", () => {
        cacheElements();
        bindEvents();
    });

    function cacheElements() {
        [
            "open-content-folder",
            "load-bundled-content",
            "guide-start",
            "guide-workspace",
            "guide-eyebrow",
            "guide-title",
            "guide-help",
            "guide-back",
            "guide-content",
            "toggle-advanced-editor",
            "advanced-shell",
            "new-markdown-file",
            "new-csv-file",
            "studio-status",
            "file-search",
            "file-nav",
            "empty-state",
            "editor",
            "editor-type",
            "editor-title",
            "editor-path",
            "editor-notice",
            "add-record-field",
            "add-section",
            "add-row",
            "add-column",
            "save-file",
            "download-file",
            "delete-file",
            "markdown-editor",
            "csv-editor",
            "frontmatter-fields",
            "markdown-sections",
            "csv-table",
            "raw-preview"
        ].forEach(id => {
            elements[id] = document.getElementById(id);
        });
    }

    function bindEvents() {
        on("open-content-folder", "click", openContentFolder);
        on("load-bundled-content", "click", loadBundledContent);
        on("guide-back", "click", guideBack);
        on("toggle-advanced-editor", "click", toggleAdvancedEditor);
        on("new-markdown-file", "click", () => createNewFile("markdown"));
        on("new-csv-file", "click", () => createNewFile("csv"));
        on("file-search", "input", renderFileNav);
        on("add-record-field", "click", () => addFieldRow("", ""));
        on("add-section", "click", () => addMarkdownSection("New Section", ""));
        on("add-row", "click", addCsvRow);
        on("add-column", "click", addCsvColumn);
        on("save-file", "click", saveActiveFile);
        on("download-file", "click", downloadActiveFile);
        on("delete-file", "click", deleteActiveFile);
        on("raw-preview", "input", syncFromRawPreview);

        document.addEventListener("input", event => {
            if (event.target.closest("#frontmatter-fields, #markdown-sections, #csv-table")) {
                updateRawPreview();
            }
        });

        document.addEventListener("click", event => {
            const guideMode = event.target.closest("[data-guide-mode]");
            if (guideMode) {
                startGuide(guideMode.dataset.guideMode);
                return;
            }

            const guideAction = event.target.closest("[data-guide-action]");
            if (guideAction) {
                handleGuideAction(guideAction.dataset.guideAction, guideAction.dataset);
                return;
            }

            const fileButton = event.target.closest("[data-file-path]");
            if (fileButton) {
                selectFile(fileButton.dataset.filePath);
                return;
            }

            const removeField = event.target.closest(".remove-field");
            if (removeField) {
                removeField.closest(".field-row")?.remove();
                updateRawPreview();
                return;
            }

            const removeSection = event.target.closest(".remove-section");
            if (removeSection) {
                removeSection.closest(".markdown-section-row")?.remove();
                updateRawPreview();
                return;
            }

            const removeRow = event.target.closest("[data-remove-csv-row]");
            if (removeRow) {
                removeRow.closest("tr")?.remove();
                updateRawPreview();
                return;
            }

            const removeColumn = event.target.closest("[data-remove-csv-column]");
            if (removeColumn) {
                removeCsvColumn(Number(removeColumn.dataset.removeCsvColumn));
            }
        });

        document.addEventListener("change", event => {
            const conditional = event.target.closest("[data-controls-panel]");
            if (conditional) {
                const panel = document.getElementById(conditional.dataset.controlsPanel);
                if (panel) panel.classList.toggle("show", conditional.checked);
            }
        });
    }

    function on(id, eventName, handler) {
        if (elements[id]) elements[id].addEventListener(eventName, handler);
    }

    function toggleAdvancedEditor() {
        const shell = elements["advanced-shell"];
        if (!shell) return;

        shell.hidden = !shell.hidden;
        elements["toggle-advanced-editor"].innerHTML = shell.hidden
            ? '<i class="fa-solid fa-code"></i> Advanced File Editor'
            : '<i class="fa-solid fa-eye-slash"></i> Hide Advanced File Editor';
    }

    async function openContentFolder() {
        if (!window.showDirectoryPicker) {
            showNotice("Your browser does not support direct folder editing. Use Chrome or Edge, or load the bundled snapshot and download edited files.");
            return;
        }

        try {
            const rootHandle = await window.showDirectoryPicker({ mode: "readwrite" });
            state.files = {};
            state.handles = {};
            state.contentHandle = await getContentHandle(rootHandle);

            await readDirectory(rootHandle, "");
            normalizeContentRoot();
            state.writable = true;
            setStatus("Local content folder connected", "Edits save to your local working copy only. Commit and push later when ready.");
            renderFileNav();
            renderGuideStart();
        } catch (error) {
            if (error.name !== "AbortError") {
                console.error(error);
                showNotice("Could not open the selected folder.");
            }
        }
    }

    async function readDirectory(directoryHandle, prefix) {
        for await (const [name, handle] of directoryHandle.entries()) {
            if (name.startsWith(".")) continue;

            const path = prefix ? `${prefix}/${name}` : name;

            if (handle.kind === "directory") {
                await readDirectory(handle, path);
            } else if (isEditablePath(path)) {
                const file = await handle.getFile();
                state.files[path] = await file.text();
                state.handles[path] = handle;
            }
        }
    }

    function normalizeContentRoot() {
        const hasContentPrefix = Object.keys(state.files).some(path => path.startsWith("content/"));
        if (!hasContentPrefix) {
            state.files = Object.fromEntries(
                Object.entries(state.files).map(([path, value]) => [`content/${path}`, value])
            );
            state.handles = Object.fromEntries(
                Object.entries(state.handles).map(([path, handle]) => [`content/${path}`, handle])
            );
        }
    }

    function loadBundledContent() {
        if (!window.SagnikContentFiles) {
            showNotice("No bundled content snapshot was found. Regenerate assets/js/content-data.js first.");
            return;
        }

        state.files = Object.fromEntries(
            Object.entries(window.SagnikContentFiles)
                .filter(([path]) => isEditablePath(path))
        );
        state.handles = {};
        state.writable = false;
        state.contentHandle = null;

        setStatus("Bundled snapshot loaded", "Direct local saving is disabled. Use Download after editing a file.");
        renderFileNav();
        if (elements["guide-start"]) renderGuideStart();
    }

    async function getContentHandle(rootHandle) {
        try {
            return await rootHandle.getDirectoryHandle("content");
        } catch {
            return rootHandle;
        }
    }

    function isEditablePath(path) {
        if (path.endsWith("/README.md") || path === "content/README.md") return false;

        return path.startsWith("content/") && (
            path.endsWith(".md") ||
            path.endsWith(".csv") ||
            path.endsWith(".json")
        );
    }

    function renderFileNav() {
        if (!elements["file-nav"]) return;

        const query = elements["file-search"]?.value.trim().toLowerCase() || "";
        const paths = Object.keys(state.files)
            .filter(path => !query || path.toLowerCase().includes(query))
            .sort();

        const groups = paths.reduce((object, path) => {
            const group = path.split("/")[1] || "content";
            object[group] ||= [];
            object[group].push(path);
            return object;
        }, {});

        elements["file-nav"].innerHTML = Object.entries(groups).map(([group, groupPaths]) => `
            <div class="file-group">
                <div class="file-group-title">${escapeHtml(group)}</div>
                ${groupPaths.map(path => `
                    <button class="file-button ${path === state.activePath ? "active" : ""}" data-file-path="${escapeHtml(path)}">
                        <strong>${escapeHtml(path.split("/").pop())}</strong>
                        <span>${escapeHtml(path)}</span>
                    </button>
                `).join("")}
            </div>
        `).join("");
    }

    function createNewFile(type) {
        const example = type === "markdown"
            ? "content/projects/new-project.md"
            : "content/misc/new-section.csv";
        const path = prompt("New file path under content/", example);

        if (!path) return;

        const normalizedPath = path.startsWith("content/") ? path : `content/${path}`;
        if (!isEditablePath(normalizedPath)) {
            showNotice("Use a path ending in .md, .csv, or .json under content/.");
            return;
        }

        if (state.files[normalizedPath] && !confirm("That file already exists in this editor. Replace it?")) {
            return;
        }

        state.files[normalizedPath] = normalizedPath.endsWith(".md")
            ? defaultMarkdownRecord(normalizedPath)
            : normalizedPath.endsWith(".csv")
                ? "key,value\nexample,Update this row\n"
                : "{\n  \"example\": \"Update this file\"\n}\n";

        selectFile(normalizedPath);
        showNotice("New file created in the editor. Click Save to write it to your local folder, or Download in snapshot mode.");
    }

    function renderGuideStart() {
        if (!elements["guide-start"] || !elements["guide-workspace"]) return;
        elements["guide-start"].hidden = false;
        elements["guide-workspace"].hidden = true;
        guide.mode = "";
        guide.stack = [];
    }

    function startGuide(mode) {
        if (!Object.keys(state.files).length) {
            if (window.SagnikContentFiles) {
                loadBundledContent();
            } else {
                showNotice("Open your local content folder or load the bundled snapshot first.");
                return;
            }
        }

        guide.mode = mode;
        guide.stack = [];
        renderGuideCategories();
    }

    function pushGuide(view) {
        guide.stack.push(view);
        view();
    }

    function guideBack() {
        guide.stack.pop();
        const previous = guide.stack.pop();
        if (previous) {
            pushGuide(previous);
        } else {
            renderGuideCategories();
        }
    }

    function showGuide(title, help, html) {
        if (!elements["guide-start"] || !elements["guide-workspace"]) return;
        elements["guide-start"].hidden = true;
        elements["guide-workspace"].hidden = false;
        elements["guide-eyebrow"].textContent = guide.mode === "new" ? "Enter New Content" : "Modify / Delete Content";
        elements["guide-title"].textContent = title;
        elements["guide-help"].textContent = help;
        elements["guide-content"].innerHTML = html;
    }

    function renderGuideCategories() {
        pushGuide(() => showGuide(
            "Choose the website area",
            "Pick the broad part of the site you want to change. The next screen will show page-specific or resume-specific fields.",
            `
                <div class="guide-card-grid">
                    ${guideCard("general", "fa-file-lines", "General webpage information", "Home, About, page copy, hero images, navigation, prompts, metrics, and general cards.")}
                    ${guideCard("resume", "fa-id-card", "Resume and research records", "Education, projects, experience, skill evidence, papers, posters, links, metrics, publications, and research-page visibility.")}
                    ${guideCard("contact", "fa-address-book", "Contact information", "Contact links, footer links, contact intent cards, email labels, and contact images.")}
                </div>
            `
        ));
    }

    function guideCard(action, icon, title, description, attrs = "") {
        return `
            <button class="guide-card" data-guide-action="${action}" ${attrs}>
                <i class="fa-solid ${icon}"></i>
                <strong>${escapeHtml(title)}</strong>
                <span>${escapeHtml(description)}</span>
            </button>
        `;
    }

    function handleGuideAction(action, dataset) {
        const actions = {
            general: () => pushGuide(renderGeneralOptions),
            resume: () => pushGuide(renderResumeOptions),
            research: () => pushGuide(renderResearchOptions),
            contact: () => pushGuide(renderContactOptions),
            project: () => guide.mode === "new" ? renderProjectForm() : pushGuide(() => renderRecordList("projects", "Project")),
            education: () => guide.mode === "new" ? renderGenericRecordForm("education") : pushGuide(() => renderRecordList("education", "Education")),
            experience: () => guide.mode === "new" ? renderGenericRecordForm("experience") : pushGuide(() => renderRecordList("experience", "Experience")),
            skill: () => guide.mode === "new" ? renderGenericRecordForm("skills") : pushGuide(() => renderRecordList("skills", "Skill")),
            openFile: () => renderFriendlyFile(dataset.path),
            editRecord: () => renderRecordForm(dataset.path),
            saveFriendlyFile: () => saveFriendlyFile(dataset.path),
            saveFriendlyMarkdownFile: () => saveFriendlyMarkdownFile(dataset.path),
            saveProject: () => saveProjectForm(dataset.path || ""),
            saveGenericRecord: () => saveGenericRecord(dataset.folder, dataset.path || ""),
            deletePath: () => deleteContentPath(dataset.path),
            addMetricRow: () => addDynamicPair("project-metrics", "Metric value", "Metric label"),
            addLinkRow: () => addDynamicPair("project-links", "Link label", "URL"),
            addCsvSimpleRow: () => addCsvSimpleFormRow(),
            removeDynamicRow: () => dataset.rowId && document.getElementById(dataset.rowId)?.remove()
        };

        actions[action]?.();
    }

    function renderGeneralOptions() {
        showGuide(
            "Choose a page or general section",
            "These are website fields that are not resume records. Pick a page/section and edit it as a friendly list.",
            `
                <div class="guide-card-grid">
                    ${fileCard("content/misc/home-hero.md", "fa-house", "Home hero", "Name, subtitle, search placeholder, and rotating domain list.")}
                    ${fileCard("content/misc/home-research-areas.csv", "fa-layer-group", "Home research areas", "Cards under Research Areas.")}
                    ${fileCard("content/misc/home-demos.csv", "fa-window-maximize", "Home live demos", "Homepage demo cards and links.")}
                    ${fileCard("content/misc/publications-copy.csv", "fa-file-lines", "Publications page copy", "Hero and section wording for Publications, Live Demos, and Talks.")}
                    ${fileCard("content/misc/publication-talks.csv", "fa-person-chalkboard", "Talks", "Conference talk entries with locations, dates, project references, and links.")}
                    ${fileCard("content/misc/home-skill-showcase.csv", "fa-sparkles", "Home skill showcase", "Small skill cards on the homepage.")}
                    ${fileCard("content/misc/about-copy.csv", "fa-user", "About written sections and image", "Hero image path, About copy, philosophy, current work, and narrative text.")}
                    ${fileCard("content/misc/about-highlights.csv", "fa-star", "About highlight cards", "Stacked cards near the top of About.")}
                    ${fileCard("content/navigation/pages.csv", "fa-bars", "Navigation pages", "Navbar labels, order, URLs, and active-page matching.")}
                    ${fileCard("content/prompts/assistant-prompts.csv", "fa-message", "Assistant prompt buttons", "Visible SagnikGPT prompt buttons.")}
                    ${fileCard("content/prompts/prompt-templates.csv", "fa-file-code", "Prompt templates", "Reusable prompt keys used by other sections.")}
                    ${fileCard("content/metrics/home-kpis.csv", "fa-chart-simple", "Homepage metrics", "Rotating KPI cards and labels.")}
                </div>
            `
        );
    }

    function renderResumeOptions() {
        showGuide(
            "Choose a resume or research record type",
            guide.mode === "new"
                ? "Pick the record you want to add. Skill evidence is captured inside projects, experience, education, and the resume skill matrix instead of being entered twice."
                : "Pick the record you want to edit or delete. Project checkboxes control whether it appears on the Research page, Publications, homepage metrics, and showcases.",
            `
                <div class="guide-card-grid">
                    ${guideCard("project", "fa-diagram-project", "Project", "Title, date, descriptions, paper/poster/dashboard links, metrics, Research page visibility, publication, showcase, and homepage highlights.")}
                    ${guideCard("education", "fa-graduation-cap", "Education", "School, degree, focus, displayed metrics, and subject/course list.")}
                    ${guideCard("experience", "fa-briefcase", "Experience", "Research, teaching, or industry role with result, links, poster/paper, tags, and metrics.")}
                    ${fileCard("content/misc/resume-copy.csv", "fa-file-lines", "Resume page copy", "Hero, overview, and recruiter summary text.")}
                    ${fileCard("content/misc/resume-skill-matrix.csv", "fa-table", "Resume skill matrix", "Main skill areas, project evidence, methods/tools, and prompts.")}
                    ${fileCard("content/misc/about-skill-cards.csv", "fa-toolbox", "About skill cards", "Short skill cards shown on the About page. Use this only for page-level display labels.")}
                    ${fileCard("content/misc/research-copy.csv", "fa-microscope", "Research page static copy", "Only page-level wording: hero, agenda, and selected work. Project content is controlled from Project records.")}
                    ${fileCard("content/misc/research-focus.csv", "fa-file-circle-check", "Research focus cards", "Project references and focus descriptions shown at the top of Research.")}
                    ${fileCard("content/misc/publications-copy.csv", "fa-file-lines", "Publications page copy", "Hero and section wording for Publications, Live Demos, and Talks.")}
                    ${fileCard("content/misc/publication-talks.csv", "fa-person-chalkboard", "Talks", "Conference talk entries with locations, dates, project references, and links.")}
                    ${fileCard("content/misc/research-agenda.csv", "fa-list-check", "Research agenda cards", "Methodological agenda cards and prompts.")}
                    ${fileCard("content/misc/assistant-architecture.csv", "fa-sitemap", "Assistant architecture", "Optional notes for the SagnikGPT live demo.")}
                </div>
            `
        );
    }

    function renderResearchOptions() {
        showGuide(
            "Research page settings",
            "Project-level research visibility is controlled from Resume and research records -> Project. This section is only for static research page wording and non-project cards.",
            `
                <div class="guide-card-grid">
                    ${guideCard("project", "fa-diagram-project", "Selected projects / publications", "Edit project records to show/hide selected research, live showcases, and publications.")}
                    ${fileCard("content/misc/research-copy.csv", "fa-file-lines", "Research page copy", "Hero, agenda, and selected work.")}
                    ${fileCard("content/misc/research-hero-kpis.csv", "fa-chart-pie", "Research hero KPIs", "The four small Research Identity fields.")}
                    ${fileCard("content/misc/research-focus.csv", "fa-file-circle-check", "Research focus cards", "Project references and focus descriptions shown at the top of Research.")}
                    ${fileCard("content/misc/research-agenda.csv", "fa-list-check", "Research agenda cards", "Methodological agenda cards and prompts.")}
                    ${fileCard("content/misc/research-bottom-cards.csv", "fa-columns", "Research bottom cards", "Lab/collaboration and research philosophy cards.")}
                </div>
            `
        );
    }

    function renderContactOptions() {
        showGuide(
            "Choose a contact section",
            "Change contact links, footer links, intent cards, and contact display values.",
            `
                <div class="guide-card-grid">
                    ${fileCard("content/contact/contact-links.csv", "fa-link", "Contact and footer links", "Email, GitHub, LinkedIn, Scholar, ORCID, footer icons, and optional contact image.")}
                    ${fileCard("content/contact/contact-intents.csv", "fa-address-card", "Contact intent cards", "The Best For cards beside the contact hero.")}
                </div>
            `
        );
    }

    function fileCard(path, icon, title, description) {
        return guideCard("openFile", icon, title, description, `data-path="${escapeAttribute(path)}"`);
    }

    function renderRecordList(folder, label) {
        const paths = Object.keys(state.files)
            .filter(path => path.startsWith(`content/${folder}/`) && path.endsWith(".md"))
            .sort();

        showGuide(
            `Choose ${label.toLowerCase()} to modify`,
            `Edit fields, untick display options, or delete an entire ${label.toLowerCase()} record.`,
            `
                <div class="guide-card-grid">
                    ${paths.map(path => {
                        const record = parseMarkdown(state.files[path]);
                        const title = record.frontmatter.title || record.frontmatter.org || record.frontmatter.institution || path.split("/").pop();
                        const description = record.frontmatter.meta || record.frontmatter.degree || record.frontmatter.title || path;
                        return guideCard("editRecord", folder === "projects" ? "fa-diagram-project" : "fa-file-lines", title, description, `data-path="${escapeAttribute(path)}"`);
                    }).join("")}
                </div>
            `
        );
    }

    function renderRecordForm(path) {
        if (path.startsWith("content/projects/")) {
            const record = parseMarkdown(state.files[path]);
            renderProjectForm(path, record);
            return;
        }

        const folder = path.split("/")[1];
        renderGenericRecordForm(folder, path, parseMarkdown(state.files[path]));
    }

    function renderProjectForm(path = "", record = null) {
        const data = record || { frontmatter: {}, sections: [] };
        const meta = data.frontmatter || {};
        const sections = sectionsToObject(data.sections || []);
        const metrics = parsePairList(meta.metrics);
        const links = parsePairList(meta.links);
        const isNew = !path;

        showGuide(
            isNew ? "Enter a new project" : `Modify project: ${meta.title || path}`,
            "Fill the project once, then use checkboxes to decide where it appears. Character-limited labels help protect the layout.",
            `
                <form class="guided-form" id="project-form">
                    <section class="studio-card">
                        <div class="studio-section-heading">
                            <h3>Core project fields</h3>
                            <p>These fields feed Resume, Research, Publications, and homepage highlights.</p>
                        </div>
                        <div class="form-grid-3">
                            ${inputField("id", "Project ID", meta.id || "", "narrative_pulse", 40)}
                            ${inputField("date", "Date / year", meta.date || "", "2026", 30)}
                            ${inputField("title", "Project title", meta.title || "", "Project title", 90)}
                        </div>
                        <div class="form-grid-2">
                            ${inputField("meta", "Short category line", meta.meta || "", "NLP | Survey Methods", 90)}
                            ${inputField("selectedLabel", "Research card label", meta.selectedLabel || "", "Legal Analytics", 45)}
                        </div>
                        ${textareaField("summary", "Short summary", sections.summary || "", 220)}
                    </section>

                    <section class="studio-card">
                        <div class="studio-section-heading">
                            <h3>Links and assets</h3>
                            <p>Use repo paths for local files and full URLs for dashboards or external links.</p>
                        </div>
                        <div class="form-grid-3">
                            ${inputField("paper", "Paper / report path", meta.paper || "", "assets/papers/example.pdf", 140)}
                            ${inputField("poster", "Poster image path", meta.poster || "", "assets/poster/example.png", 140)}
                            ${inputField("website", "Live website / dashboard", meta.website || "", "https://...", 160)}
                        </div>
                        <div class="dynamic-list" id="project-links">
                            <div class="studio-section-heading"><h3>Extra hyperlinks</h3><p>Each link has a preferred display label and URL.</p></div>
                            ${pairsHtml(links, "project-links", "Link label", "URL")}
                        </div>
                        <button class="paper-btn secondary-paper-btn" type="button" data-guide-action="addLinkRow">Add hyperlink</button>
                    </section>

                    <section class="studio-card">
                        <div class="studio-section-heading">
                            <h3>Where should this project appear?</h3>
                            <p>Untick an option to remove it from that surface without deleting the project.</p>
                        </div>
                        <div class="checkbox-grid">
                            ${checkField("selected", "Show in Research selected projects", meta.selected === true || meta.selected === "true", "selected-panel")}
                            ${checkField("publication", "Show as publication/output", meta.publication === true || meta.publication === "true", "publication-panel")}
                            ${checkField("demo", "Show on Publications live demo page", meta.demo === true || meta.demo === "true", "demo-panel")}
                            ${checkField("featureOrder", "Showcase / live demo feature", Boolean(meta.featureOrder), "feature-panel")}
                            ${checkField("homeProof", "Highlight on homepage proof row", Boolean(findHighlightByRef(meta.id, "homeProof")), "home-proof-panel")}
                            ${checkField("homeMetric", "Add homepage metric cards", false, "home-metric-panel")}
                        </div>

                        <div class="conditional-panel ${meta.selected === true || meta.selected === "true" ? "show" : ""}" id="selected-panel">
                            <div class="form-grid-3">
                                ${inputField("selectedOrder", "Research card order", meta.selectedOrder || "", "1", 10)}
                                ${inputField("selectedIcon", "Research icon", meta.selectedIcon || "fa-diagram-project", "fa-diagram-project", 40)}
                                ${inputField("selectedLabelPreview", "Research label preview", meta.selectedLabel || "", "Set above", 45, "disabled")}
                            </div>
                        </div>

                        <div class="conditional-panel ${meta.publication === true || meta.publication === "true" ? "show" : ""}" id="publication-panel">
                            <div class="form-grid-2">
                                ${inputField("publicationVenue", "Published / presented where", meta.publicationVenue || "", "AAPOR 2026, IISA 2025, Journal name...", 90)}
                                ${inputField("publicationDate", "Publication / presentation date", meta.publicationDate || meta.date || "", "May 2026", 40)}
                                ${inputField("publicationOrder", "Publication page order", meta.publicationOrder || "", "1", 10)}
                            </div>
                        </div>

                        <div class="conditional-panel ${meta.demo === true || meta.demo === "true" ? "show" : ""}" id="demo-panel">
                            <div class="form-grid-3">
                                ${inputField("demoOrder", "Demo page order", meta.demoOrder || "", "1", 10)}
                                ${inputField("demoLabel", "Demo label", meta.demoLabel || "Live Demo", "Live Demo", 35)}
                                ${inputField("demoTitle", "Demo display title", meta.demoTitle || meta.title || "", "FrameScope Demo", 70)}
                            </div>
                            ${textareaField("demoSteps", "How-it-works boxes", meta.demoSteps || "", 500, "placeholder=\"Collect|Data sources; Model|Analysis steps; Explore|Dashboard behavior\"")}
                        </div>

                        <div class="conditional-panel ${meta.featureOrder ? "show" : ""}" id="feature-panel">
                            <div class="form-grid-2">
                                ${inputField("featureOrder", "Showcase order", meta.featureOrder || "", "1", 10)}
                                ${inputField("featureEyebrow", "Showcase eyebrow", meta.featureEyebrow || "Live Research Systems", "Live Research Systems", 45)}
                                ${inputField("featureHeading", "Showcase heading", meta.featureHeading || "", "Project name", 70)}
                                ${inputField("featureLabel", "Showcase label", meta.featureLabel || "", "NLP | Dashboard", 70)}
                            </div>
                            ${textareaField("featureLead", "Showcase lead text", meta.featureLead || "", 180)}
                            ${textareaField("featureResult", "Showcase output/result", meta.featureResult || "", 220)}
                            ${inputField("showcaseBackground", "Optional showcase background image", meta.showcaseBackground || "", "images/example.webp", 140)}
                        </div>

                        <div class="conditional-panel ${findHighlightByRef(meta.id, "homeProof") ? "show" : ""}" id="home-proof-panel">
                            <div class="form-grid-3">
                                ${inputField("homeProofLabel", "Homepage highlight label", findHighlightByRef(meta.id, "homeProof")?.label || "Project", "Conference", 35)}
                                ${inputField("homeProofTitle", "Homepage highlight title", findHighlightByRef(meta.id, "homeProof")?.titleOverride || "", "AAPOR 2026", 45)}
                                ${inputField("homeProofActionLabel", "Button label", findHighlightByRef(meta.id, "homeProof")?.actionLabel || "Open project", "Open paper", 35)}
                            </div>
                            ${textareaField("homeProofDescription", "Homepage highlight description", findHighlightByRef(meta.id, "homeProof")?.descriptionOverride || "", 150)}
                        </div>

                        <div class="conditional-panel" id="home-metric-panel">
                            <div class="form-grid-3">
                                ${inputField("homeMetricGroup", "Metric group", "", "project_new", 35)}
                                ${inputField("homeMetricValue", "Metric value", "", "2M+", 12)}
                                ${inputField("homeMetricLabel", "Metric label", "", "records analyzed", 45)}
                            </div>
                        </div>
                    </section>

                    <section class="studio-card">
                        <div class="studio-section-heading">
                            <h3>Displayed metrics</h3>
                            <p>Keep labels short. These appear in project cards and detail panels.</p>
                        </div>
                        <div class="dynamic-list" id="project-metrics">
                            ${pairsHtml(metrics, "project-metrics", "Metric value", "Metric label")}
                        </div>
                        <button class="paper-btn secondary-paper-btn plus-action-button" type="button" data-guide-action="addMetricRow">
                            <i class="fa-solid fa-plus"></i>
                            Add another metric
                        </button>
                    </section>

                    <section class="studio-card">
                        <div class="studio-section-heading">
                            <h3>Descriptive writing</h3>
                            <p>These are saved as Markdown sections and feed the detailed project view.</p>
                        </div>
                        ${textareaField("objective", "Objective", sections.objective || "", 500)}
                        ${textareaField("abstract", "Abstract", sections.abstract || "", 800)}
                        ${textareaField("motivation", "Motivation", sections.motivation || "", 800)}
                        ${textareaField("methods", "Methods", sections.methods || "", 800)}
                        ${textareaField("results", "Results", sections.results || "", 800)}
                        ${textareaField("insight", "Research / business insight", sections.insight || "", 800)}
                        ${textareaField("question", "SagnikGPT question", meta.question || "", 500)}
                    </section>

                    <div class="form-actions">
                        ${path ? `<button class="paper-btn secondary-paper-btn danger-button" type="button" data-guide-action="deletePath" data-path="${escapeAttribute(path)}">Delete entire project</button>` : ""}
                        <button class="paper-btn" type="button" data-guide-action="saveProject" data-path="${escapeAttribute(path)}">Save project locally</button>
                    </div>
                </form>
            `
        );
    }

    function renderGenericRecordForm(folder, path = "", record = null) {
        const data = record || { frontmatter: {}, sections: [] };
        const meta = data.frontmatter || {};
        const sections = sectionsToObject(data.sections || []);
        const title = path ? `Modify ${folder}: ${meta.title || meta.org || meta.institution || path}` : `Enter new ${folder} record`;

        showGuide(
            title,
            "These fields are generated from the current displayed content model. Add/remove metrics, courses, tags, and longer Markdown text as needed.",
            `
                <form class="guided-form" id="generic-record-form">
                    <section class="studio-card">
                        <div class="form-grid-3">
                            ${inputField("id", "ID", meta.id || "", `${folder}_id`, 50)}
                            ${inputField("date", "Date", meta.date || "", "2026", 40)}
                            ${inputField("title", folder === "education" ? "Degree" : "Title", meta.title || meta.degree || "", "Title", 120)}
                        </div>
                        <div class="form-grid-2">
                            ${inputField("institution", "Institution / organization", meta.institution || meta.org || "", "University / Organization", 120)}
                            ${inputField("section", "Section", meta.section || "", "research, teaching, industry", 50)}
                            ${inputField("icon", "Icon", meta.icon || "fa-briefcase", "fa-briefcase", 40)}
                            ${inputField("focus", "Focus / result", meta.focus || meta.result || "", "Short result", 180)}
                        </div>
                        ${textareaField("description", "Description / details", sections.details || sections.description || "", 1000)}
                        ${textareaField("question", "SagnikGPT question", meta.question || "", 500)}
                    </section>

                    <section class="studio-card">
                        <div class="form-grid-3">
                            ${inputField("paper", "Paper/report path", meta.paper || "", "assets/papers/example.pdf", 140)}
                            ${inputField("poster", "Poster path", meta.poster || "", "assets/poster/example.png", 140)}
                            ${inputField("website", "Website/dashboard", meta.website || "", "https://...", 160)}
                        </div>
                        ${textareaField("metrics", "Metrics: value|label; value|label", meta.metrics || "", 400)}
                        ${textareaField("tags", "Tags: comma-separated", meta.tags || meta.evidence || "", 300)}
                        ${textareaField("courses", "Courses/subjects: semicolon-separated", meta.courses || "", 600)}
                    </section>

                    <div class="form-actions">
                        ${path ? `<button class="paper-btn secondary-paper-btn danger-button" type="button" data-guide-action="deletePath" data-path="${escapeAttribute(path)}">Delete entire record</button>` : ""}
                        <button class="paper-btn" type="button" data-guide-action="saveGenericRecord" data-folder="${escapeAttribute(folder)}" data-path="${escapeAttribute(path)}">Save record locally</button>
                    </div>
                </form>
            `
        );
    }

    function renderFriendlyFile(path) {
        if (!state.files[path]) {
            showNotice(`Could not find ${path}`);
            return;
        }

        if (path.endsWith(".md")) {
            renderFriendlyMarkdownFile(path);
            return;
        }

        const parsed = parseCsv(state.files[path]);
        showGuide(
            friendlyTitle(path),
            "Edit the displayed fields below. Remove a row to remove that visible field/card/link from the site.",
            `
                <form class="guided-form" id="friendly-csv-form" data-friendly-path="${escapeAttribute(path)}">
                    <section class="studio-card">
                        <div class="studio-section-heading">
                            <h3>${escapeHtml(friendlyTitle(path))}</h3>
                            <p>${escapeHtml(friendlyHelp(path))}</p>
                        </div>
                        <div class="dynamic-list" id="friendly-csv-rows">
                            ${parsed.rows.map((row, index) => friendlyCsvRow(parsed.headers, row, index)).join("")}
                        </div>
                        <button class="paper-btn secondary-paper-btn" type="button" data-guide-action="addCsvSimpleRow">Add row</button>
                    </section>
                    <div class="form-actions">
                        <button class="paper-btn" type="button" data-guide-action="saveFriendlyFile" data-path="${escapeAttribute(path)}">Save section locally</button>
                    </div>
                </form>
            `
        );
    }

    function renderFriendlyMarkdownFile(path) {
        const parsed = parseMarkdown(state.files[path]);

        showGuide(
            friendlyTitle(path),
            "Edit structured fields and Markdown sections for this page-level content file.",
            `
                <form class="guided-form" id="friendly-md-form" data-friendly-path="${escapeAttribute(path)}">
                    <section class="studio-card">
                        <div class="studio-section-heading">
                            <h3>Fields</h3>
                            <p>These values are saved as frontmatter and drive page-level labels, image paths, placeholders, and short text.</p>
                        </div>
                        <div class="form-grid-2">
                            ${Object.entries(parsed.frontmatter).map(([key, value]) => {
                                const long = String(value).length > 90;
                                return long
                                    ? textareaField(key, labelForField(key), value, 900, `data-md-key="${escapeAttribute(key)}"`)
                                    : inputField(key, labelForField(key), value, "", key.toLowerCase().includes("label") ? 45 : 180, `data-md-key="${escapeAttribute(key)}"`);
                            }).join("")}
                        </div>
                    </section>

                    <section class="studio-card">
                        <div class="studio-section-heading">
                            <h3>Markdown sections</h3>
                            <p>Descriptive sections are saved with Markdown headers.</p>
                        </div>
                        <div class="section-stack">
                            ${parsed.sections.map(section => `
                                <article class="markdown-section-row">
                                    <label>
                                        <span>Header</span>
                                        <input data-md-section-title value="${escapeAttribute(section.title)}">
                                    </label>
                                    <textarea data-md-section-body rows="8">${escapeHtml(section.body)}</textarea>
                                </article>
                            `).join("")}
                        </div>
                    </section>

                    <div class="form-actions">
                        <button class="paper-btn" type="button" data-guide-action="saveFriendlyMarkdownFile" data-path="${escapeAttribute(path)}">Save section locally</button>
                    </div>
                </form>
            `
        );
    }

    async function saveFriendlyMarkdownFile(path) {
        const form = document.getElementById("friendly-md-form");
        if (!form) return;

        const meta = {};
        form.querySelectorAll("[data-md-key]").forEach(input => {
            meta[input.dataset.mdKey] = input.value;
        });

        const sections = {};
        form.querySelectorAll(".markdown-section-row").forEach(row => {
            const title = row.querySelector("[data-md-section-title]")?.value.trim();
            const body = row.querySelector("[data-md-section-body]")?.value.trim();
            if (title || body) sections[title || "Section"] = body || "";
        });

        state.files[path] = serializeMarkdownRecord(meta, sections);
        await savePath(path);
        showNotice(`Saved ${path}`);
    }

    function friendlyCsvRow(headers, row, index) {
        const rowId = `friendly-row-${index}-${Math.random().toString(16).slice(2)}`;
        const isKeyValue = headers.includes("key") && headers.includes("value");
        const fields = isKeyValue
            ? ["key", "value"]
            : headers;

        return `
            <article class="studio-card friendly-row" id="${rowId}">
                <div class="section-title-row">
                    <strong>${escapeHtml(row.title || row.label || row.key || `Row ${index + 1}`)}</strong>
                    <button class="icon-button" type="button" data-guide-action="removeDynamicRow" data-row-id="${escapeAttribute(rowId)}" aria-label="Remove row">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
                <div class="${fields.length > 2 ? "form-grid-3" : "form-grid-2"}">
                    ${fields.map(header => {
                        const value = row[header] || "";
                        const long = String(value).length > 90 || ["value", "description", "body", "prompt", "links"].includes(header);
                        return long
                            ? textareaField(header, labelForField(header), value, 900, `data-csv-name="${escapeAttribute(header)}"`)
                            : inputField(header, labelForField(header), value, "", header.includes("label") ? 45 : 180, `data-csv-name="${escapeAttribute(header)}"`);
                    }).join("")}
                </div>
                ${headers.filter(header => !fields.includes(header)).map(header => `
                    <input type="hidden" data-csv-name="${escapeAttribute(header)}" value="${escapeAttribute(row[header] || "")}">
                `).join("")}
            </article>
        `;
    }

    function addCsvSimpleFormRow() {
        const form = document.getElementById("friendly-csv-form");
        if (!form) return;

        const path = form.dataset.friendlyPath;
        const parsed = parseCsv(state.files[path] || "");
        const emptyRow = Object.fromEntries(parsed.headers.map(header => [header, ""]));
        document.getElementById("friendly-csv-rows").insertAdjacentHTML("beforeend", friendlyCsvRow(parsed.headers, emptyRow, Date.now()));
    }

    async function saveFriendlyFile(path) {
        const form = document.getElementById("friendly-csv-form");
        if (!form) return;

        const parsed = parseCsv(state.files[path] || "");
        const rows = Array.from(form.querySelectorAll(".friendly-row")).map(row => {
            const values = {};
            row.querySelectorAll("[data-csv-name]").forEach(input => {
                values[input.dataset.csvName] = input.value;
            });
            return values;
        });

        state.files[path] = serializeCsv(parsed.headers, rows);
        await savePath(path);
        showNotice(`Saved ${path}`);
    }

    async function saveProjectForm(path) {
        const form = document.getElementById("project-form");
        if (!form) return;

        const values = formValues(form);
        const id = slug(values.id || values.title || "project");
        const targetPath = path || `content/projects/${id.replace(/_/g, "-")}.md`;

        const meta = {
            type: "project",
            id,
            date: values.date,
            title: values.title,
            meta: values.meta,
            paper: values.paper,
            website: values.website,
            poster: values.poster,
            selected: Boolean(values.selected),
            selectedOrder: values.selectedOrder,
            selectedLabel: values.selectedLabel,
            selectedIcon: values.selectedIcon,
            publication: Boolean(values.publication),
            publicationVenue: values.publicationVenue,
            publicationDate: values.publicationDate,
            publicationOrder: values.publicationOrder,
            demo: Boolean(values.demo),
            demoOrder: values.demoOrder,
            demoLabel: values.demoLabel,
            demoTitle: values.demoTitle,
            demoSteps: values.demoSteps,
            featureOrder: values.featureOrder,
            featureEyebrow: values.featureEyebrow,
            featureHeading: values.featureHeading,
            featureLead: values.featureLead,
            featureLabel: values.featureLabel,
            featureResult: values.featureResult,
            showcaseBackground: values.showcaseBackground,
            metrics: collectPairs("project-metrics"),
            links: collectPairs("project-links"),
            question: values.question
        };

        state.files[targetPath] = serializeMarkdownRecord(meta, {
            Summary: values.summary,
            Objective: values.objective,
            Abstract: values.abstract,
            Motivation: values.motivation,
            Methods: values.methods,
            Results: values.results,
            Insight: values.insight
        });

        addToManifestArray("projects", targetPath);
        updateProjectHighlightRows(meta, values);
        updateHomeMetricRows(meta, values);

        await savePath(targetPath);
        await savePath("content/manifest.json");
        await savePath("content/misc/highlights.csv");
        await savePath("content/metrics/home-kpis.csv");
        showNotice(`Saved project ${targetPath}`);
        renderFileNav();
    }

    async function saveGenericRecord(folder, path) {
        const form = document.getElementById("generic-record-form");
        if (!form) return;

        const values = formValues(form);
        const id = slug(values.id || values.title || values.institution || values.organization || folder);
        const targetPath = path || `content/${folder}/${id.replace(/_/g, "-")}.md`;

        const meta = {
            type: folder,
            id,
            date: values.date,
            title: values.title,
            institution: values.institution,
            org: values.institution,
            degree: values.title,
            section: values.section,
            icon: values.icon,
            focus: values.focus,
            result: values.focus,
            metrics: values.metrics,
            tags: values.tags,
            evidence: values.tags,
            courses: values.courses,
            paper: values.paper,
            poster: values.poster,
            website: values.website,
            question: values.question
        };

        state.files[targetPath] = serializeMarkdownRecord(meta, {
            Details: values.description
        });

        addToManifestArray(folder === "skills" ? "skills" : folder, targetPath);
        await savePath(targetPath);
        await savePath("content/manifest.json");
        showNotice(`Saved ${targetPath}`);
        renderFileNav();
    }

    async function deleteContentPath(path) {
        if (!path) return;
        if (!confirm(`Delete ${path} locally and remove it from the manifest where possible?`)) return;

        removeFromManifest(path);
        delete state.files[path];
        delete state.handles[path];
        await savePath("content/manifest.json");
        renderGuideCategories();
        renderFileNav();
        showNotice(`Removed ${path}`);
    }

    function defaultMarkdownRecord(path) {
        const id = path.split("/").pop().replace(/\.md$/, "").replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "").toLowerCase();
        const type = path.split("/")[1] || "record";

        return `---\ntype: ${type}\nid: ${id}\ntitle: New ${titleCase(type)} Record\ndate: 2026\n---\n\n## Summary\n\nWrite the main description here.\n`;
    }

    function selectFile(path) {
        state.activePath = path;
        state.activeType = fileType(path);
        elements["empty-state"].hidden = true;
        elements.editor.hidden = false;
        elements["editor-title"].textContent = path.split("/").pop();
        elements["editor-path"].textContent = path;
        elements["editor-type"].textContent = state.activeType === "markdown" ? "Markdown Record" : state.activeType === "csv" ? "CSV Table" : "JSON / Raw";
        configureToolbar();

        if (state.activeType === "markdown") renderMarkdownEditor(state.files[path]);
        if (state.activeType === "csv") renderCsvEditor(state.files[path]);
        if (state.activeType === "raw") renderRawEditor(state.files[path]);

        renderFileNav();
    }

    function configureToolbar() {
        const markdown = state.activeType === "markdown";
        const csv = state.activeType === "csv";

        elements["add-record-field"].hidden = !markdown;
        elements["add-section"].hidden = !markdown;
        elements["add-row"].hidden = !csv;
        elements["add-column"].hidden = !csv;
    }

    function fileType(path) {
        if (path.endsWith(".md")) return "markdown";
        if (path.endsWith(".csv")) return "csv";
        return "raw";
    }

    function renderMarkdownEditor(text) {
        const parsed = parseMarkdown(text);
        elements["markdown-editor"].hidden = false;
        elements["csv-editor"].hidden = true;
        elements["frontmatter-fields"].innerHTML = "";
        elements["markdown-sections"].innerHTML = "";

        Object.entries(parsed.frontmatter).forEach(([key, value]) => addFieldRow(key, value));
        parsed.sections.forEach(section => addMarkdownSection(section.title, section.body));

        updateRawPreview();
    }

    function renderCsvEditor(text) {
        elements["markdown-editor"].hidden = true;
        elements["csv-editor"].hidden = false;

        const parsed = parseCsv(text);
        drawCsvTable(parsed.headers, parsed.rows);
        updateRawPreview();
    }

    function renderRawEditor(text) {
        elements["markdown-editor"].hidden = true;
        elements["csv-editor"].hidden = true;
        elements["raw-preview"].value = text;
    }

    function addFieldRow(key, value) {
        const template = document.getElementById("field-template");
        const node = template.content.firstElementChild.cloneNode(true);
        node.querySelector(".field-key").value = key;
        node.querySelector(".field-value").value = value;
        elements["frontmatter-fields"].appendChild(node);
        updateRawPreview();
    }

    function addMarkdownSection(title, body) {
        const template = document.getElementById("section-template");
        const node = template.content.firstElementChild.cloneNode(true);
        node.querySelector(".section-title").value = title;
        node.querySelector(".section-body").value = body;
        elements["markdown-sections"].appendChild(node);
        updateRawPreview();
    }

    function addCsvRow() {
        const headers = getCsvHeaders();
        const rows = getCsvRows();
        rows.push(Object.fromEntries(headers.map(header => [header, ""])));
        drawCsvTable(headers, rows);
        updateRawPreview();
    }

    function addCsvColumn() {
        const name = prompt("Column name?");
        if (!name) return;

        const headers = [...getCsvHeaders(), name.trim()];
        const rows = getCsvRows().map(row => ({ ...row, [name.trim()]: "" }));
        drawCsvTable(headers, rows);
        updateRawPreview();
    }

    function removeCsvColumn(index) {
        const headers = getCsvHeaders();
        headers.splice(index, 1);
        const rows = getCsvRows().map(row => {
            const next = {};
            headers.forEach(header => next[header] = row[header] || "");
            return next;
        });
        drawCsvTable(headers, rows);
        updateRawPreview();
    }

    function drawCsvTable(headers, rows) {
        elements["csv-table"].innerHTML = `
            <thead>
                <tr>
                    ${headers.map((header, index) => `
                        <th>
                            <input data-csv-header="${index}" value="${escapeAttribute(header)}">
                            <button class="icon-button" type="button" data-remove-csv-column="${index}" aria-label="Remove column">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </th>
                    `).join("")}
                    <th class="row-actions">Row</th>
                </tr>
            </thead>
            <tbody>
                ${rows.map((row, rowIndex) => `
                    <tr>
                        ${headers.map(header => `
                            <td><input data-csv-cell="${escapeAttribute(header)}" value="${escapeAttribute(row[header] || "")}"></td>
                        `).join("")}
                        <td class="row-actions">
                            <button class="icon-button" type="button" data-remove-csv-row="${rowIndex}" aria-label="Remove row">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `).join("")}
            </tbody>
        `;
    }

    function getCsvHeaders() {
        return Array.from(elements["csv-table"].querySelectorAll("[data-csv-header]"))
            .map(input => input.value.trim())
            .filter(Boolean);
    }

    function getCsvRows() {
        const headers = getCsvHeaders();
        return Array.from(elements["csv-table"].querySelectorAll("tbody tr")).map(row => {
            const cells = Array.from(row.querySelectorAll("[data-csv-cell]"));
            return headers.reduce((object, header, index) => {
                object[header] = cells[index]?.value || "";
                return object;
            }, {});
        });
    }

    function updateRawPreview() {
        if (!state.activePath) return;

        if (state.activeType === "markdown") {
            elements["raw-preview"].value = serializeMarkdown();
        } else if (state.activeType === "csv") {
            elements["raw-preview"].value = serializeCsv(getCsvHeaders(), getCsvRows());
        }

        state.files[state.activePath] = elements["raw-preview"].value;
    }

    function syncFromRawPreview() {
        if (!state.activePath) return;
        state.files[state.activePath] = elements["raw-preview"].value;
    }

    function serializeMarkdown() {
        const fields = Array.from(elements["frontmatter-fields"].querySelectorAll(".field-row"))
            .map(row => ({
                key: row.querySelector(".field-key").value.trim(),
                value: row.querySelector(".field-value").value
            }))
            .filter(field => field.key);

        const sections = Array.from(elements["markdown-sections"].querySelectorAll(".markdown-section-row"))
            .map(row => ({
                title: row.querySelector(".section-title").value.trim(),
                body: row.querySelector(".section-body").value.trim()
            }))
            .filter(section => section.title || section.body);

        const frontmatter = fields.map(field => `${field.key}: ${formatFrontmatterValue(field.value)}`).join("\n");
        const markdownSections = sections.map(section => `## ${section.title || "Section"}\n\n${section.body}`).join("\n\n");

        return `---\n${frontmatter}\n---\n\n${markdownSections}\n`;
    }

    function formatFrontmatterValue(value) {
        const text = String(value || "");
        if (!text) return "";
        if (/^[\w./:#?&=%+\- ]+$/.test(text) && !text.includes(",") && !text.includes("|")) return text;
        return `"${text.replace(/"/g, '\\"')}"`;
    }

    function inputField(name, label, value = "", placeholder = "", maxlength = "", extra = "") {
        return `
            <label>
                <span>${escapeHtml(label)}${maxlength ? ` <em>max ${maxlength}</em>` : ""}</span>
                <input name="${escapeAttribute(name)}" value="${escapeAttribute(value)}" placeholder="${escapeAttribute(placeholder)}" ${maxlength ? `maxlength="${Number(maxlength)}"` : ""} ${extra}>
            </label>
        `;
    }

    function textareaField(name, label, value = "", maxlength = "", extra = "") {
        return `
            <label>
                <span>${escapeHtml(label)}${maxlength ? ` <em>max ${maxlength}</em>` : ""}</span>
                <textarea name="${escapeAttribute(name)}" rows="5" ${maxlength ? `maxlength="${Number(maxlength)}"` : ""} ${extra}>${escapeHtml(value)}</textarea>
            </label>
        `;
    }

    function checkField(name, label, checked = false, panel = "") {
        return `
            <label class="check-card">
                <input type="checkbox" name="${escapeAttribute(name)}" ${checked ? "checked" : ""} ${panel ? `data-controls-panel="${escapeAttribute(panel)}"` : ""}>
                <span>${escapeHtml(label)}</span>
            </label>
        `;
    }

    function pairsHtml(pairs, containerId, leftLabel, rightLabel) {
        const rows = pairs.length ? pairs : [["", ""]];
        return rows.map(pair => dynamicPairRow(containerId, leftLabel, rightLabel, pair[0], pair[1])).join("");
    }

    function addDynamicPair(containerId, leftLabel, rightLabel) {
        const target = document.getElementById(containerId);
        if (!target) return;
        target.insertAdjacentHTML("beforeend", dynamicPairRow(containerId, leftLabel, rightLabel));
    }

    function dynamicPairRow(containerId, leftLabel, rightLabel, left = "", right = "") {
        const rowId = `${containerId}-${Math.random().toString(16).slice(2)}`;
        return `
            <div class="dynamic-list-row" id="${rowId}">
                <label>
                    <span>${escapeHtml(leftLabel)}</span>
                    <input data-pair-left value="${escapeAttribute(left)}">
                </label>
                <label>
                    <span>${escapeHtml(rightLabel)}</span>
                    <input data-pair-right value="${escapeAttribute(right)}">
                </label>
                <button class="icon-button" type="button" data-guide-action="removeDynamicRow" data-row-id="${escapeAttribute(rowId)}" aria-label="Remove row">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
    }

    function collectPairs(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return "";

        return Array.from(container.querySelectorAll(".dynamic-list-row"))
            .map(row => {
                const left = row.querySelector("[data-pair-left]")?.value.trim();
                const right = row.querySelector("[data-pair-right]")?.value.trim();
                return left || right ? `${left}|${right}` : "";
            })
            .filter(Boolean)
            .join("; ");
    }

    function parsePairList(value) {
        if (!value) return [];
        return String(value).split(";").map(item => {
            const [left, ...right] = item.split("|");
            return [left?.trim() || "", right.join("|").trim()];
        }).filter(pair => pair[0] || pair[1]);
    }

    function sectionsToObject(sections) {
        return (sections || []).reduce((object, section) => {
            const key = String(section.title || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
            object[key] = section.body;
            return object;
        }, {});
    }

    function formValues(form) {
        const values = {};
        form.querySelectorAll("input[name], textarea[name], select[name]").forEach(input => {
            if (input.type === "checkbox") {
                values[input.name] = input.checked;
            } else {
                values[input.name] = input.value.trim();
            }
        });
        return values;
    }

    function serializeMarkdownRecord(meta, sections) {
        const frontmatter = Object.entries(meta)
            .filter(([, value]) => value !== undefined && value !== null && value !== "")
            .map(([key, value]) => `${key}: ${formatFrontmatterValue(value)}`)
            .join("\n");

        const body = Object.entries(sections || {})
            .filter(([, value]) => String(value || "").trim())
            .map(([title, value]) => `## ${title}\n\n${String(value).trim()}`)
            .join("\n\n");

        return `---\n${frontmatter}\n---\n${body ? `\n\n${body}\n` : ""}`;
    }

    function addToManifestArray(key, path) {
        const manifest = JSON.parse(state.files["content/manifest.json"] || "{}");
        manifest[key] ||= [];
        if (!manifest[key].includes(path)) manifest[key].push(path);
        state.files["content/manifest.json"] = `${JSON.stringify(manifest, null, 2)}\n`;
    }

    function removeFromManifest(path) {
        const manifest = JSON.parse(state.files["content/manifest.json"] || "{}");
        ["projects", "experience", "education", "skills"].forEach(key => {
            if (Array.isArray(manifest[key])) {
                manifest[key] = manifest[key].filter(item => item !== path);
            }
        });
        state.files["content/manifest.json"] = `${JSON.stringify(manifest, null, 2)}\n`;
    }

    function updateProjectHighlightRows(meta, values) {
        const path = "content/misc/highlights.csv";
        if (!state.files[path] || !meta.id) return;

        const parsed = parseCsv(state.files[path]);
        let rows = parsed.rows.filter(row => !(row.placement === "homeProof" && row.ref === meta.id));

        if (values.homeProof) {
            rows.push({
                placement: "homeProof",
                type: "project",
                ref: meta.id,
                label: values.homeProofLabel || "Project",
                icon: meta.selectedIcon || "fa-diagram-project",
                iconClass: "",
                titleOverride: values.homeProofTitle || meta.title,
                descriptionOverride: values.homeProofDescription || meta.summary || "",
                actionLabel: values.homeProofActionLabel || "Open project",
                actionType: meta.paper ? "open" : meta.poster ? "poster" : "link",
                target: meta.paper || meta.poster || meta.website || "pages/03-resume.html#projects"
            });
        }

        state.files[path] = serializeCsv(parsed.headers, rows);
    }

    function updateHomeMetricRows(meta, values) {
        const path = "content/metrics/home-kpis.csv";
        if (!state.files[path] || !values.homeMetric) return;

        const parsed = parseCsv(state.files[path]);
        parsed.rows.push({
            group: values.homeMetricGroup || meta.id || "project",
            source: meta.title || "Project",
            value: values.homeMetricValue || "",
            label: values.homeMetricLabel || "",
            actionLabel: "Open project",
            url: meta.paper || meta.website || "pages/03-resume.html#projects"
        });
        state.files[path] = serializeCsv(parsed.headers, parsed.rows);
    }

    function findHighlightByRef(ref, placement) {
        if (!ref || !state.files["content/misc/highlights.csv"]) return null;
        return parseCsv(state.files["content/misc/highlights.csv"]).rows
            .find(row => row.ref === ref && row.placement === placement) || null;
    }

    async function savePath(path) {
        if (!state.files[path]) return;

        let handle = state.handles[path];
        if (state.writable && !handle) {
            handle = await createFileHandle(path);
            if (handle) state.handles[path] = handle;
        }

        if (!state.writable || !handle) return;

        const writable = await handle.createWritable();
        await writable.write(TEXT_ENCODER.encode(state.files[path]));
        await writable.close();
    }

    function friendlyTitle(path) {
        return path.split("/").pop().replace(/\.(csv|md|json)$/i, "").replace(/[-_]+/g, " ").replace(/\b\w/g, char => char.toUpperCase());
    }

    function friendlyHelp(path) {
        if (path.includes("about-copy")) return "Includes About page written copy and the About hero image path.";
        if (path.includes("contact-links")) return "Controls contact cards, footer icons, hrefs, labels, and optional contact image.";
        if (path.includes("home-kpis")) return "Each row is a metric card. Keep label text short to avoid breaking the layout.";
        if (path.includes("pages.csv")) return "Controls navbar order, labels, URLs, and active-page matching.";
        return "Edit rows to change the visible text, links, icons, images, prompts, or labels for this section.";
    }

    function labelForField(field) {
        return String(field || "").replace(/[-_]+/g, " ").replace(/\b\w/g, char => char.toUpperCase());
    }

    function slug(value) {
        return String(value || "")
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_|_$/g, "");
    }

    async function saveActiveFile() {
        if (!state.activePath) return;
        updateRawPreview();

        const content = elements["raw-preview"].value;
        let handle = state.handles[state.activePath];

        if (state.writable && !handle) {
            handle = await createFileHandle(state.activePath);
            if (handle) state.handles[state.activePath] = handle;
        }

        if (!state.writable || !handle) {
            downloadActiveFile();
            showNotice("Direct local save is unavailable in snapshot mode. The edited file was downloaded instead.");
            return;
        }

        try {
            const writable = await handle.createWritable();
            await writable.write(TEXT_ENCODER.encode(content));
            await writable.close();
            showNotice(`Saved ${state.activePath}`);
        } catch (error) {
            console.error(error);
            showNotice("Could not save to the local folder. Use Download as a fallback.");
        }
    }

    async function createFileHandle(path) {
        if (!state.contentHandle) return null;

        const parts = path.replace(/^content\//, "").split("/");
        const fileName = parts.pop();
        let directory = state.contentHandle;

        for (const part of parts) {
            directory = await directory.getDirectoryHandle(part, { create: true });
        }

        return directory.getFileHandle(fileName, { create: true });
    }

    async function deleteActiveFile() {
        if (!state.activePath) return;

        if (!confirm(`Delete ${state.activePath} from this editor${state.writable ? " and your local folder" : ""}?`)) {
            return;
        }

        if (state.writable && state.contentHandle) {
            try {
                await removeFileHandle(state.activePath);
            } catch (error) {
                console.error(error);
                showNotice("Could not delete the local file. It was removed from this editor session only.");
            }
        }

        delete state.files[state.activePath];
        delete state.handles[state.activePath];
        state.activePath = "";
        elements.editor.hidden = true;
        elements["empty-state"].hidden = false;
        renderFileNav();
    }

    async function removeFileHandle(path) {
        const parts = path.replace(/^content\//, "").split("/");
        const fileName = parts.pop();
        let directory = state.contentHandle;

        for (const part of parts) {
            directory = await directory.getDirectoryHandle(part);
        }

        await directory.removeEntry(fileName);
    }

    function downloadActiveFile() {
        if (!state.activePath) return;
        updateRawPreview();

        const blob = new Blob([elements["raw-preview"].value], { type: "text/plain;charset=utf-8" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = state.activePath.split("/").pop();
        link.click();
        URL.revokeObjectURL(link.href);
    }

    function parseMarkdown(text) {
        const match = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
        const frontmatter = {};
        const body = match ? match[2] : text;

        if (match) {
            match[1].split(/\r?\n/).forEach(line => {
                const separator = line.indexOf(":");
                if (separator === -1) return;

                const key = line.slice(0, separator).trim();
                const value = line.slice(separator + 1).trim();
                frontmatter[key] = unquoteValue(value);
            });
        }

        return {
            frontmatter,
            sections: parseMarkdownSections(body)
        };
    }

    function parseMarkdownSections(body) {
        const sections = [];
        let current = { title: "Description", body: "" };

        String(body || "").split(/\r?\n/).forEach(line => {
            const heading = line.match(/^##\s+(.+?)\s*$/);
            if (heading) {
                if (current.title || current.body.trim()) sections.push(current);
                current = { title: heading[1].trim(), body: "" };
                return;
            }

            current.body += `${line}\n`;
        });

        if (current.title || current.body.trim()) sections.push(current);

        return sections.map(section => ({
            title: section.title,
            body: section.body.trim()
        }));
    }

    function parseCsv(text) {
        const lines = String(text || "").trim().split(/\r?\n/).filter(Boolean);
        if (!lines.length) return { headers: [], rows: [] };

        const headers = parseCsvLine(lines.shift());
        const rows = lines.map(line => {
            const values = parseCsvLine(line);
            return headers.reduce((row, header, index) => {
                row[header] = values[index] || "";
                return row;
            }, {});
        });

        return { headers, rows };
    }

    function parseCsvLine(line) {
        const values = [];
        let current = "";
        let quoted = false;

        for (let index = 0; index < line.length; index += 1) {
            const char = line[index];
            const next = line[index + 1];

            if (char === '"' && quoted && next === '"') {
                current += '"';
                index += 1;
                continue;
            }

            if (char === '"') {
                quoted = !quoted;
                continue;
            }

            if (char === "," && !quoted) {
                values.push(current.trim());
                current = "";
                continue;
            }

            current += char;
        }

        values.push(current.trim());
        return values;
    }

    function serializeCsv(headers, rows) {
        return [
            headers.map(csvEscape).join(","),
            ...rows.map(row => headers.map(header => csvEscape(row[header] || "")).join(","))
        ].join("\n") + "\n";
    }

    function csvEscape(value) {
        const text = String(value || "");
        if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
        return text;
    }

    function unquoteValue(value) {
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            return value.slice(1, -1);
        }

        return value;
    }

    function setStatus(title, body) {
        if (!elements["studio-status"]) return;
        elements["studio-status"].innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(body)}</span>`;
    }

    function showNotice(message) {
        if (elements["studio-status"]) {
            elements["studio-status"].innerHTML = `<strong>Notice</strong><span>${escapeHtml(message)}</span>`;
        }

        if (!elements["editor-notice"]) return;
        elements["editor-notice"].textContent = message;
        elements["editor-notice"].classList.add("show");
        setTimeout(() => elements["editor-notice"].classList.remove("show"), 5000);
    }

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function escapeAttribute(value) {
        return escapeHtml(value).replace(/`/g, "&#96;");
    }

    function titleCase(value) {
        return String(value || "")
            .replace(/[-_]+/g, " ")
            .replace(/\b\w/g, char => char.toUpperCase());
    }
})();
