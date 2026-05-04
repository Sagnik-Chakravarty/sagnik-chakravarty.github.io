(function () {
    const transitionDuration = 260;

    function isExternal(target) {
        return /^(https?:)?\/\//i.test(target) || /^mailto:/i.test(target) || /^tel:/i.test(target);
    }

    function ensureTransitionLayer() {
        let layer = document.getElementById("internal-page-transition");
        if (layer) return layer;

        layer = document.createElement("div");
        layer.id = "internal-page-transition";
        layer.setAttribute("aria-hidden", "true");
        layer.innerHTML = "<span></span>";
        document.body.appendChild(layer);
        return layer;
    }

    function runPageExit(nextUrl) {
        const layer = ensureTransitionLayer();
        document.body.classList.add("internal-page-exiting");
        layer.classList.add("active");

        window.setTimeout(() => {
            window.location.href = nextUrl;
        }, transitionDuration);
    }

    function runPageEntrance() {
        const layer = ensureTransitionLayer();
        layer.classList.add("active", "entering");

        window.requestAnimationFrame(() => {
            layer.classList.remove("active");
            window.setTimeout(() => {
                layer.classList.remove("entering");
            }, transitionDuration + 40);
        });
    }

    function markScrollTarget(target) {
        target.classList.remove("internal-scroll-focus");
        void target.offsetWidth;
        target.classList.add("internal-scroll-focus");

        window.setTimeout(() => {
            target.classList.remove("internal-scroll-focus");
        }, 1250);
    }

    function scrollToHash(hash) {
        if (!hash || hash === "#") return false;

        const target = document.querySelector(hash);
        if (!target) return false;

        if (window.location.hash !== hash) {
            window.location.hash = hash;
        }

        target.scrollIntoView({ behavior: "smooth", block: "start" });
        markScrollTarget(target);
        window.dispatchEvent(new Event("hashchange"));
        return true;
    }

    function localPathname(path) {
        return new URL(path, document.baseURI || window.location.href).pathname;
    }

    function openInternal(target) {
        const value = String(target || "").trim();
        if (!value || value === "#" || isExternal(value)) return false;

        if (value.startsWith("#")) {
            return scrollToHash(value);
        }

        const [pathPart, hashPart = ""] = value.split("#");
        const hash = hashPart ? `#${hashPart}` : "";
        const targetPath = localPathname(pathPart || window.location.pathname);
        const currentPath = window.location.pathname;

        if (targetPath === currentPath && hash) {
            return scrollToHash(hash);
        }

        runPageExit(new URL(value, document.baseURI || window.location.href).href);
        return true;
    }

    function targetFromClick(event) {
        if (event.target.closest("[data-ask-sagnik]")) return "";
        if (event.target.closest("[data-resume-nav], [data-resume-section]")) return "";
        if (event.target.closest("[data-education-id], [data-experience-id], [data-experience-section], [data-project-id]")) return "";

        const explicit = event.target.closest("[data-internal-target]");
        if (explicit) return explicit.dataset.internalTarget || "";

        const card = event.target.closest("[data-link-url]");
        if (card) return card.dataset.linkUrl || "";

        const anchor = event.target.closest("a[href]");
        if (!anchor) return "";

        const href = anchor.getAttribute("href") || "";
        if (!href.includes("#") || href === "#") return "";

        return href;
    }

    document.addEventListener("click", event => {
        const target = targetFromClick(event);
        if (!target) return;

        if (openInternal(target)) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
    });

    window.addEventListener("pageshow", () => {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", runPageEntrance, { once: true });
            return;
        }

        runPageEntrance();
    });

    window.SagnikInternalButtons = {
        open: openInternal
    };
})();
