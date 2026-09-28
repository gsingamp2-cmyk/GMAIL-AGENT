const API_URL="http://localhost:5001";
document.addEventListener("DOMContentLoaded",loadHistory);
async function loadHistory(){
    const countElement=document.getElementById("historyCount");
    const bodyElement=document.getElementById("historyBody");
    try{
        const response=await fetch(`${API_URL}/mail/history`);
        const data=await response.json();
        if(!data.success){
            throw new Error("Failed to load history");
        }
        const history=data.history||[];
        countElement.textContent=`${history.length} message${history.length===1?"":"s"}`;
        if(history.length===0){
            bodyElement.innerHTML=`<tr><td colspan="5">No messages sent yet.</td></tr>`;
            return;
        }
        bodyElement.innerHTML=history.map(item=>{
            const recipients=(item.recipients||[]).map(recipient=>recipient.email).join(", ");
            return `
                <tr>
                    <td><span class="status">${escapeHTML(item.status||"sent")}</span></td>
                    <td class="subject">${escapeHTML(item.subject||"(No subject)")}</td>
                    <td>${escapeHTML(recipients)}</td>
                    <td class="message">${escapeHTML(item.message||"")}</td>
                    <td>${formatDate(item.sentAt)}</td>
                </tr>
            `;
        }).join("");
    }catch(error){
        console.error("History error:",error);
        countElement.textContent="Unable to load history";
        bodyElement.innerHTML=`<tr><td colspan="5">Unable to load history. Please make sure the backend is running.</td></tr>`;
    }
}
function formatDate(value){
    if(!value)return"—";
    const date=new Date(value);
    if(Number.isNaN(date.getTime()))return"—";
    return date.toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
}
function escapeHTML(value){
    return String(value)
        .replaceAll("&","&amp;")
        .replaceAll("<","&lt;")
        .replaceAll(">","&gt;")
        .replaceAll('"',"&quot;")
        .replaceAll("'","&#039;");
}