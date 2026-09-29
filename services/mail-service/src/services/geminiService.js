const path=require("path");
require("dotenv").config({
    path:path.resolve(__dirname,"../../../../.env")
});

const {GoogleGenAI}=require("@google/genai");
const userProfile=require("../../data/userProfile");

if(!process.env.GEMINI_API_KEY){
    throw new Error("GEMINI_API_KEY is missing from .env");
}

const ai=new GoogleGenAI({
    apiKey:process.env.GEMINI_API_KEY
});

const MODEL="gemini-3.5-flash-lite";

async function chatWithAgent(messages,currentDraft=null){
    const conversation=(messages||[]).map(message=>{
        const role=message.role==="assistant"?"ASSISTANT":"USER";
        return `${role}: ${message.content}`;
    }).join("\n\n");

    const draftText=currentDraft
        ? JSON.stringify(currentDraft,null,2)
        : "No current draft.";

    const prompt=`
You are My-Agent, an AI email assistant.

Your job is to understand what the user wants and help them create and send emails.

SENDER PROFILE:
Name: ${userProfile.name}
Admission Number: ${userProfile.admissionNumber}
Branch: ${userProfile.branch}
Phone: ${userProfile.phone||"Not provided"}

IMPORTANT SENDER RULES:
- Never ask for the sender's name.
- Never ask for the sender's admission number.
- Never ask for the sender's branch.
- Never ask for information already available in the sender profile.
- Use the sender profile automatically when creating the email signature.
- Do not use placeholders when information is already available.

EMAIL RULES:
- Understand natural language requests.
- The user may say things like "write a mail", "send a mail", "request my professor", "thank my professor", "ask for leave", etc.
- If the user wants an email but the recipient email address is missing, ask for the recipient email address.
- If the recipient email address is already available, do not ask again.
- Infer a suitable subject from the request.
- Write a professional email body.
- Use the sender's name, admission number and branch in the signature when appropriate.
- Ask only for information that is genuinely necessary.
- Do not ask unnecessary questions.
- If the user is simply greeting or asking a general question, answer naturally and do not create a draft.
- If the user asks to modify an existing draft, modify the current draft instead of starting from scratch.
- Never send the email yourself. The application will send it only after the user presses the Send Email button.
- If enough information is available to create the email, return a complete draft.
- If information is missing, return a question and keep draft null.

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
                    reply:{
                        type:"string"
                    },
                    needsMoreInfo:{
                        type:"boolean"
                    },
                    draft:{
                        type:"object",
                        nullable:true,
                        properties:{
                            to:{
                                type:"array",
                                items:{
                                    type:"string"
                                }
                            },
                            subject:{
                                type:"string"
                            },
                            message:{
                                type:"string"
                            }
                        },
                        required:["to","subject","message"]
                    }
                },
                required:["reply","needsMoreInfo","draft"]
            }
        }
    });

    let result;

    try{
        result=JSON.parse(response.text);
    }catch(error){
        console.error("Gemini JSON error:",response.text);
        throw new Error("Gemini returned an invalid response.");
    }

    return result;
}

async function generateEmail(prompt){
    const result=await chatWithAgent([
        {
            role:"user",
            content:prompt
        }
    ]);

    return result;
}

module.exports={
    generateEmail,
    chatWithAgent
};