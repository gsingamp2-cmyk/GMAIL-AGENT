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


let conversations=[];
let currentChatId=null;

let conversation=[];
let currentDraft=null;


/* =========================================
   CREATE CHAT ID
========================================= */

function createChatId(){

    return Date.now().toString()+"-"+Math.random()
        .toString(36)
        .substring(2,8);

}


/* =========================================
   CREATE CHAT TITLE
========================================= */

function createChatTitle(){

    const firstUserMessage=conversation.find(
        message=>message.role==="user"
    );

    if(!firstUserMessage){
        return "New conversation";
    }

    let title=firstUserMessage.content.trim();

    if(title.length>35){
        title=title.substring(0,35)+"...";
    }

    return title;

}


/* =========================================
   SAVE ALL CONVERSATIONS
========================================= */

function saveAllConversations(){

    localStorage.setItem(
        CHAT_STORAGE_KEY,
        JSON.stringify(conversations)
    );

}


/* =========================================
   GET CURRENT CHAT
========================================= */

function getCurrentChat(){

    return conversations.find(
        chat=>chat.id===currentChatId
    );

}


/* =========================================
   SAVE CURRENT CHAT
========================================= */

function saveCurrentChat(){

    if(!currentChatId){
        return;
    }

    const chat=getCurrentChat();

    if(!chat){
        return;
    }

    chat.messages=conversation;
    chat.draft=currentDraft;

    chat.title=createChatTitle();

    chat.updatedAt=new Date().toISOString();

    saveAllConversations();

    renderChatHistory();

}


/* =========================================
   CREATE NEW CHAT
========================================= */

function createNewChat(){

    const newChat={
        id:createChatId(),

        title:"New conversation",

        messages:[],

        draft:null,

        createdAt:new Date().toISOString(),

        updatedAt:new Date().toISOString()
    };

    conversations.unshift(newChat);

    currentChatId=newChat.id;

    conversation=[];

    currentDraft=null;

    saveAllConversations();

    clearChatScreen();

    renderChatHistory();

}


/* =========================================
   LOAD CHAT HISTORY
========================================= */

function loadAllConversations(){

    const saved=localStorage.getItem(CHAT_STORAGE_KEY);

    if(saved){

        try{

            conversations=JSON.parse(saved);

        }catch(error){

            console.error(
                "Could not load conversations:",
                error
            );

            conversations=[];

        }

    }


    /*
    -----------------------------------------
    Migrate old single-chat storage
    -----------------------------------------
    */

    if(conversations.length===0){

        const oldSaved=localStorage.getItem(
            OLD_CHAT_STORAGE_KEY
        );

        if(oldSaved){

            try{

                const oldData=JSON.parse(oldSaved);

                if(
                    oldData.conversation &&
                    oldData.conversation.length>0
                ){

                    const migratedChat={
                        id:createChatId(),

                        title:"Previous conversation",

                        messages:oldData.conversation,

                        draft:oldData.currentDraft||null,

                        createdAt:new Date().toISOString(),

                        updatedAt:new Date().toISOString()
                    };

                    conversations.push(
                        migratedChat
                    );

                    saveAllConversations();

                }

            }catch(error){

                console.error(
                    "Could not migrate old chat:",
                    error
                );

            }

        }

    }


    /*
    -----------------------------------------
    Open latest chat
    -----------------------------------------
    */

    if(conversations.length>0){

        const latestChat=conversations[0];

        openChat(latestChat.id);

    }else{

        createNewChat();

    }

}


/* =========================================
   OPEN CHAT
========================================= */

function openChat(chatId){

    const chat=conversations.find(
        item=>item.id===chatId
    );

    if(!chat){
        return;
    }

    currentChatId=chat.id;

    conversation=chat.messages||[];

    currentDraft=chat.draft||null;

    messagesElement.innerHTML="";


    /*
    -----------------------------------------
    Show greeting for empty chat
    -----------------------------------------
    */

    if(conversation.length===0){

        addMessage(
            "Hi! 👋 Tell me what email you want to send and I'll prepare the draft for you.",
            "bot"
        );

    }else{

        conversation.forEach(message=>{

            addMessage(
                message.content,
                message.role==="assistant"
                    ?"bot"
                    :"user"
            );

        });

    }


    updateDraft(currentDraft,false);

    renderChatHistory();

}


