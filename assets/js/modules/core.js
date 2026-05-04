(function () {
    function escapeHtml(value) {
        return window.SagnikContent?.escapeHtml(value) || String(value || "");
    }

    function parseLinks(value) {
        if (!value) return [];

        return String(value).split(";").map(item => {
            const [label, ...urlParts] = item.split("|");
            return {
                label: label?.trim(),
                url: urlParts.join("|").trim()
            };
        }).filter(link => link.label && link.url);
    }

    function iconClass(icon) {
        const value = String(icon || "");
        if (value.includes(" ")) return value;
        return value.startsWith("fa-") ? `fa-solid ${value}` : value;
    }

    function externalTarget(url) {
        return String(url || "").startsWith("http") ? "_blank" : "_self";
    }

    function resolveUrl(url) {
        const value = String(url || "");
        if (!value) return "";
        return new URL(value, document.baseURI || window.location.href).href;
    }

    function navigateTo(url) {
        const resolved = resolveUrl(url);
        if (resolved) window.location.href = resolved;
    }

    function resolveInternalUrl(target) {
        const value = String(target || "");
        if (!value) return "";

        if (value.startsWith("#")) {
            return new URL(value, window.location.href).href;
        }

        return resolveUrl(value);
    }

    function openInternalTarget(target, options = {}) {
        const resolved = resolveInternalUrl(target);
        if (!resolved) return;

        const url = new URL(resolved);
        const current = new URL(window.location.href);
        const samePage = url.origin === current.origin && url.pathname === current.pathname;

        if (samePage && url.hash) {
            if (options.updateHistory !== false) history.pushState(null, "", url.hash);

            const node = document.querySelector(url.hash);
            if (node) node.scrollIntoView({ behavior: options.behavior || "smooth", block: "start" });

            window.dispatchEvent(new Event("hashchange"));
            return;
        }

        window.location.href = url.href;
    }

    function createInternalButton(label, target, classes = "section-text-link button-link") {
        return `
            <button type="button" class="${escapeHtml(classes)}" data-internal-target="${escapeHtml(target)}">
                ${escapeHtml(label)}
            </button>
        `;
    }

    function setTextByDataset(selector, datasetKey, values) {
        document.querySelectorAll(selector).forEach(node => {
            const key = node.dataset[datasetKey];
            if (values[key]) node.textContent = values[key];
        });
    }

    function initNavToggle() {
        document.querySelectorAll("[data-nav-toggle]").forEach(button => {
            button.addEventListener("click", () => {
                document.getElementById("nav-menu")?.classList.toggle("show-menu");
            });
        });
    }

    function initGlobalAssistantLinks() {
        document.addEventListener("click", event => {
            const trigger = event.target.closest("[data-ask-sagnik]");
            if (!trigger) return;

            event.preventDefault();
            askSagnikGPT(trigger.dataset.askSagnik || trigger.dataset.prompt || "");
        });
    }

    function initImageFallbacks() {
        document.addEventListener("error", event => {
            const image = event.target;
            if (image instanceof HTMLImageElement && image.dataset.hideOnError === "true") {
                image.style.display = "none";
            }
        }, true);
    }

    function initEndScrollNavigation() {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        if (window.__sagnikEndScrollNavigationReady) return;
        window.__sagnikEndScrollNavigationReady = true;

        const orderedPages = [
            { match: "index.html", url: "index.html", label: "Home" },
            { match: "02-about.html", url: "pages/02-about.html", label: "About" },
            { match: "03-resume.html", url: "pages/03-resume.html", label: "Resume" },
            { match: "04-publications.html", url: "pages/04-publications.html", label: "Publications" },
            { match: "04-research.html", url: "pages/04-research.html", label: "Research" },
            { match: "05-contact.html", url: "pages/05-contact.html", label: "Contact" }
        ];

        const currentName = window.location.pathname.split("/").pop() || "index.html";
        const currentIndex = orderedPages.findIndex(page => page.match === currentName);
        const previousPage = currentIndex > 0 ? orderedPages[currentIndex - 1] : null;
        const currentPage = currentIndex >= 0 ? orderedPages[currentIndex] : null;
        const nextPage = currentIndex >= 0 ? orderedPages[currentIndex + 1] : null;
        if (!previousPage && !nextPage) return;

        const arrival = (() => {
            try {
                return JSON.parse(sessionStorage.getItem("sagnik_page_scroll_transition") || "null");
            } catch (error) {
                return null;
            }
        })();
        sessionStorage.removeItem("sagnik_page_scroll_transition");

        const indicator = document.createElement("div");
        indicator.className = "page-scroll-resistance";
        indicator.setAttribute("aria-hidden", "true");
        indicator.innerHTML = `
            <div class="page-scroll-arc"></div>
            <div class="page-scroll-label">
                <span>Keep scrolling</span>
                <strong></strong>
            </div>
        `;
        document.body.appendChild(indicator);

        const showArrivalClock = transition => {
            if (!transition || !window.matchMedia("(min-width: 901px)").matches) return;

            const fromLabel = transition.fromLabel || "";
            const toLabel = transition.toLabel || currentPage?.label || "";
            const directionClass = transition.direction === "previous" ? "page-arrival-previous" : "page-arrival-next";
            const clock = document.createElement("div");
            clock.className = `page-arrival-clock ${directionClass}`;
            clock.setAttribute("aria-hidden", "true");
            clock.innerHTML = `
                <div class="page-arrival-clock-ring"></div>
                <div class="page-arrival-clock-pointer"></div>
                <div class="page-arrival-clock-dial">
                    <span class="page-arrival-from">${escapeHtml(fromLabel)}</span>
                    <strong class="page-arrival-to">${escapeHtml(toLabel)}</strong>
                </div>
            `;
            document.body.appendChild(clock);
            window.setTimeout(() => clock.classList.add("is-turning"), 40);
            window.setTimeout(() => clock.remove(), 2050);
        };

        if (arrival?.to === currentPage?.match) {
            showArrivalClock(arrival);
        }

        let pull = 0;
        let direction = "";
        let resetTimer;
        let navigating = false;
        let touchStartY = null;
        const threshold = 185;

        const atPageStart = () => window.scrollY <= 4;

        const atPageEnd = () => {
            const scrollBottom = window.scrollY + window.innerHeight;
            const pageHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
            return pageHeight - scrollBottom <= 4;
        };

        const setDirection = nextDirection => {
            if (direction === nextDirection) return;
            direction = nextDirection;
            const target = direction === "previous" ? previousPage : nextPage;

            indicator.classList.toggle("page-scroll-up", direction === "previous");
            indicator.classList.toggle("page-scroll-down", direction === "next");
            indicator.querySelector(".page-scroll-label strong").textContent = target?.label || "";
            document.body.classList.toggle("page-scroll-up", direction === "previous");
            document.body.classList.toggle("page-scroll-down", direction === "next");
        };

        const resetPull = () => {
            pull = 0;
            direction = "";
            document.documentElement.style.setProperty("--page-scroll-pull", "0");
            document.body.classList.remove("page-scroll-resisting", "page-scroll-up", "page-scroll-down");
            indicator.classList.remove("page-scroll-up", "page-scroll-down");
        };

        const navigatePage = targetPage => {
            if (navigating) return;
            navigating = true;
            document.body.classList.add("page-scroll-leaving");
            indicator.classList.add("page-scroll-leaving");
            sessionStorage.setItem("sagnik_page_scroll_transition", JSON.stringify({
                from: currentPage?.match || "",
                fromLabel: currentPage?.label || "",
                to: targetPage.match,
                toLabel: targetPage.label,
                direction
            }));
            window.setTimeout(() => {
                window.location.href = resolveUrl(targetPage.url);
            }, 220);
        };

        const addPull = (nextDirection, amount) => {
            if (navigating || amount <= 0) return;
            const targetPage = nextDirection === "previous" ? previousPage : nextPage;
            if (!targetPage) return;

            setDirection(nextDirection);
            pull = Math.min(threshold + 35, pull + amount);
            const progress = Math.min(1, pull / threshold);

            document.documentElement.style.setProperty("--page-scroll-pull", String(Math.round(progress * 100)));
            document.body.classList.add("page-scroll-resisting");

            window.clearTimeout(resetTimer);
            resetTimer = window.setTimeout(resetPull, 420);

            if (pull >= threshold) navigatePage(targetPage);
        };

        window.addEventListener("wheel", event => {
            if (event.deltaY > 0 && atPageEnd() && nextPage) {
                event.preventDefault();
                addPull("next", Math.min(42, Math.abs(event.deltaY) * 0.45));
                return;
            }

            if (event.deltaY < 0 && atPageStart() && previousPage) {
                event.preventDefault();
                addPull("previous", Math.min(42, Math.abs(event.deltaY) * 0.45));
                return;
            }

            if (pull) {
                return;
            }
        }, { passive: false });

        window.addEventListener("touchstart", event => {
            touchStartY = event.touches[0]?.clientY ?? null;
        }, { passive: true });

        window.addEventListener("touchmove", event => {
            if (touchStartY === null) return;
            const currentY = event.touches[0]?.clientY ?? touchStartY;
            const upwardPull = touchStartY - currentY;
            const downwardPull = currentY - touchStartY;

            if (upwardPull > 0 && atPageEnd() && nextPage) {
                event.preventDefault();
                addPull("next", Math.min(34, upwardPull * 0.14));
                return;
            }

            if (downwardPull > 0 && atPageStart() && previousPage) {
                event.preventDefault();
                addPull("previous", Math.min(34, downwardPull * 0.14));
            }
        }, { passive: false });

        window.addEventListener("touchend", () => {
            touchStartY = null;
            if (!navigating) window.setTimeout(resetPull, 220);
        }, { passive: true });
    }

    function initInternalButtons() {
        document.addEventListener("click", event => {
            if (event.defaultPrevented) return;

            const explicitButton = event.target.closest("[data-internal-target]");
            if (explicitButton) {
                event.preventDefault();
                openInternalTarget(explicitButton.dataset.internalTarget || "");
                return;
            }

            const generatedCard = event.target.closest("[data-link-url]");
            if (generatedCard) {
                const target = generatedCard.dataset.linkUrl || "";
                if (!target.startsWith("http")) {
                    event.preventDefault();
                    openInternalTarget(target);
                }
                return;
            }

            const link = event.target.closest("a[href]");
            if (!link) return;

            const href = link.getAttribute("href") || "";
            if (!href.includes("#") || href === "#") return;

            const url = new URL(resolveInternalUrl(href));
            const current = new URL(window.location.href);
            if (url.origin !== current.origin || url.pathname !== current.pathname || !url.hash) return;

            event.preventDefault();
            openInternalTarget(href);
        });
    }

    function askSagnikGPT(question) {
        if (question) sessionStorage.setItem("sagnikgpt_query", question);
        navigateTo("pages/04-publications.html#research-assistant");
    }

    function mergeById(existing, loaded) {
        return Object.entries(loaded || {}).reduce((merged, [id, item]) => {
            merged[id] = { ...(merged[id] || {}), ...item };
            return merged;
        }, { ...existing });
    }

    function initCommon() {
        initNavToggle();
        initGlobalAssistantLinks();
        initImageFallbacks();
        initEndScrollNavigation();
    }

    window.SagnikApp = {
        askSagnikGPT,
        escapeHtml,
        externalTarget,
        iconClass,
        initCommon,
        mergeById,
        navigateTo,
        createInternalButton,
        openInternalTarget,
        parseLinks,
        resolveUrl,
        resolveInternalUrl,
        setTextByDataset
    };
})();
