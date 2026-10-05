const path=require("path");
require("dotenv").config({path:path.resolve(__dirname,"../../../../.env")});

const {GoogleGenAI}=require("@google/genai");
const userProfile=require("../../data/userProfile");

if(!process.env.GEMINI_API_KEY){
    throw new Error("GEMINI_API_KEY is missing from .env");
}

const ai=new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY});
const MODEL="gemini-3.5-flash-lite";

function getRelativeMinutes(text){
    const match=text.match(/(?:in|after)\s+(\d+)\s+minutes?/i);
    return match?parseInt(match[1],10):null;
}

function getISTISOString(minutes){
    const date=new Date(Date.now()+minutes*60*1000+330*60*1000);
    return date.toISOString().replace("Z","+05:30");
}

function getISTISOStringFromParts(dateText,timeText){
    if(!dateText||!timeText)return null;

    const dateMatch=dateText.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const timeMatch=timeText.match(/^(\d{1,2}):(\d{2})$/);

    if(!dateMatch||!timeMatch)return null;

    const year=parseInt(dateMatch[1],10);
    const month=parseInt(dateMatch[2],10);
    const day=parseInt(dateMatch[3],10);
    const hour=parseInt(timeMatch[1],10);
    const minute=parseInt(timeMatch[2],10);

    if(month<1||month>12||day<1||day>31||hour<0||hour>23||minute<0||minute>59){
        return null;
    }

    const date=new Date(Date.UTC(year,month-1,day,hour,minute));

    if(
        date.getUTCFullYear()!==year||
        date.getUTCMonth()+1!==month||
        date.getUTCDate()!==day||
        date.getUTCHours()!==hour||
        date.getUTCMinutes()!==minute
    ){
        return null;
    }

    return date.toISOString().replace("Z","+05:30");
}

