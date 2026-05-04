(function () {
    const API_URL = "https://sagnikgpt.onrender.com/api/chat";
    const TIMEOUT_MS = 120000;

    function autoLinkFilePaths(text) {
        if (!text) return text;

        return text.replace(
            /\b([\w\.\/\-]+?\.(?:pdf|html|txt|md|png|jpg|jpeg|csv))\b/gi,
            '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
        );
    }

    function renderMarkdown(text) {
        if (!window.marked || !window.DOMPurify) return window.SagnikApp.escapeHtml(text);

        const processed = autoLinkFilePaths(text || "");
        const html = window.marked.parse(processed);
        return window.DOMPurify.sanitize(html, {
            USE_PROFILES: { html: true }
        });
    }

    function getSessionId() {
        let sessionId = localStorage.getItem("sagnikgpt_session_id");

        if (!sessionId) {
            sessionId = crypto.randomUUID();
            localStorage.setItem("sagnikgpt_session_id", sessionId);
        }

        return sessionId;
    }

    function createResearchAssistant(options = {}) {
        const input = document.getElementById(options.inputId || "assistant-input");
        const messages = document.getElementById(options.messagesId || "assistant-messages");
        const sendButton = document.getElementById(options.sendButtonId || "assistant-send-btn");
        const assistantSection = document.getElementById(options.sectionId || "research-assistant");

        function appendMessage(text, type = "bot") {
            if (!messages) return null;

            const message = document.createElement("div");
            message.className = `assistant-message ${type}`;

            if (type === "bot") {
                message.innerHTML = renderMarkdown(text);
            } else {
                message.textContent = text;
            }

            messages.appendChild(message);
            messages.scrollTo({
                top: messages.scrollHeight,
                behavior: "smooth"
            });

            return message;
        }

        function usePrompt(promptText, scroll = false) {
            if (!input) return;

            input.value = promptText || "";

            if (scroll && assistantSection) {
                assistantSection.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
            }

            setTimeout(() => input.focus(), scroll ? 450 : 0);
        }

        function sendMessage() {
            if (!input || !messages || !sendButton) return;

            const userText = input.value.trim();
            if (!userText) return;

            appendMessage(userText, "user");

            input.value = "";
            sendButton.disabled = true;
            sendButton.textContent = "Sending";

            const loadingMessage = document.createElement("div");
            loadingMessage.className = "assistant-message loading";
            loadingMessage.innerHTML = "Thinking<span class='dots'></span>";
            messages.appendChild(loadingMessage);
            messages.scrollTop = messages.scrollHeight;

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

            fetch(API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    message: userText,
                    session_id: getSessionId()
                }),
                signal: controller.signal
            })
                .then(async response => {
                    let data = {};

                    try {
                        data = await response.json();
                    } catch {
                        throw new Error("Backend returned a non-JSON response.");
                    }

                    if (!response.ok) {
                        throw new Error(data.reply || data.error || "Backend request failed.");
                    }

                    return data;
                })
                .then(data => {
                    loadingMessage.remove();
                    appendMessage(data.reply || "No response received.", "bot");

                    if (data.source_markdown) {
                        const details = document.createElement("details");
                        details.className = "assistant-sources";

                        const summary = document.createElement("summary");
                        summary.textContent = "References";
                        details.appendChild(summary);

                        const content = document.createElement("div");
                        content.className = "assistant-sources-content";
                        content.innerHTML = renderMarkdown(data.source_markdown);
                        details.appendChild(content);

                        messages.appendChild(details);
                        messages.scrollTo({ top: messages.scrollHeight, behavior: "smooth" });
                    }
                })
                .catch(error => {
                    loadingMessage.remove();

                    let errorText = "I could not connect to SagnikGPT right now. Please make sure the backend is running.";
                    if (error.name === "AbortError") {
                        errorText = "SagnikGPT took too long to respond. Please try again.";
                    }

                    appendMessage(errorText, "bot error");
                    console.error("SagnikGPT error:", error);
                })
                .finally(() => {
                    clearTimeout(timeout);
                    sendButton.disabled = false;
                    sendButton.textContent = "Send";
                    input.focus();
                });
        }

        if (sendButton) sendButton.addEventListener("click", sendMessage);
        if (input) {
            input.addEventListener("keydown", event => {
                if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                }
            });
        }

        return {
            sendMessage,
            usePrompt
        };
    }

    window.SagnikAssistant = {
        createResearchAssistant
    };
})();
