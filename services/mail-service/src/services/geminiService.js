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

async function chatWithAgent(messages,currentDraft=null){
    const conversation=(messages||[]).map(message=>{
        const role=message.role==="assistant"?"ASSISTANT":"USER";
        return `${role}: ${message.content}`;
    }).join("\n\n");

    const draftText=currentDraft?JSON.stringify(currentDraft,null,2):"No current draft.";
    const latestUserMessage=[...(messages||[])].reverse().find(message=>message.role==="user")?.content||"";
    const relativeMinutes=getRelativeMinutes(latestUserMessage);

    const now=new Date();
    const currentDateTime=now.toLocaleString("en-IN",{
        timeZone:"Asia/Kolkata",
        dateStyle:"full",
        timeStyle:"long"
    });

    const prompt=`
You are My-Agent, an AI email assistant.

CURRENT DATE AND TIME:
India Standard Time: ${currentDateTime}
Timezone: Asia/Kolkata

Your job is to understand what the user wants and help them create or schedule emails.

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
- For relative times, set type to "schedule".
- The application calculates relative times such as "2 minutes from now".
- If the scheduling date or time is missing, ask for it and keep scheduledAt null.
- Never schedule an email without enough date/time information.
- The user must confirm before the application schedules the email.

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
                        enum:["email","schedule","none"]
                    },
                    scheduledAt:{
                        type:"string",
                        nullable:true
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
                required:["reply","needsMoreInfo","type","scheduledAt","draft"]
            }
        }
    });

    try{
        const result=JSON.parse(response.text);

        if(relativeMinutes!==null&&result.type==="schedule"){
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