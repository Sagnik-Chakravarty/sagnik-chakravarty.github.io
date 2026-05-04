(function () {
    const app = window.SagnikApp;

    async function hydrateContactContent() {
        if (!window.SagnikContent) return;

        try {
            const content = await window.SagnikContent.loadAll();
            window.SagnikContent.renderNav(content.misc.pages || []);
            window.SagnikContent.renderFooterContacts(content.misc.contactLinks || []);

            const intents = document.getElementById("contact-intent-grid");
            if (intents) {
                const rows = content.misc.contactIntents || [];
                intents.style.gridTemplateColumns = `repeat(${Math.min(Math.max(rows.length, 1), 4)}, minmax(0, 1fr))`;
                intents.innerHTML = rows.map(row => `
                    <div>
                        <i class="${app.escapeHtml(app.iconClass(row.icon))}"></i>
                        <p>${app.escapeHtml(row.label)}</p>
                    </div>
                `).join("");
            }

            const links = document.getElementById("contact-link-grid");
            if (links) {
                const rows = (content.misc.contactLinks || [])
                    .filter(link => link.placement === "directory")
                    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));

                links.style.gridTemplateColumns = `repeat(${Math.min(Math.max(rows.length, 1), 2)}, minmax(0, 1fr))`;
                links.innerHTML = rows.map(link => `
                    <a href="${app.escapeHtml(link.href)}" ${String(link.href).startsWith("http") ? "target=\"_blank\"" : ""}>
                        <div class="contact-link-icon-v2">
                            <i class="${app.escapeHtml(app.iconClass(link.icon))}"></i>
                        </div>
                        <div>
                            <span>${app.escapeHtml(link.label)}</span>
                            <strong>${app.escapeHtml(link.value)}</strong>
                        </div>
                    </a>
                `).join("");

                const image = rows.find(row => row.image)?.image;
                const hero = document.querySelector(".contact-hero-card-v2");
                if (hero && image) {
                    hero.style.backgroundImage = `linear-gradient(rgba(255,255,255,.88), rgba(255,255,255,.88)), url("${image}")`;
                    hero.style.backgroundSize = "cover";
                    hero.style.backgroundPosition = "center";
                }
            }
        } catch (error) {
            console.warn("Contact content files could not be loaded.", error);
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        app.initCommon();
        hydrateContactContent();
    });
})();
