const API_URL = "http://localhost:5001";

async function loadScheduledMails() {
  const body = document.getElementById("scheduledBody");
  const count = document.getElementById("scheduledCount");
  const next = document.getElementById("nextScheduled");

  try {
    const response = await fetch(`${API_URL}/mail/scheduled`);
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Could not load scheduled emails.");
    }

    const mails = data.scheduledMails;

    count.textContent = mails.length;

    if (mails.length === 0) {
      next.textContent = "No scheduled emails";
      body.innerHTML = `
        <tr>
          <td colspan="5">No scheduled emails.</td>
        </tr>
      `;
      return;
    }

    mails.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));

    next.textContent = formatDate(mails[0].scheduledAt);

    body.innerHTML = mails.map(mail => `
      <tr>
        <td><span class="status scheduled">${mail.status}</span></td>
        <td>${mail.to.join(", ")}</td>
        <td>${mail.subject}</td>
        <td>${formatDate(mail.scheduledAt)}</td>
        <td>
          <button class="cancel-btn" onclick="cancelScheduledMail('${mail.id}')">
            Cancel
          </button>
        </td>
      </tr>
    `).join("");

  } catch (error) {
    console.error("Could not load scheduled emails:", error);

    body.innerHTML = `
      <tr>
        <td colspan="5">Could not load scheduled emails.</td>
      </tr>
    `;
  }
}

function formatDate(date) {
  return new Date(date).toLocaleString();
}

async function cancelScheduledMail(id) {
  const confirmed = confirm("Cancel this scheduled email?");

  if (!confirmed) return;

  try {
    const response = await fetch(`${API_URL}/mail/scheduled/${id}`, {
      method: "DELETE"
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Could not cancel email.");
    }

    loadScheduledMails();
  } catch (error) {
    console.error("Could not cancel scheduled email:", error);
    alert("Could not cancel the scheduled email.");
  }
}

document.addEventListener("DOMContentLoaded", loadScheduledMails);