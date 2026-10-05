const express=require("express");
const cors=require("cors");
const path=require("path");

require("dotenv").config({
    path:path.resolve(__dirname,"../../../.env")
});

const mailRoutes=require("./routes/mailRoutes");
const {chatWithAgent}=require("./services/geminiService");
const {startScheduler}=require("./services/scheduledMailService");
const {getAuthUrl,handleCallback}=require("./services/gmailService");

const app=express();
const PORT=process.env.PORT||5001;

app.use(cors());
app.use(express.json());

app.get("/",(req,res)=>{
    res.json({
        message:"Mail Service is running"
    });
});

app.get("/auth/google",(req,res)=>{
    const authUrl=getAuthUrl();
    res.redirect(authUrl);
});

app.get("/auth/google/callback",async(req,res)=>{
    try{
        const {code}=req.query;

        if(!code){
            return res.status(400).send("Authorization code is missing.");
        }

        await handleCallback(code);

        res.send(`
            <html>
                <body style="font-family:Arial;text-align:center;padding:60px;">
                    <h2>Gmail connected successfully.</h2>
                    <p>You can close this window and return to My-Agent.</p>
                </body>
            </html>
        `);
    }catch(error){
        console.error("Gmail OAuth error:",error);

        res.status(500).send(`
            <html>
                <body style="font-family:Arial;text-align:center;padding:60px;">
                    <h2>Gmail connection failed.</h2>
                    <p>${error.message}</p>
                </body>
            </html>
        `);
    }
});

app.use("/mail",mailRoutes);

app.post("/ai/chat",async(req,res)=>{
    try{
        const messages=req.body?.messages||[];
        const currentDraft=req.body?.currentDraft||null;

        const result=await chatWithAgent(messages,currentDraft);

        res.json({
            success:true,
            ...result
        });
    }catch(error){
        console.error("AI chat error:",error);

        res.status(500).json({
            success:false,
            error:error.message
        });
    }
});

app.listen(PORT,()=>{
    console.log(`Mail Service running on http://localhost:${PORT}`);
    startScheduler();
});