/* =========================================
   CLEAR CHAT SCREEN
========================================= */

function clearChatScreen(){

    messagesElement.innerHTML="";

    addMessage(
        "Hi! 👋 Tell me what email you want to send and I'll prepare the draft for you.",
        "bot"
    );

    updateDraft(null,false);

}


/* =========================================
   RENDER CHAT HISTORY
========================================= */

function renderChatHistory(){

    chatHistoryList.innerHTML="";


    if(conversations.length===0){

        chatHistoryList.innerHTML=`
            <div class="empty-history">
                No conversations yet.
            </div>
        `;

        return;

    }


    conversations.forEach(chat=>{

        const button=document.createElement("button");

        button.className="chat-history-item";

        if(chat.id===currentChatId){

            button.classList.add("active");

        }


        const title=document.createElement("div");

        title.className="chat-history-title";

        title.textContent=chat.title||"New conversation";


        const date=document.createElement("div");

        date.className="chat-history-date";

        date.textContent=formatChatDate(
            chat.updatedAt
        );


        button.appendChild(title);

        button.appendChild(date);


        button.addEventListener(
            "click",
            ()=>{
                openChat(chat.id);
            }
        );


        chatHistoryList.appendChild(button);

    });

}


/* =========================================
   FORMAT CHAT DATE
========================================= */

function formatChatDate(dateString){

    if(!dateString){
        return "";
    }

    const date=new Date(dateString);

    return date.toLocaleDateString(
        undefined,
        {
            day:"numeric",
            month:"short"
        }
    );

}


/* =========================================
   ADD MESSAGE
========================================= */

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

    messagesElement.scrollTop=
        messagesElement.scrollHeight;

}


/* =========================================
   LOADING
========================================= */

function setLoading(loading){

    sendButton.disabled=loading;

    input.disabled=loading;


    if(loading){

        sendButton.textContent="...";

    }else{

        sendButton.textContent="↗";

    }

}


/* =========================================
   UPDATE DRAFT
========================================= */

function updateDraft(draft,shouldSave=true){

    currentDraft=draft;


    if(!draft){

        draftTo.value="";
        draftSubject.value="";
        draftMessage.value="";

        draftStatus.textContent="EMPTY";

        draftStatus.classList.remove("ready");

        draftInfo.textContent=
            "Ask the AI to create an email.";

        sendEmailButton.disabled=true;


        if(shouldSave){

            saveCurrentChat();

        }

        return;

    }


    draftTo.value=
        (draft.to||[]).join(", ");

    draftSubject.value=
        draft.subject||"";

    draftMessage.value=
        draft.message||"";


    const hasRecipient=
        (draft.to||[]).length>0;

    const hasSubject=
        Boolean(draft.subject);

    const hasMessage=
        Boolean(draft.message);


    if(
        hasRecipient &&
        hasSubject &&
        hasMessage
    ){

        draftStatus.textContent="READY";

        draftStatus.classList.add("ready");

        draftInfo.textContent=
            "Review the email before sending.";

        sendEmailButton.disabled=false;

    }else{

        draftStatus.textContent="INCOMPLETE";

        draftStatus.classList.remove("ready");

        draftInfo.textContent=
            "Some email information is still missing.";

        sendEmailButton.disabled=true;

    }


    if(shouldSave){

        saveCurrentChat();

    }

}


/* =========================================
   GET CURRENT DRAFT
========================================= */

function getCurrentDraft(){

    const recipients=draftTo.value
        .split(",")
        .map(email=>email.trim())
        .filter(email=>email);


    return{

        to:recipients,

        subject:
            draftSubject.value.trim(),

        message:
            draftMessage.value.trim()

    };

}


/* =========================================
   SEND CHAT MESSAGE
========================================= */