async function chatWithAgent(messages,currentDraft=null){
    const conversation=(messages||[]).map(message=>{
        const role=message.role==="assistant"?"ASSISTANT":"USER";
        return `${role}: ${message.content}`;
    }).join("\n\n");

    const draftText=currentDraft?JSON.stringify(currentDraft,null,2):"No current draft.";

    const latestUserMessage=[...(messages||[])]
        .reverse()
        .find(message=>message.role==="user")?.content||"";

    const relativeMinutes=getRelativeMinutes(latestUserMessage);

    const now=new Date();

    const currentDateTime=now.toLocaleString("en-IN",{
        timeZone:"Asia/Kolkata",
        dateStyle:"full",
        timeStyle:"long"
    });

    const currentDate=now.toLocaleDateString("en-CA",{
        timeZone:"Asia/Kolkata"
    });

    const prompt=`
You are My-Agent, an AI email assistant.

CURRENT DATE AND TIME:
India Standard Time: ${currentDateTime}
Current date in India: ${currentDate}
Timezone: Asia/Kolkata

Your job is to understand what the user wants and help them create, schedule, or cancel emails.

SENDER PROFILE:
Name: ${userProfile.name}
Admission Number: ${userProfile.admissionNumber}
Branch: ${userProfile.branch}
Phone: ${userProfile.phone||"Not provided"}

SENDER RULES:
- Never ask for the sender's name, admission number, branch or phone.
- Use the sender profile automatically when creating the email signature.
- Do not use placeholders when information is already available.

EMAIL RULES:
- Understand natural language requests.
- If the user wants an email but the recipient email is missing, ask for it.
- If the recipient email is already available, do not ask again.
- Infer a suitable subject.
- Write a professional email body.
- Ask only for information that is genuinely necessary.
- If the user is simply greeting or asking a general question, answer naturally and do not create a draft.
- If the user asks to modify an existing draft, modify the current draft.
- Never send or schedule an email yourself. The application performs these actions after user confirmation.
- If enough information is available to create an email, return a complete draft.
- If information is missing, return a question and keep draft null.

SCHEDULING RULES:
- If the user asks to schedule, send later, send tomorrow, send at a specific time, or gives a future date/time, set type to "schedule".
- Understand natural language dates such as:
  "tomorrow at 9 AM"
  "October 10 at 4 PM"
  "December 25 at 10:30 AM"
  "next Monday at 9 AM"
- Convert requested dates into YYYY-MM-DD.
- Convert requested times into HH:mm.
- Use Asia/Kolkata.
- For "2 minutes from now", set type to "schedule". The application calculates the exact time.
- If the date or time is missing, ask for it and keep scheduledAt null.
- Never schedule without enough date and time information.
- The user must confirm before scheduling.

CANCELLATION RULES:
- If the user asks to cancel, delete, remove, stop, or unschedule a previously scheduled email, set type to "cancel".
- Cancellation can target one email or multiple emails.
- Identify whatever filters the user provides.
- The available cancellation filters are:
  1. scheduledDate
  2. scheduledTime
  3. cancelTo
- If the user gives a date but no time, return the date and set scheduledTime to null. This means all scheduled emails on that date may be cancelled.
- If the user gives a date and time, return both scheduledDate and scheduledTime. This means emails matching that date and time may be cancelled.
- If the user gives a recipient, return that email in cancelTo.
- If the user says "cancel all scheduled emails", set type to "cancel" and leave scheduledDate, scheduledTime and cancelTo empty.
- If the user says "cancel all emails tomorrow", return tomorrow's date and leave scheduledTime empty.
- If the user says "cancel all emails tomorrow at 9 AM", return tomorrow's date and "09:00".
- If the user says "cancel all emails scheduled for October 10", return "2026-10-10" and leave scheduledTime empty.
- If the user does not provide enough information to identify what should be cancelled, ask a question.
- Do NOT claim that the emails have already been cancelled.
- The application will perform the actual cancellation.

CANCELLATION EXAMPLES:
- "Cancel the mail that needs to be sent tomorrow 9 AM"
  → type: "cancel"
  → scheduledDate: tomorrow's date
  → scheduledTime: "09:00"
  → cancelTo: []

- "Cancel the emails scheduled tomorrow"
  → type: "cancel"
  → scheduledDate: tomorrow's date
  → scheduledTime: null
  → cancelTo: []

- "Cancel all emails scheduled tomorrow at 9 AM"
  → type: "cancel"
  → scheduledDate: tomorrow's date
  → scheduledTime: "09:00"
  → cancelTo: []

- "Cancel the mail to gsingamp@gmail.com tomorrow"
  → type: "cancel"
  → scheduledDate: tomorrow's date
  → scheduledTime: null
  → cancelTo: ["gsingamp@gmail.com"]

- "Cancel the mail to gsingamp@gmail.com tomorrow at 9 AM"
  → type: "cancel"
  → scheduledDate: tomorrow's date
  → scheduledTime: "09:00"
  → cancelTo: ["gsingamp@gmail.com"]

- "Cancel all scheduled emails"
  → type: "cancel"
  → scheduledDate: null
  → scheduledTime: null
  → cancelTo: []

- "Cancel the email scheduled for October 10 at 4 PM"
  → type: "cancel"
  → scheduledDate: "2026-10-10"
  → scheduledTime: "16:00"
  → cancelTo: []

- "Cancel all emails scheduled for October 10"
  → type: "cancel"
  → scheduledDate: "2026-10-10"
  → scheduledTime: null
  → cancelTo: []

CURRENT DRAFT:
${draftText}

CONVERSATION:
${conversation}

Return ONLY valid JSON matching the required schema.
`;

    const response=await ai.models.generateContent({
        model:MODEL,
        contents:prompt,
        config:{
            responseMimeType:"application/json",
            responseSchema:{
                type:"object",
                properties:{
                    reply:{type:"string"},
                    needsMoreInfo:{type:"boolean"},
                    type:{
                        type:"string",
                        enum:["email","schedule","cancel","none"]
                    },
                    scheduledAt:{
                        type:"string",
                        nullable:true
                    },
                    scheduledDate:{
                        type:"string",
                        nullable:true
                    },
                    scheduledTime:{
                        type:"string",
                        nullable:true
                    },
                    cancelTo:{
                        type:"array",
                        items:{type:"string"}
                    },
                    draft:{
                        type:"object",
                        nullable:true,
                        properties:{
                            to:{
                                type:"array",
                                items:{type:"string"}
                            },
                            subject:{type:"string"},
                            message:{type:"string"}
                        },
                        required:["to","subject","message"]
                    }
                },
                required:[
                    "reply",
                    "needsMoreInfo",
                    "type",
                    "scheduledAt",
                    "scheduledDate",
                    "scheduledTime",
                    "cancelTo",
                    "draft"
                ]
            }
        }
    });

    try{
        const result=JSON.parse(response.text);

        if(
            (result.type==="schedule"||result.type==="cancel")&&
            result.scheduledDate&&
            result.scheduledTime
        ){
            result.scheduledAt=getISTISOStringFromParts(
                result.scheduledDate,
                result.scheduledTime
            );
        }

        if(result.type==="schedule"&&relativeMinutes!==null){
            result.scheduledAt=getISTISOString(relativeMinutes);
        }

        return result;
    }catch(error){
        console.error("Gemini JSON error:",response.text);
        throw new Error("Gemini returned an invalid response.");
    }
}

async function generateEmail(prompt){
    return await chatWithAgent([
        {
            role:"user",
            content:prompt
        }
    ]);
}

module.exports={
    generateEmail,
    chatWithAgent
};