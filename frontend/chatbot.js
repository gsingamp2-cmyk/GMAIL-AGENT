const messagesElement=document.getElementById("messages");
const input=document.getElementById("messageInput");
const sendButton=document.getElementById("sendButton");

const draftTo=document.getElementById("draftTo");
const draftSubject=document.getElementById("draftSubject");
const draftMessage=document.getElementById("draftMessage");
const draftStatus=document.getElementById("draftStatus");
const draftInfo=document.getElementById("draftInfo");
const sendEmailButton=document.getElementById("sendEmailButton");

const chatHistoryList=document.getElementById("chatHistoryList");
const newChatButton=document.getElementById("newChatButton");

const CHAT_STORAGE_KEY="myAgentConversations";
const OLD_CHAT_STORAGE_KEY="myAgentChatHistory";
const API_URL="http://localhost:5001";

let conversations=[];
let currentChatId=null;
let conversation=[];
let currentDraft=null;
let currentScheduledAt=null;
let pendingCancellation=null;

function createChatId(){
    return Date.now().toString()+"-"+Math.random().toString(36).substring(2,8);
}

function createChatTitle(){
    const firstUserMessage=conversation.find(message=>message.role==="user");

    if(!firstUserMessage)return "New conversation";

    let title=firstUserMessage.content.trim();

    if(title.length>35)title=title.substring(0,35)+"...";

    return title;
}

function saveAllConversations(){
    localStorage.setItem(CHAT_STORAGE_KEY,JSON.stringify(conversations));
}

function getCurrentChat(){
    return conversations.find(chat=>chat.id===currentChatId);
}

function saveCurrentChat(){
    if(!currentChatId)return;

    const chat=getCurrentChat();

    if(!chat)return;

    chat.messages=conversation;
    chat.draft=currentDraft;
    chat.scheduledAt=currentScheduledAt;
    chat.title=createChatTitle();
    chat.updatedAt=new Date().toISOString();

    saveAllConversations();
    renderChatHistory();
}

function createNewChat(){
    const newChat={
        id:createChatId(),
        title:"New conversation",
        messages:[],
        draft:null,
        scheduledAt:null,
        createdAt:new Date().toISOString(),
        updatedAt:new Date().toISOString()
    };

    conversations.unshift(newChat);
    currentChatId=newChat.id;
    conversation=[];
    currentDraft=null;
    currentScheduledAt=null;
    pendingCancellation=null;

    saveAllConversations();
    clearChatScreen();
    renderChatHistory();
}

function loadAllConversations(){
    const saved=localStorage.getItem(CHAT_STORAGE_KEY);

    if(saved){
        try{
            conversations=JSON.parse(saved);
        }catch(error){
            console.error("Could not load conversations:",error);
            conversations=[];
        }
    }

    if(conversations.length===0){
        const oldSaved=localStorage.getItem(OLD_CHAT_STORAGE_KEY);

        if(oldSaved){
            try{
                const oldData=JSON.parse(oldSaved);

                if(oldData.conversation&&oldData.conversation.length>0){
                    conversations.push({
                        id:createChatId(),
                        title:"Previous conversation",
                        messages:oldData.conversation,
                        draft:oldData.currentDraft||null,
                        scheduledAt:null,
                        createdAt:new Date().toISOString(),
                        updatedAt:new Date().toISOString()
                    });

                    saveAllConversations();
                }
            }catch(error){
                console.error("Could not migrate old chat:",error);
            }
        }
    }

    if(conversations.length>0){
        openChat(conversations[0].id);
    }else{
        createNewChat();
    }
}

function openChat(chatId){
    const chat=conversations.find(item=>item.id===chatId);

    if(!chat)return;

    currentChatId=chat.id;
    conversation=chat.messages||[];
    currentDraft=chat.draft||null;
    currentScheduledAt=chat.scheduledAt||null;
    pendingCancellation=null;

    messagesElement.innerHTML="";

    if(conversation.length===0){
        addMessage("Hi! 👋 Tell me what email you want to send and I'll prepare the draft for you.","bot");
    }else{
        conversation.forEach(message=>{
            addMessage(message.content,message.role==="assistant"?"bot":"user");
        });
    }

    updateDraft(currentDraft,false);
    updateScheduleUI();
    renderChatHistory();
}

function clearChatScreen(){
    messagesElement.innerHTML="";
    addMessage("Hi! 👋 Tell me what email you want to send and I'll prepare the draft for you.","bot");
    updateDraft(null,false);
    currentScheduledAt=null;
    pendingCancellation=null;
    updateScheduleUI();
}

