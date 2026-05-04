function bindEvents() {
    document.addEventListener("click", event => {
        const control = event.target.closest("[data-resume-nav], [data-resume-section]");
        if (!control) return;

        const section = control.dataset.resumeNav || control.dataset.resumeSection || "";
        if (!section) return;

        event.preventDefault();
        pulseResumeControl(control);
        navigateResumeSection(section, true, true);
    });

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
            renderExperienceTimeline(
                experienceSection.dataset.experienceSection,
                experienceSection.dataset.experienceHeading || sectionTitle(experienceSection.dataset.experienceSection)
            );
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