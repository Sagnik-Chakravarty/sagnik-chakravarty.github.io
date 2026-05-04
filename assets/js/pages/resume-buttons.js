(function () {
    const fallbackTitles = {
        overview: ["Resume Overview", "The resume script is still loading. Click again in a moment if the full modular content has not appeared."],
        education: ["Academic Background", "Education content will render here from the modular resume data."],
        experience: ["Research, Teaching, and Industry", "Experience content will render here from the modular resume data."],
        projects: ["Projects, Papers, Reports, and Posters", "Project content will render here from the modular resume data."],
        skills: ["Skills with Evidence", "Skills content will render here from the modular resume data."]
    };

    function sectionFrom(control) {
        return control?.dataset?.resumeNav || control?.dataset?.resumeSection || "";
    }

    function setActive(section) {
        document.querySelectorAll(".resume-tab, .resume-simple-tabs [data-resume-nav]").forEach(button => {
            const idMatch = button.id === `tab-${section}`;
            const dataMatch = button.dataset.resumeNav === section;
            button.classList.toggle("active", idMatch || dataMatch);
        });
    }

    function pulse(control) {
        if (!control) return;

        control.classList.remove("resume-control-pulse");
        void control.offsetWidth;
        control.classList.add("resume-control-pulse");

        window.clearTimeout(control._resumePulseTimer);
        control._resumePulseTimer = window.setTimeout(() => {
            control.classList.remove("resume-control-pulse");
        }, 420);
    }

    function fallbackRender(section) {
        const panel = document.getElementById("resume-content");
        const [title, body] = fallbackTitles[section] || fallbackTitles.overview;
        if (!panel) return;

        panel.innerHTML = `
            <div class="resume-welcome-screen">
                <div class="resume-section-header-v2">
                    <div>
                        <p class="section-eyebrow">Resume</p>
                        <h2>${title}</h2>
                        <p class="welcome-intro">${body}</p>
                    </div>
                </div>
            </div>
        `;
    }

    function updateHash(section) {
        const nextUrl = `${window.location.pathname}${window.location.search}#${section}`;
        try {
            history.replaceState(null, "", nextUrl);
        } catch (error) {
            window.location.hash = section;
        }
    }

    function navigate(section) {
        if (!section) return false;

        setActive(section);

        if (window.location.hash !== `#${section}`) {
            updateHash(section);
        }

        try {
            if (window.SagnikResume?.navigateSection) {
                window.SagnikResume.navigateSection(section, true, true);
                return false;
            }
        } catch (error) {
            console.error("Resume renderer failed; using button fallback.", error);
            fallbackRender(section);
            return false;
        }

        fallbackRender(section);
        window.setTimeout(() => {
            try {
                window.SagnikResume?.navigateSection?.(section, true, true);
            } catch (error) {
                console.error("Resume delayed renderer failed.", error);
            }
        }, 100);

        return false;
    }

    function resumeButton(section) {
        const control = document.querySelector(`[data-resume-nav="${section}"]`) || document.getElementById(`tab-${section}`);
        pulse(control);
        return navigate(section);
    }

    function handleResumeSectionButton(event) {
        const control = event.target.closest("[data-resume-nav], [data-resume-section]");
        if (!control) return;

        event.preventDefault();
        event.stopPropagation();

        const section = sectionFrom(control);
        if (!section) return;

        pulse(control);
        navigate(section);
    }

    window.resumeButton = resumeButton;
    window.showSection = resumeButton;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            if (!document.getElementById("resume-content")?.innerHTML.trim()) {
                resumeButton(window.location.hash.replace("#", "") || "overview");
            }
        });
    } else if (!document.getElementById("resume-content")?.innerHTML.trim()) {
        resumeButton(window.location.hash.replace("#", "") || "overview");
    }

    document.addEventListener("click", handleResumeSectionButton);
})();
