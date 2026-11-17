// Jab aap Node.js server Render ya localhost par chalayein, toh uska URL yahan dalein:
const BACKEND_URL = "";

let currentUser = JSON.parse(localStorage.getItem("ai_tutor_user")) || null;
let chats = JSON.parse(localStorage.getItem("ai_tutor_chats")) || [];
let currentChatId = null;
let isVoiceEnabled = true;

window.addEventListener("DOMContentLoaded", () => {
  // Button Listeners
  document.getElementById("loginBtn").addEventListener("click", loginUser);
  document.getElementById("logoutBtn").addEventListener("click", logoutUser);
  document.getElementById("menuBtn").addEventListener("click", toggleMenu);
  document.getElementById("overlay").addEventListener("click", toggleMenu);
  document
    .getElementById("newChatBtn")
    .addEventListener("click", createNewChat);
  document.getElementById("sendBtn").addEventListener("click", sendMessage);
  document.getElementById("micBtn").addEventListener("click", startVoice);
  document.getElementById("muteBtn").addEventListener("click", toggleSpeaker);

  document.getElementById("textInput").addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
  });

  // Check if user is already logged in
  if (currentUser && currentUser.name && currentUser.email) {
    showAppScreen();
  }
});

function showAppScreen() {
  document.getElementById("loginModal").style.display = "none";
  document.getElementById("displayUser").innerText = currentUser.name;
  document.getElementById("displayEmail").innerText = currentUser.email;

  if (chats.length === 0) {
    createNewChat();
  } else {
    loadChat(chats[0].id);
  }
}