function renderChatHistory(){
    chatHistoryList.innerHTML="";

    if(conversations.length===0){
        chatHistoryList.innerHTML=`<div class="empty-history">No conversations yet.</div>`;
        return;
    }

    conversations.forEach(chat=>{
        const button=document.createElement("button");
        button.className="chat-history-item";

        if(chat.id===currentChatId)button.classList.add("active");

        const title=document.createElement("div");
        title.className="chat-history-title";
        title.textContent=chat.title||"New conversation";

        const date=document.createElement("div");
        date.className="chat-history-date";
        date.textContent=formatChatDate(chat.updatedAt);

        button.appendChild(title);
        button.appendChild(date);

        button.addEventListener("click",()=>openChat(chat.id));

        chatHistoryList.appendChild(button);
    });
}

function formatChatDate(dateString){
    if(!dateString)return "";

    const date=new Date(dateString);

    return date.toLocaleDateString(undefined,{
        day:"numeric",
        month:"short"
    });
}

function addMessage(text,type){
    const message=document.createElement("div");
    message.className=`message ${type}`;

    if(type==="bot"){
        const avatar=document.createElement("div");
        avatar.className="avatar";
        avatar.textContent="M";

        const bubble=document.createElement("div");
        bubble.className="bubble";
        bubble.textContent=text;

        message.appendChild(avatar);
        message.appendChild(bubble);
    }else{
        const bubble=document.createElement("div");
        bubble.className="bubble";
        bubble.textContent=text;

        message.appendChild(bubble);
    }

    messagesElement.appendChild(message);
    messagesElement.scrollTop=messagesElement.scrollHeight;
}

function setLoading(loading){
    sendButton.disabled=loading;
    input.disabled=loading;
    sendButton.textContent=loading?"...":"↗";
}

function updateDraft(draft,shouldSave=true){
    currentDraft=draft;

    if(!draft){
        draftTo.value="";
        draftSubject.value="";
        draftMessage.value="";
        draftStatus.textContent="EMPTY";
        draftStatus.classList.remove("ready");
        draftInfo.textContent="Ask the AI to create an email.";
        sendEmailButton.disabled=true;
        sendEmailButton.textContent="Send Email ↗";

        if(shouldSave)saveCurrentChat();

        return;
    }

    draftTo.value=(draft.to||[]).join(", ");
    draftSubject.value=draft.subject||"";
    draftMessage.value=draft.message||"";

    const hasRecipient=(draft.to||[]).length>0;
    const hasSubject=Boolean(draft.subject);
    const hasMessage=Boolean(draft.message);

    if(hasRecipient&&hasSubject&&hasMessage){
        draftStatus.textContent=currentScheduledAt?"SCHEDULE":"READY";
        draftStatus.classList.add("ready");
        draftInfo.textContent=currentScheduledAt
            ?`Review the email before scheduling for ${new Date(currentScheduledAt).toLocaleString()}.`
            :"Review the email before sending.";
        sendEmailButton.disabled=false;
    }else{
        draftStatus.textContent="INCOMPLETE";
        draftStatus.classList.remove("ready");
        draftInfo.textContent="Some email information is still missing.";
        sendEmailButton.disabled=true;
    }

    updateScheduleUI();

    if(shouldSave)saveCurrentChat();
}

function updateScheduleUI(){
    if(currentScheduledAt){
        sendEmailButton.textContent="Schedule Email ↗";
    }else{
        sendEmailButton.textContent="Send Email ↗";
    }
}

function getCurrentDraft(){
    const recipients=draftTo.value.split(",").map(email=>email.trim()).filter(email=>email);

    return {
        to:recipients,
        subject:draftSubject.value.trim(),
        message:draftMessage.value.trim()
    };
}

async function findScheduledMails(scheduledDate=null,scheduledTime=null,cancelTo=[]){
    const response=await fetch(`${API_URL}/mail/scheduled`);
    const data=await response.json();

    if(!response.ok||!data.success){
        throw new Error(data.error||"Could not load scheduled emails.");
    }

    let matches=data.scheduledMails;

    if(scheduledDate){
        matches=matches.filter(mail=>{
            const date=new Date(mail.scheduledAt).toLocaleDateString("en-CA",{
                timeZone:"Asia/Kolkata"
            });

            return date===scheduledDate;
        });
    }

    if(scheduledTime){
        matches=matches.filter(mail=>{
            const time=new Date(mail.scheduledAt).toLocaleTimeString("en-GB",{
                timeZone:"Asia/Kolkata",
                hour:"2-digit",
                minute:"2-digit",
                hour12:false
            });

            return time===scheduledTime;
        });
    }

    if(cancelTo.length>0){
        matches=matches.filter(mail=>{
            return cancelTo.some(email=>{
                return mail.to.some(recipient=>{
                    return recipient.toLowerCase()===email.toLowerCase();
                });
            });
        });
    }

    return matches;
}