async function sendMessage(){

    const text=input.value.trim();


    if(!text){

        return;

    }


    /*
    -----------------------------------------
    If somehow no chat exists, create one
    -----------------------------------------
    */

    if(!currentChatId){

        createNewChat();

    }


    addMessage(
        text,
        "user"
    );


    conversation.push({

        role:"user",

        content:text

    });


    saveCurrentChat();


    input.value="";

    setLoading(true);


    try{

        const response=await fetch(
            "http://localhost:5001/ai/chat",
            {
                method:"POST",

                headers:{
                    "Content-Type":
                        "application/json"
                },

                body:JSON.stringify({

                    messages:conversation,

                    currentDraft:currentDraft

                })

            }
        );


        const data=await response.json();


        if(
            !response.ok ||
            !data.success
        ){

            throw new Error(
                data.error||
                "AI request failed."
            );

        }


        addMessage(
            data.reply,
            "bot"
        );


        conversation.push({

            role:"assistant",

            content:data.reply

        });


        if(data.draft){

            updateDraft(
                data.draft,
                false
            );

        }else{

            updateDraft(
                currentDraft,
                false
            );

        }


        saveCurrentChat();


    }catch(error){

        console.error(
            "AI error:",
            error
        );


        addMessage(
            "Sorry, I couldn't process that request right now. Please try again.",
            "bot"
        );


    }finally{

        setLoading(false);

        input.focus();

    }

}


/* =========================================
   SEND EMAIL
========================================= */

async function sendEmail(){

    const draft=getCurrentDraft();


    if(
        !draft.to.length ||
        !draft.subject ||
        !draft.message
    ){

        alert(
            "Please complete the email before sending."
        );

        return;

    }


    const confirmed=confirm(
        `Send this email to ${draft.to.join(", ")}?`
    );


    if(!confirmed){

        return;

    }


    sendEmailButton.disabled=true;

    sendEmailButton.textContent=
        "Sending...";


    try{

        const response=await fetch(
            "http://localhost:5001/mail/send",
            {
                method:"POST",

                headers:{
                    "Content-Type":
                        "application/json"
                },

                body:JSON.stringify({

                    to:draft.to,

                    subject:draft.subject,

                    message:draft.message

                })

            }
        );


        const data=await response.json();


        if(
            !response.ok ||
            !data.success
        ){

            throw new Error(
                data.error||
                "Email could not be sent."
            );

        }


        addMessage(
            `Email sent successfully to ${draft.to.join(", ")}. ✅`,
            "bot"
        );


        conversation.push({

            role:"assistant",

            content:
                `Email sent successfully to ${draft.to.join(", ")}. ✅`

        });


        draftStatus.textContent="SENT";

        draftStatus.classList.add(
            "ready"
        );

        draftInfo.textContent=
            "Email successfully sent and saved to history.";

        sendEmailButton.textContent=
            "Sent ✓";


        currentDraft=null;


        saveCurrentChat();


    }catch(error){

        console.error(
            "Send email error:",
            error
        );


        addMessage(
            `I couldn't send the email: ${error.message}`,
            "bot"
        );


        sendEmailButton.disabled=false;

        sendEmailButton.textContent=
            "Send Email ↗";

    }

}


/* =========================================
   SUGGESTION
========================================= */

function sendSuggestion(text){

    input.value=text;

    sendMessage();

}


/* =========================================
   ENTER KEY
========================================= */

function handleKey(event){

    if(event.key==="Enter"){

        event.preventDefault();

        sendMessage();

    }

}


/* =========================================
   DRAFT FIELD CHANGES
========================================= */

function handleDraftChange(){

    currentDraft=getCurrentDraft();


    const valid=
        currentDraft.to.length>0 &&
        currentDraft.subject &&
        currentDraft.message;


    sendEmailButton.disabled=!valid;


    if(valid){

        draftStatus.textContent="READY";

        draftStatus.classList.add("ready");

        draftInfo.textContent=
            "Review the email before sending.";

    }else{

        draftStatus.textContent="EDITING";

        draftStatus.classList.remove("ready");

    }


    saveCurrentChat();

}


draftTo.addEventListener(
    "input",
    handleDraftChange
);

draftSubject.addEventListener(
    "input",
    handleDraftChange
);

draftMessage.addEventListener(
    "input",
    handleDraftChange
);


/* =========================================
   NEW CHAT BUTTON
========================================= */

newChatButton.addEventListener(
    "click",
    ()=>{
        createNewChat();
        input.focus();
    }
);


/* =========================================
   START APPLICATION
========================================= */

loadAllConversations();