async function loginUser() {
  const name = document.getElementById("userNameInput").value.trim();
  const email = document.getElementById("userEmailInput").value.trim();

  if (!name || !email) {
    alert("Kripya apna Naam aur Gmail ID dono bharein.");
    return;
  }

  currentUser = { name, email };
  localStorage.setItem("ai_tutor_user", JSON.stringify(currentUser));
  showAppScreen();

  // Backend par user login/sync try karein
  try {
    const res = await fetch(`${BACKEND_URL}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.chats && data.chats.length > 0) {
        chats = data.chats;
        saveChats();
        loadChat(chats[0].id);
      }
    }
  } catch (err) {
    console.log("Offline/Local mode active (Backend abhi connect nahi hai).");
  }
}

function logoutUser() {
  localStorage.removeItem("ai_tutor_user");
  location.reload();
}

function toggleMenu() {
  document.getElementById("sidebar").classList.toggle("open");
  document.getElementById("overlay").classList.toggle("show");
}

function toggleSpeaker() {
  isVoiceEnabled = !isVoiceEnabled;
  document.getElementById("muteBtn").innerText = isVoiceEnabled ? "🔊" : "🔇";
  if (!isVoiceEnabled && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

function createNewChat() {
  const welcomeName = currentUser ? currentUser.name : "Dost";
  const newChat = {
    id: Date.now(),
    title: "Practice Session",
    messages: [
      {
        sender: "ai",
        text: `Namaste ${welcomeName}! 👋 Main aapka AI English Coach hoon.\n\nAap Hindi, Marwadi ya tooti-footi English mein kuch bhi boliye ya likhiye. Main aapko uski sahi English bolna sikhaunga!\n\nChaliye shuru karte hain: "Aaj aapने subah se kya kiya?"`,
      },
    ],
  };
  chats.unshift(newChat);
  saveChats();
  loadChat(newChat.id);

  if (document.getElementById("sidebar").classList.contains("open")) {
    toggleMenu();
  }
}

function loadChat(id) {
  currentChatId = id;
  renderChatList();
  const chat = chats.find((c) => c.id === id);
  const chatBox = document.getElementById("chatBox");
  chatBox.innerHTML = "";

  if (chat) {
    chat.messages.forEach((m) => appendMessageUI(m.sender, m.text));
  }
}
/*
function renderChatList() {
  const list = document.getElementById("chatList");
  list.innerHTML = "";
  chats.forEach((c) => {
    const li = document.createElement("li");
    li.innerText = "💬 " + c.title;
    if (c.id === currentChatId) li.classList.add("active");
    li.onclick = () => {
      loadChat(c.id);
      toggleMenu();
    };
    list.appendChild(li);
  });
}*/
function renderChatList() {
  const list = document.getElementById("chatList");
  list.innerHTML = "";
  chats.forEach((c) => {
    const li = document.createElement("li");
    li.style.display = "flex";
    li.style.justifyContent = "space-between";
    li.style.alignItems = "center";
    if (c.id === currentChatId) li.classList.add("active");

    const titleSpan = document.createElement("span");
    titleSpan.innerText = "💬 " + c.title;
    titleSpan.style.overflow = "hidden";
    titleSpan.style.textOverflow = "ellipsis";
    titleSpan.onclick = () => {
      loadChat(c.id);
      toggleMenu();
    };

    const delBtn = document.createElement("button");
    delBtn.innerText = "🗑️";
    delBtn.style.background = "none";
    delBtn.style.border = "none";
    delBtn.style.cursor = "pointer";
    delBtn.onclick = (e) => {
      e.stopPropagation();
      deleteChat(c.id);
    };

    li.appendChild(titleSpan);
    li.appendChild(delBtn);
    list.appendChild(li);
  });
}

function deleteChat(id) {
  chats = chats.filter((c) => c.id !== id);
  saveChats();
  if (chats.length === 0) {
    createNewChat();
  } else if (currentChatId === id) {
    loadChat(chats[0].id);
  }
}

function appendMessageUI(sender, text) {
  const chatBox = document.getElementById("chatBox");
  const div = document.createElement("div");
  div.className = `msg ${sender}`;
  div.innerText = text;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function saveChats() {
  localStorage.setItem("ai_tutor_chats", JSON.stringify(chats));
  renderChatList();
}

// Send Message & Connect to Backend (with Smart Fallback)
async function sendMessage() {
  const input = document.getElementById("textInput");
  const text = input.value.trim();
  if (!text) return;

  input.value = "";
  const chat = chats.find((c) => c.id === currentChatId);

  if (chat.messages.length === 1) {
    chat.title = text.slice(0, 22) + (text.length > 22 ? "..." : "");
  }

  chat.messages.push({ sender: "user", text });
  appendMessageUI("user", text);
  saveChats();

  const statusText = document.getElementById("statusText");
  statusText.innerText = "AI Coach soch raha hai...";

  try {
    // 1. Asli Node.js + MongoDB + Gemini Backend ko call karega
    const response = await fetch(`${BACKEND_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: currentUser.email,
        chatId: currentChatId,
        message: text,
        history: chat.messages.slice(-6),
      }),
    });

    if (!response.ok) throw new Error("Backend not reachable");
    const data = await response.json();

    chat.messages.push({ sender: "ai", text: data.reply });
    appendMessageUI("ai", data.reply);
    saveChats();
    speakText(data.reply);
  } catch (err) {
    const offlineMsg = `⚠️ Backend server abhi connect nahi hai. Kripya Render par server live karke BACKEND_URL dalein.`;
    chat.messages.push({ sender: "ai", text: offlineMsg });
    appendMessageUI("ai", offlineMsg);
    saveChats();
  } finally {
    statusText.innerText = "Online • Ready to listen";
  }
}
/* speakText(data.speakEnglish || data.reply);
  } catch (err) {
    // 2. Agar Backend abhi chalu nahi hai, toh Local Smart Demo Coach जवाब dega
    const fallback = generateLocalCoachReply(text);
    chat.messages.push({ sender: "ai", text: fallback.fullText });
    appendMessageUI("ai", fallback.fullText);
    saveChats();
    speakText(fallback.englishToSpeak);
  } finally {
    statusText.innerText = "Online • Ready to listen";
  }
}*/
/*
// Local Demo Coach (Jab tak server.js connect na ho tab bhi test kar sakein)
function generateLocalCoachReply(userText) {
  const lower = userText.toLowerCase();
  const badWords = [
    "gali",
    "chutiya",
    "madarchod",
    "bhenchod",
    "fuck",
    "bitch",
    "bsdk",
    "harami",
  ];

  if (badWords.some((w) => lower.includes(w))) {
    const politeMsg =
      "Please use polite words! 😊 Hum yahan achhi English seekhne aaye hain.\n\nTry saying: 'I am feeling frustrated today.'";
    return {
      fullText: politeMsg,
      englishToSpeak:
        "Please use polite words. Let us focus on learning English.",
    };
  }

  if (
    lower.includes("mharo") ||
    lower.includes("mane") ||
    lower.includes("kai") ||
    lower.includes("koni")
  ) {
    return {
      fullText: `✅ Marwadi samajh gaya!\n\n🗣️ Sahi English:\n"I want to learn fluent English."\n\n💡 Tip: Jab koi kaam karne ki ichha batani ho toh "I want to..." ka use karein.\n\n👉 Ab aap bolkar try karein: "I want to speak English every day."`,
      englishToSpeak:
        "I want to learn fluent English. Try saying: I want to speak English every day.",
    };
  }

  return {
    fullText: `🗣️ Aapne kaha: "${userText}"\n\n✅ Practice Tip:\nJab aap Node.js backend (server.js) mein apni Gemini API key laga denge, toh AI aapke har sentence ko real-time translate aur correct karega!\n\n👉 Next Practice: Tell me in English, "What is your favorite hobby?"`,
    englishToSpeak:
      "Great effort! Tell me in English, what is your favorite hobby?",
  };
}*/

// Voice Input (Speech-to-Text)
function startVoice() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert("Voice Mic ke liye Google Chrome browser ka use karein.");
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "hi-IN"; // Hindi, Marwadi words aur Indian English pakdega
  const micBtn = document.getElementById("micBtn");

  recognition.onstart = () => {
    micBtn.classList.add("recording");
    document.getElementById("statusText").innerText = "Listening... Boliye 🎙️";
  };

  recognition.onend = () => {
    micBtn.classList.remove("recording");
    document.getElementById("statusText").innerText =
      "Online • Ready to listen";
  };

  recognition.onerror = () => {
    micBtn.classList.remove("recording");
    document.getElementById("statusText").innerText =
      "Mic permission allow karein";
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    document.getElementById("textInput").value = transcript;
    sendMessage();
  };

  recognition.start();
}

// Voice Output (Text-to-Speech)
function speakText(text) {
  if (!isVoiceEnabled || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const cleanText = text.replace(/[✅🗣️💡👉👋]/g, "");
  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = "en-IN";
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
}