async function deleteScheduledMails(mails){
    const cancelled=[];

    for(const mail of mails){
        const response=await fetch(
            `${API_URL}/mail/scheduled/${mail.id}`,
            {
                method:"DELETE"
            }
        );

        const data=await response.json();

        if(!response.ok||!data.success){
            throw new Error(
                data.error||`Could not cancel scheduled email ${mail.id}.`
            );
        }

        cancelled.push(mail);
    }

    return cancelled;
}

function formatCancellationDate(date){
    if(!date)return "the selected date";

    return new Date(`${date}T00:00:00`).toLocaleDateString("en-IN",{
        day:"numeric",
        month:"long",
        year:"numeric"
    });
}

function formatCancellationTime(time){
    if(!time)return "";

    const [hour,minute]=time.split(":").map(Number);
    const date=new Date();

    date.setHours(hour,minute,0,0);

    return date.toLocaleTimeString("en-IN",{
        hour:"numeric",
        minute:"2-digit"
    });
}

async function handleCancellationRequest(data){
    const scheduledDate=data.scheduledDate||null;
    const scheduledTime=data.scheduledTime||null;
    const cancelTo=data.cancelTo||[];

    const matches=await findScheduledMails(
        scheduledDate,
        scheduledTime,
        cancelTo
    );

    if(matches.length===0){
        const errorMessage="I couldn't find any scheduled emails matching your request.";

        addMessage(errorMessage,"bot");

        conversation.push({
            role:"assistant",
            content:errorMessage
        });

        saveCurrentChat();

        return;
    }

    pendingCancellation={
        mails:matches,
        scheduledDate,
        scheduledTime,
        cancelTo
    };

    let message=`I found ${matches.length} scheduled email${matches.length===1?"":"s"} matching your request.\n\n`;

    matches.forEach((mail,index)=>{
        const date=new Date(mail.scheduledAt).toLocaleString("en-IN",{
            timeZone:"Asia/Kolkata",
            day:"numeric",
            month:"short",
            hour:"numeric",
            minute:"2-digit"
        });

        message+=`${index+1}. ${date} — ${mail.to.join(", ")} — ${mail.subject}\n`;
    });

    message+="\nDo you want me to cancel all of them?";

    addMessage(message,"bot");

    conversation.push({
        role:"assistant",
        content:message
    });

    saveCurrentChat();
}

async function handleCancellationConfirmation(text){
    const answer=text.trim().toLowerCase();

    const yesAnswers=[
        "yes",
        "yes please",
        "yeah",
        "yep",
        "yup",
        "sure",
        "do it",
        "go ahead",
        "cancel them",
        "cancel all",
        "confirm",
        "ok",
        "okay"
    ];

    const noAnswers=[
        "no",
        "no thanks",
        "nope",
        "don't",
        "do not",
        "cancel",
        "stop",
        "leave them",
        "keep them"
    ];

    if(yesAnswers.includes(answer)){
        const mails=pendingCancellation.mails;

        try{
            const cancelled=await deleteScheduledMails(mails);

            const message=cancelled.length===1
                ?"I have cancelled the scheduled email. ✅"
                :`I have cancelled ${cancelled.length} scheduled emails. ✅`;

            addMessage(message,"bot");

            conversation.push({
                role:"assistant",
                content:message
            });

            pendingCancellation=null;
            saveCurrentChat();
        }catch(error){
            console.error("Cancellation error:",error);

            const message=`I couldn't cancel the scheduled emails: ${error.message}`;

            addMessage(message,"bot");

            conversation.push({
                role:"assistant",
                content:message
            });

            pendingCancellation=null;
            saveCurrentChat();
        }

        return true;
    }

    if(noAnswers.includes(answer)){
        const message="Okay, I won't cancel them. Nothing was deleted.";

        addMessage(message,"bot");

        conversation.push({
            role:"assistant",
            content:message
        });

        pendingCancellation=null;
        saveCurrentChat();

        return true;
    }

    return false;
}

