const API_URL = "http://localhost:5001";

const recipients = [];

const recipientInput = document.getElementById("recipientInput");
const recipientChips = document.getElementById("recipientChips");
const recipientCount = document.getElementById("recipientCount");

const subjectInput = document.getElementById("subject");
const messageInput = document.getElementById("message");

const characterCount = document.getElementById("characterCount");

const sendButton = document.getElementById("sendButton");
const sendText = document.getElementById("sendText");


/* --------------------------------
   RECIPIENT INPUT
-------------------------------- */

recipientInput.addEventListener("keydown", function (event) {

    if (event.key === "Enter") {

        event.preventDefault();

        const email = recipientInput.value.trim();

        if (!email) {
            return;
        }

        addRecipient(email);
    }

});


/* --------------------------------
   ADD RECIPIENT
-------------------------------- */

function addRecipient(email) {

    email = email.toLowerCase();

    if (!isValidEmail(email)) {

        showToast(
            "Invalid email",
            "Please enter a valid email address."
        );

        return;
    }

    if (recipients.includes(email)) {

        showToast(
            "Already added",
            "This recipient is already in the list."
        );

        recipientInput.value = "";

        return;
    }

    recipients.push(email);

    recipientInput.value = "";

    renderRecipients();
}


/* --------------------------------
   REMOVE RECIPIENT
-------------------------------- */

function removeRecipient(index) {

    recipients.splice(index, 1);

    renderRecipients();
}


/* --------------------------------
   RENDER RECIPIENTS
-------------------------------- */

function renderRecipients() {

    recipientChips.innerHTML = "";

    recipients.forEach((email, index) => {

        const chip = document.createElement("div");

        chip.className = "recipient-chip";

        chip.innerHTML = `
            <span>${escapeHTML(email)}</span>

            <button
                type="button"
                onclick="removeRecipient(${index})"
                aria-label="Remove recipient"
            >
                ×
            </button>
        `;

        recipientChips.appendChild(chip);
    });


    recipientCount.textContent =
        `${recipients.length} ${
            recipients.length === 1 ? "recipient" : "recipients"
        }`;
}


/* --------------------------------
   MESSAGE CHARACTER COUNT
-------------------------------- */

messageInput.addEventListener("input", function () {

    const length = messageInput.value.length;

    characterCount.textContent =
        `${length} characters`;
});


/* --------------------------------
   SEND EMAILS
-------------------------------- */

async function sendEmails() {

    const subject = subjectInput.value.trim();
    const message = messageInput.value.trim();


    if (recipients.length === 0) {

        showToast(
            "Add a recipient",
            "Please add at least one email address."
        );

        recipientInput.focus();

        return;
    }


    if (!subject) {

        showToast(
            "Subject required",
            "Please enter an email subject."
        );

        subjectInput.focus();

        return;
    }


    if (!message) {

        showToast(
            "Message required",
            "Please write your message."
        );

        messageInput.focus();

        return;
    }


    /* Loading state */

    sendButton.classList.add("loading");

    sendText.textContent = "Sending...";


    let successful = 0;
    let failed = 0;


    /*
       Your backend sends one email per request.

       Therefore we send one request for each
       recipient instead of putting all emails
       into one Gmail request.
    */

    for (const email of recipients) {

        try {

            const response = await fetch(
                `${API_URL}/mail/send`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        to: email,
                        subject: subject,
                        message: message
                    })
                }
            );


            const result = await response.json();


            if (result.success) {

                successful++;

            } else {

                failed++;
            }


        } catch (error) {

            console.error(
                `Failed to send to ${email}:`,
                error
            );

            failed++;
        }
    }


    /* Reset button */

    sendButton.classList.remove("loading");

    sendText.textContent = "Send message";


    /* Result */

    if (successful > 0 && failed === 0) {

        showToast(
            "Message sent",
            `Successfully sent to ${successful} ${
                successful === 1 ? "recipient" : "recipients"
            }.`
        );


        clearComposer();

    } else if (successful > 0 && failed > 0) {

        showToast(
            "Partially sent",
            `${successful} sent successfully, ${failed} failed.`
        );

    } else {

        showToast(
            "Unable to send",
            "Please check your Gmail connection."
        );
    }
}


/* --------------------------------
   CLEAR COMPOSER
-------------------------------- */

function clearComposer() {

    recipients.length = 0;

    renderRecipients();

    subjectInput.value = "";

    messageInput.value = "";

    characterCount.textContent = "0 characters";
}


/* --------------------------------
   SCROLL TO COMPOSER
-------------------------------- */

function focusComposer() {

    document
        .getElementById("composer")
        .scrollIntoView({
            behavior: "smooth"
        });


    setTimeout(() => {

        recipientInput.focus();

    }, 600);
}


/* --------------------------------
   TOAST
-------------------------------- */

let toastTimeout;

function showToast(title, message) {

    const toast = document.getElementById("toast");

    const toastTitle =
        document.getElementById("toastTitle");

    const toastMessage =
        document.getElementById("toastMessage");


    toastTitle.textContent = title;

    toastMessage.textContent = message;


    toast.classList.add("show");


    clearTimeout(toastTimeout);


    toastTimeout = setTimeout(() => {

        toast.classList.remove("show");

    }, 4000);
}


/* --------------------------------
   EMAIL VALIDATION
-------------------------------- */

function isValidEmail(email) {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}


/* --------------------------------
   BASIC HTML ESCAPE
-------------------------------- */

function escapeHTML(value) {

    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}