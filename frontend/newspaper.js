const API_URL = "http://localhost:5001";
let nextPageToken = null;
let isLoading = false;

const emailGrid = document.getElementById("emailGrid");
const inboxStatus = document.getElementById("inboxStatus");
const refreshButton = document.getElementById("refreshButton");
const loadMoreButton = document.getElementById("loadMoreButton");

document.getElementById("editionDate").textContent = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
});

function escapeHTML(value = "") {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function formatDate(value) {
    if (!value) return "Date unavailable";

    const date = new Date(value);

    return isNaN(date.getTime())
        ? escapeHTML(value)
        : date.toLocaleString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
}

function renderEmail(email) {
    const unreadClass = email.unread ? "unread" : "";
    const sender = escapeHTML(email.from || "Unknown sender");
    const subject = escapeHTML(email.subject || "(No subject)");
    const snippet = escapeHTML(email.snippet || "No preview available.");

    return `
        <article class="email-card ${unreadClass}">
            <div class="email-card-top">
                <span class="email-category">${email.unread ? "Unread" : "Inbox"}</span>
                <span class="email-date">${formatDate(email.date)}</span>
            </div>
            <div class="email-sender">${sender}</div>
            <h3 class="email-subject">${subject}</h3>
            <p class="email-snippet">${snippet}</p>
            <div class="email-card-footer">
                <span class="email-label">${email.unread ? "NEW MESSAGE" : "EMAIL"}</span>
                <button type="button" class="read-email-button" onclick="readEmail('${escapeHTML(email.id)}')">
                    Read Email ↗
                </button>
            </div>
        </article>
    `;
}

async function loadInbox(loadMore = false) {
    if (isLoading) return;

    isLoading = true;
    refreshButton.disabled = true;
    loadMoreButton.disabled = true;

    if (!loadMore) {
        nextPageToken = null;
        emailGrid.innerHTML = "";
        inboxStatus.hidden = false;
        inboxStatus.textContent = "Fetching your latest Gmail messages...";
    }

    try {
        const params = new URLSearchParams({ maxResults: "20" });

        if (loadMore && nextPageToken) {
            params.set("pageToken", nextPageToken);
        }

        const response = await fetch(`${API_URL}/mail/inbox?${params}`);
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || "Could not retrieve inbox emails.");
        }

        const emails = data.emails || [];

        emailGrid.insertAdjacentHTML(
            "beforeend",
            emails.map(renderEmail).join("")
        );

        const existingCount = emailGrid.querySelectorAll(".email-card").length;

        document.getElementById("totalEmails").textContent =
            data.resultSizeEstimate ?? existingCount;

        document.getElementById("unreadEmails").textContent =
            emailGrid.querySelectorAll(".email-card.unread").length;

        document.getElementById("emailCount").textContent =
            `${existingCount} emails displayed`;

        nextPageToken = data.nextPageToken || null;
        loadMoreButton.hidden = !nextPageToken;
        inboxStatus.hidden = true;

        if (emails.length === 0 && existingCount === 0) {
            inboxStatus.hidden = false;
            inboxStatus.textContent =
                "Your inbox is empty. New emails will appear here when available.";
        } else if (emails.length === 0 && loadMore) {
            inboxStatus.hidden = false;
            inboxStatus.textContent = "There are no more emails to load.";
        }
    } catch (error) {
        console.error("Inbox loading error:", error);
        inboxStatus.hidden = false;
        inboxStatus.textContent = `Could not load emails: ${error.message}`;
    } finally {
        isLoading = false;
        refreshButton.disabled = false;
        loadMoreButton.disabled = false;
    }
}

async function readEmail(id) {
    const previousScrollY = window.scrollY;
    const previousStatus = inboxStatus.textContent;

    inboxStatus.hidden = false;
    inboxStatus.textContent = "Opening email...";

    try {
        const response = await fetch(
            `${API_URL}/mail/inbox/${encodeURIComponent(id)}`
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || "Could not open this email.");
        }

        const email = data.email;
        const viewer = document.createElement("section");

        viewer.className = "email-reader";

        viewer.innerHTML = `
            <div class="email-reader-header">
                <button type="button" class="read-email-button" id="backToNewspaper">
                    ← Back to Newspaper
                </button>
                <span class="section-label">FULL EMAIL</span>
            </div>
            <div class="email-reader-content">
                <span class="section-label">MESSAGE DETAILS</span>
                <h2 class="email-reader-subject">${escapeHTML(email.subject || "(No subject)")}</h2>
                <div class="email-reader-meta">
                    <p><strong>From:</strong> ${escapeHTML(email.from || "Unknown sender")}</p>
                    <p><strong>To:</strong> ${escapeHTML(email.to || "Unknown recipient")}</p>
                    <p><strong>Date:</strong> ${formatDate(email.date)}</p>
                </div>
                <hr>
                <div class="email-reader-body">${escapeHTML(email.body || "No message content available.")}</div>
            </div>
        `;

        emailGrid.hidden = true;
        emailGrid.parentNode.insertBefore(viewer, emailGrid);
        inboxStatus.hidden = true;

        viewer.querySelector("#backToNewspaper").addEventListener("click", () => {
            viewer.remove();
            emailGrid.hidden = false;
            inboxStatus.textContent = previousStatus;
            inboxStatus.hidden = true;
            window.scrollTo(0, previousScrollY);
        });

        window.scrollTo(0, 0);
    } catch (error) {
        console.error("Email reading error:", error);
        inboxStatus.hidden = false;
        inboxStatus.textContent = `Could not open email: ${error.message}`;
    }
}

function loadMoreEmails() {
    loadInbox(true);
}

document.addEventListener("DOMContentLoaded", () => loadInbox());