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
- Do NOT simply say that the email was cancelled.
- Identify the date and time of the scheduled email the user wants to cancel.
- Convert the cancellation date into YYYY-MM-DD.
- Convert the cancellation time into HH:mm.
- If the user mentions a recipient email, return it in cancelTo.
- If the user says "tomorrow at 9 AM", calculate tomorrow using the CURRENT DATE above.
- If the user does not provide enough information to identify the scheduled email, ask a question and keep scheduledAt null.
- The application will perform the actual cancellation.

CANCELLATION EXAMPLES:
- "Cancel the mail that needs to be sent tomorrow 9 AM" means type "cancel", scheduledDate should be tomorrow's date and scheduledTime should be "09:00".
- "Cancel the email scheduled for October 10 at 4 PM" means type "cancel", scheduledDate should be "2026-10-10" and scheduledTime should be "16:00".
- "Cancel the mail to gsingamp@gmail.com tomorrow at 9 AM" means type "cancel", scheduledDate should be tomorrow's date, scheduledTime should be "09:00", and cancelTo should contain "gsingamp@gmail.com".

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