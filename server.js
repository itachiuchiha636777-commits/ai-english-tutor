require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));
// 1. MongoDB Connection
const MONGO_URI = process.env.MONGO_URI;
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.log("⚠️ MongoDB Error:", err.message));

// 2. MongoDB User & Chat Schema
const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, required: true },
  chats: [
    {
      id: Number,
      title: String,
      messages: [
        {
          sender: String,
          text: String,
          timestamp: { type: Date, default: Date.now },
        },
      ],
    },
  ],
});

const User = mongoose.model("User", UserSchema);

// 3. Google Gemini AI Setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
/*
const SYSTEM_PROMPT = `
                                                                                            You are a friendly, encouraging Indian AI English Speaking Coach.
                                                                                            Rules:
                                                                                            1. The user may speak in Hindi, Marwadi/Rajasthani (e.g., "Mharo naam...", "Mane English sikhni hai"), Hinglish, or broken English.
                                                                                            2. Understand their exact meaning and reply in this structured, short format:
                                                                                               ✅ Sahi English: "[Correct natural English sentence]"
                                                                                                  💡 Rule/Matlab: [1 short line in simple Hinglish explaining how to say it]
                                                                                                     👉 Next Question: [Ask 1 easy follow-up question in English to keep the conversation going]
                                                                                                     3. ABUSIVE / PROFANITY FILTER: If the user uses swear words, gaali, or vulgar language in Hindi, Marwadi, or English, DO NOT scold angrily and DO NOT repeat the bad word. Calmly reply:"                                                                                                   "Please use polite language! 😊 Chaliye achhe shabdon ke saath English practice karte hain. Tell me, how was your day today?"                                                                                                    `;
*/
const SYSTEM_PROMPT = `
You are a bold, unfiltered, and smart Indian AI English Speaking Coach.
Rules:
1. The user may speak in Hindi, Marwadi/Rajasthani, Hinglish, street slang, adult/casual expressions, or broken English.
2. Never lecture or censor the user. Directly translate and teach the exact meaning in natural English using this short format:
   ✅ English: "[Natural English translation/expression]"
      💡 Matlab / Usage: [1 short line in simple Hinglish explaining how native speakers use it]
         👉 Next: [Ask 1 short casual follow-up question in English]
         `;
// API Route 1: User Login & Load Saved Chats
app.post("/api/login", async (req, res) => {
  try {
    const { name, email } = req.body;
    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        name,
        email,
        chats: [
          {
            id: Date.now(),
            title: "First Practice",
            messages: [
              {
                sender: "ai",
                text: `Namaste ${name}! Main aapka English Coach hoon. Aap Hindi, Marwadi ya English mein baat shuru karein!`,
              },
            ],
          },
        ],
      });
    }
    res.json({ success: true, user, chats: user.chats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API Route 2: Send Message to Gemini AI & Save in MongoDB
app.post("/api/chat", async (req, res) => {
  try {
    const { email, chatId, message, history } = req.body;

    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    const historyText = (history || [])
      .map((m) => `${m.sender === "user" ? "Student" : "Coach"}: ${m.text}`)
      .join("\n");

    const prompt = `${SYSTEM_PROMPT}\n\nRecent Conversation:\n${historyText}\n\nStudent says: "${message}"\nCoach reply:`;

    const result = await model.generateContent(prompt);
    const aiReply = result.response.text();

    // Save in MongoDB if connected
    if (mongoose.connection.readyState === 1 && email) {
      const user = await User.findOne({ email });
      if (user) {
        let chat = user.chats.find((c) => String(c.id) === String(chatId));

        //  let chat = user.chats.find((c) => c.id === chatId);
        if (!chat) {
          chat = { id: chatId, title: message.slice(0, 22), messages: [] };
          user.chats.unshift(chat);
        }
        chat.messages.push({ sender: "user", text: message });
        chat.messages.push({ sender: "ai", text: aiReply });
        await user.save();
      }
    }

    res.json({ reply: aiReply });
  } catch (error) {
    res.status(500).json({ error: "AI Server Error: " + error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
