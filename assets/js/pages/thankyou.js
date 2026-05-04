(function () {
    document.addEventListener("DOMContentLoaded", async () => {
        window.SagnikApp.initCommon();

        if (!window.SagnikContent) return;

        try {
            const content = await window.SagnikContent.loadAll();
            window.SagnikContent.renderNav(content.misc?.pages || []);
            window.SagnikContent.renderFooterContacts(content.misc?.contactLinks || []);
        } catch (error) {
            console.warn("Thank-you page content files could not be loaded.", error);
        }
    });
})();
