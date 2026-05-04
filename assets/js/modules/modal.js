(function () {
    function createPosterModalController(modalId, imageId, altSuffix = " poster") {
        const modal = document.getElementById(modalId);
        const image = document.getElementById(imageId);

        function open(src, title = "Expanded poster") {
            if (!modal || !image || !src) return;

            modal.style.display = "flex";
            image.src = src;
            image.alt = `${title}${altSuffix}`;
        }

        function close() {
            if (modal) modal.style.display = "none";
        }

        if (modal) {
            modal.addEventListener("click", event => {
                if (event.target === modal || event.target.closest("[data-modal-close]")) {
                    close();
                }
            });
        }

        return { open, close };
    }

    window.SagnikModal = {
        createPosterModalController
    };
})();