async function sendMessage(){
    const text=input.value.trim();

    if(!text)return;

    if(!currentChatId)createNewChat();

    addMessage(text,"user");

    conversation.push({
        role:"user",
        content:text
    });

    saveCurrentChat();

    input.value="";

    if(pendingCancellation){
        setLoading(true);

        try{
            const handled=await handleCancellationConfirmation(text);

            if(handled){
                return;
            }

            const message="Please reply with Yes to cancel the listed emails or No to keep them.";

            addMessage(message,"bot");

            conversation.push({
                role:"assistant",
                content:message
            });

            saveCurrentChat();
        }finally{
            setLoading(false);
            input.focus();
        }

        return;
    }

    setLoading(true);

    try{
        const response=await fetch(`${API_URL}/ai/chat`,{
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify({
                messages:conversation,
                currentDraft:currentDraft
            })
        });

        const data=await response.json();

        if(!response.ok||!data.success){
            throw new Error(data.error||"AI request failed.");
        }

        addMessage(data.reply,"bot");

        conversation.push({
            role:"assistant",
            content:data.reply
        });

        if(data.type==="cancel"){
            await handleCancellationRequest(data);
            return;
        }

        if(data.draft){
            updateDraft(data.draft,false);
        }else{
            updateDraft(currentDraft,false);
        }

        currentScheduledAt=data.type==="schedule"&&data.scheduledAt
            ?data.scheduledAt
            :null;

        updateDraft(currentDraft,false);
        saveCurrentChat();
    }catch(error){
        console.error("AI error:",error);

        addMessage(
            "Sorry, I couldn't process that request right now. Please try again.",
            "bot"
        );
    }finally{
        setLoading(false);
        input.focus();
    }
}

async function sendEmail(){
    const draft=getCurrentDraft();

    if(!draft.to.length||!draft.subject||!draft.message){
        alert("Please complete the email before sending.");
        return;
    }

    const isScheduled=Boolean(currentScheduledAt);
    const action=isScheduled?"Schedule this email":"Send this email";

    const confirmed=confirm(`${action} to ${draft.to.join(", ")}?`);

    if(!confirmed)return;

    sendEmailButton.disabled=true;
    sendEmailButton.textContent=isScheduled?"Scheduling...":"Sending...";

    try{
        const endpoint=isScheduled
            ?`${API_URL}/mail/schedule`
            :`${API_URL}/mail/send`;

        const body={
            to:draft.to,
            subject:draft.subject,
            message:draft.message
        };

        if(isScheduled)body.scheduledAt=currentScheduledAt;

        const response=await fetch(endpoint,{
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify(body)
        });

        const data=await response.json();

        if(!response.ok||!data.success){
            throw new Error(data.error||"Email could not be processed.");
        }

        const successMessage=isScheduled
            ?`Email scheduled successfully for ${new Date(currentScheduledAt).toLocaleString()}. ✅`
            :`Email sent successfully to ${draft.to.join(", ")}. ✅`;

        addMessage(successMessage,"bot");

        conversation.push({
            role:"assistant",
            content:successMessage
        });

        draftStatus.textContent=isScheduled?"SCHEDULED":"SENT";
        draftStatus.classList.add("ready");

        draftInfo.textContent=isScheduled
            ?"Email is scheduled successfully."
            :"Email successfully sent and saved to history.";

        sendEmailButton.textContent=isScheduled?"Scheduled ✓":"Sent ✓";

        currentDraft=null;
        currentScheduledAt=null;

        saveCurrentChat();
    }catch(error){
        console.error("Email action error:",error);

        addMessage(
            `I couldn't process the email: ${error.message}`,
            "bot"
        );

        sendEmailButton.disabled=false;
        updateScheduleUI();
    }
}

function sendSuggestion(text){
    input.value=text;
    sendMessage();
}

function handleKey(event){
    if(event.key==="Enter"){
        event.preventDefault();
        sendMessage();
    }
}

function handleDraftChange(){
    currentDraft=getCurrentDraft();

    const valid=currentDraft.to.length>0&&currentDraft.subject&&currentDraft.message;

    sendEmailButton.disabled=!valid;

    if(valid){
        draftStatus.textContent=currentScheduledAt?"SCHEDULE":"READY";
        draftStatus.classList.add("ready");
        draftInfo.textContent=currentScheduledAt
            ?`Review the email before scheduling for ${new Date(currentScheduledAt).toLocaleString()}.`
            :"Review the email before sending.";
    }else{
        draftStatus.textContent="EDITING";
        draftStatus.classList.remove("ready");
    }

    saveCurrentChat();
}

draftTo.addEventListener("input",handleDraftChange);
draftSubject.addEventListener("input",handleDraftChange);
draftMessage.addEventListener("input",handleDraftChange);

newChatButton.addEventListener("click",()=>{
    createNewChat();
    input.focus();
});

loadAllConversations();