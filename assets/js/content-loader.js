(function () {
    const MANIFEST_PATH = "content/manifest.json";

    function showLocalFileNotice(error) {
        if (document.getElementById("content-load-notice")) return;

        const notice = document.createElement("div");
        notice.id = "content-load-notice";
        notice.style.cssText = [
            "position:fixed",
            "left:18px",
            "right:18px",
            "bottom:18px",
            "z-index:99999",
            "background:#fff",
            "border:1px solid #d8d1ca",
            "border-left:5px solid #b54769",
            "box-shadow:0 16px 40px rgba(0,0,0,0.16)",
            "border-radius:12px",
            "padding:14px 16px",
            "color:#332b27",
            "font:14px/1.45 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
        ].join(";");

        notice.innerHTML = `
            <strong style="display:block;margin-bottom:4px;">Content files need a local server.</strong>
            <span>
                This modular version loads Markdown and CSV with fetch(), which browsers block from file:// pages.
                Run <code style="background:#f6f1ed;padding:2px 5px;border-radius:5px;">python3 -m http.server 8001</code>
                and open <code style="background:#f6f1ed;padding:2px 5px;border-radius:5px;">http://localhost:8001</code>.
            </span>
        `;

        document.body.appendChild(notice);
        console.warn("Content files could not be loaded.", error);
    }

    function splitList(value) {
        if (!value) return [];
        return String(value)
            .split(",")
            .map(item => item.trim())
            .filter(Boolean);
    }

    function splitSemicolonList(value) {
        if (!value) return [];
        return String(value)
            .split(";")
            .map(item => item.trim())
            .filter(Boolean);
    }

    function parseMetrics(value) {
        return splitSemicolonList(value).map(item => {
            const parts = item.split("|");
            return [parts[0]?.trim() || "", parts.slice(1).join("|").trim() || ""];
        }).filter(metric => metric[0] || metric[1]);
    }

    function parseLinks(value) {
        return splitSemicolonList(value).map(item => {
            const parts = item.split("|");
            return {
                label: parts[0]?.trim() || "Open",
                url: parts.slice(1).join("|").trim()
            };
        }).filter(link => link.url);
    }

    function parseScalar(value) {
        if (value === undefined) return "";
        const trimmed = String(value).trim();
        if (trimmed === "true") return true;
        if (trimmed === "false") return false;
        if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
            return trimmed.slice(1, -1);
        }
        return trimmed;
    }

    function parseFrontMatter(markdown) {
        const match = markdown.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
        if (!match) return { meta: {}, body: markdown };

        const meta = {};
        match[1].split(/\r?\n/).forEach(line => {
            const separator = line.indexOf(":");
            if (separator === -1) return;
            const key = line.slice(0, separator).trim();
            const value = line.slice(separator + 1).trim();
            meta[key] = parseScalar(value);
        });

        return { meta, body: match[2].trim() };
    }

    function parseSections(body) {
        const sections = {};
        let current = "description";

        body.split(/\r?\n/).forEach(line => {
            const heading = line.match(/^##\s+(.+?)\s*$/);
            if (heading) {
                current = heading[1].trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
                sections[current] = "";
                return;
            }

            sections[current] = `${sections[current] || ""}${line}\n`;
        });

        Object.keys(sections).forEach(key => {
            sections[key] = sections[key].trim();
        });

        return sections;
    }

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function linkify(text) {
        return escapeHtml(text).replace(
            /(https?:\/\/[^\s)]+)/g,
            '<a href="$1" target="_blank">$1</a>'
        );
    }

    function paragraphsToHtml(markdown) {
        return String(markdown || "")
            .split(/\n{2,}/)
            .map(block => block.trim())
            .filter(Boolean)
            .map(block => `<p>${linkify(block)}</p>`)
            .join("");
    }

    function normalizeItem(parsed) {
        const meta = parsed.meta;
        const sections = parseSections(parsed.body);
        const item = { ...meta, sections };

        item.metrics = parseMetrics(meta.metrics);
        item.tags = splitList(meta.tags);
        item.evidence = splitList(meta.evidence);
        item.courses = splitSemicolonList(meta.courses);
        item.links = parseLinks(meta.links);
        item.details = paragraphsToHtml(sections.details || sections.description || parsed.body);
        item.description = sections.description || meta.description || "";

        ["summary", "objective", "abstract", "motivation", "methods", "results", "insight"].forEach(key => {
            if (sections[key]) item[key] = sections[key];
        });

        if (meta.selectedOrder) item.selectedOrder = Number(meta.selectedOrder);
        return item;
    }

    async function fetchText(path) {
        const hasBundledFile = window.SagnikContentFiles && Object.prototype.hasOwnProperty.call(window.SagnikContentFiles, path);

        if (window.location.protocol === "file:" && hasBundledFile) {
            return window.SagnikContentFiles[path];
        }

        try {
            const response = await fetch(path, { cache: "no-cache" });
            if (!response.ok) throw new Error(`Could not load ${path}`);
            return response.text();
        } catch (error) {
            if (hasBundledFile) return window.SagnikContentFiles[path];
            throw error;
        }
    }

    async function loadMarkdownList(paths) {
        const loaded = await Promise.all(paths.map(async path => {
            const markdown = await fetchText(path);
            return normalizeItem(parseFrontMatter(markdown));
        }));
        return loaded.filter(item => item.id);
    }

    function parseCsvLine(line) {
        const values = [];
        let current = "";
        let quoted = false;

        for (let i = 0; i < line.length; i += 1) {
            const char = line[i];
            const next = line[i + 1];

            if (char === '"' && quoted && next === '"') {
                current += '"';
                i += 1;
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

    function parseCsv(text) {
        const lines = text.trim().split(/\r?\n/).filter(Boolean);
        const headers = parseCsvLine(lines.shift()).map(header => header.trim());

        return lines.map(line => {
            const values = parseCsvLine(line);
            return headers.reduce((row, header, index) => {
                row[header] = (values[index] || "").trim();
                return row;
            }, {});
        });
    }

    function groupMetrics(rows) {
        const groups = [];
        const byGroup = {};

        rows.forEach(row => {
            if (!byGroup[row.group]) {
                byGroup[row.group] = [];
                groups.push(byGroup[row.group]);
            }

            byGroup[row.group].push({
                source: row.source,
                value: row.value,
                label: row.label,
                actionLabel: row.actionLabel ? `${row.actionLabel} ->` : "Open project ->",
                url: row.url,
                action: () => window.open(row.url, "_blank")
            });
        });

        return groups;
    }

    function toObject(items) {
        return items.reduce((object, item) => {
            object[item.id] = item;
            return object;
        }, {});
    }

    function toPromptMap(rows = []) {
        return rows.reduce((object, row) => {
            if (row.key) object[row.key] = row.prompt || "";
            return object;
        }, {});
    }

    function getPrompt(content, keyOrPrompt) {
        if (!keyOrPrompt) return "";
        const prompts = content?.promptMap || {};
        return prompts[keyOrPrompt] || keyOrPrompt;
    }

    function resolveReference(content, type, ref) {
        if (!type || !ref) return null;
        if (type === "project") return content.projectData?.[ref] || null;
        if (type === "experience" || type === "job") return content.experienceData?.[ref] || null;
        if (type === "skill") return (content.skills || []).find(skill => skill.id === ref) || null;
        return null;
    }

    function resolveHighlights(content, placement) {
        return (content.misc?.highlights || [])
            .filter(row => row.placement === placement)
            .map(row => {
                const source = resolveReference(content, row.type, row.ref) || {};
                return {
                    ...row,
                    source,
                    title: row.titleOverride || source.title || source.org || row.ref || "",
                    description: row.descriptionOverride || source.summary || source.result || source.description || "",
                    prompt: getPrompt(content, row.target)
                };
            });
    }

    async function loadMisc(misc = {}) {
        const entries = await Promise.all(Object.entries(misc).map(async ([key, path]) => {
            const text = await fetchText(path);
            const rows = path.endsWith(".csv")
                ? parseCsv(text)
                : normalizeItem(parseFrontMatter(text));
            return [key, rows];
        }));

        return Object.fromEntries(entries);
    }

    async function loadAll() {
        try {
            const manifest = JSON.parse(await fetchText(MANIFEST_PATH));
            const [projects, experience, education, skills, metricsCsv, misc] = await Promise.all([
                loadMarkdownList(manifest.projects || []),
                loadMarkdownList(manifest.experience || []),
                loadMarkdownList(manifest.education || []),
                loadMarkdownList(manifest.skills || []),
                manifest.metrics ? fetchText(manifest.metrics) : Promise.resolve(""),
                loadMisc(manifest.misc || {})
            ]);

            const payload = {
                projects,
                projectData: toObject(projects),
                experience,
                experienceData: toObject(experience),
                education,
                educationData: toObject(education),
                skills,
                metrics: metricsCsv ? groupMetrics(parseCsv(metricsCsv)) : [],
                misc
            };

            payload.promptMap = {
                ...toPromptMap(payload.misc.assistantPrompts),
                ...toPromptMap(payload.misc.promptTemplates)
            };

            payload.resolveHighlights = placement => resolveHighlights(payload, placement);
            payload.getPrompt = keyOrPrompt => getPrompt(payload, keyOrPrompt);

            return payload;
        } catch (error) {
            if (window.location.protocol === "file:") {
                showLocalFileNotice(error);
            }
            throw error;
        }
    }

    window.SagnikContent = {
        loadAll,
        parseCsv,
        resolveReference,
        escapeHtml,
        renderNav(pages = []) {
            const current = window.location.pathname.split("/").pop() || "index.html";
            document.querySelectorAll("#nav-menu").forEach(menu => {
                menu.innerHTML = pages
                    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
                    .map(page => {
                        const active = page.match === current ? " class=\"active\"" : "";
                        return `<li><a href="${escapeHtml(page.url)}"${active}>${escapeHtml(page.title)}</a></li>`;
                    })
                    .join("");
            });
        },
        renderFooterContacts(links = []) {
            const footerLinks = links
                .filter(link => link.placement === "footer")
                .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));

            document.querySelectorAll(".home-contact-strip").forEach(strip => {
                const year = new Date().getFullYear();
                const repoUrl = "https://github.com/Sagnik-Chakravarty/sagnik-chakravarty.github.io";

                strip.classList.add("site-footer");
                strip.innerHTML = `
                    <div class="site-footer-inner">
                        <div class="site-footer-links" aria-label="Footer contact links">
                            ${footerLinks.map(link => `
                                <a href="${escapeHtml(link.href)}" ${String(link.href).startsWith("http") ? "target=\"_blank\" rel=\"noopener\"" : ""} aria-label="${escapeHtml(link.label)}">
                                    <i class="${String(link.icon).includes(" ") ? escapeHtml(link.icon) : `fa-solid ${escapeHtml(link.icon)}`}"></i>
                                </a>
                            `).join("")}
                        </div>

                        <div class="site-footer-meta">
                            <p>© ${year} Sagnik Chakravarty</p>
                            <p><a href="${repoUrl}" target="_blank" rel="noopener">${repoUrl}</a></p>
                            <p>No template used. Custom made for myself.</p>
                        </div>
                    </div>
                `;
            });
        }
    };
})();
