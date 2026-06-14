import { useState } from "react";

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState("");

  // ---------------- UPLOAD PDF ----------------
  const uploadPDF = async () => {
    if (!file) return alert("Please select a PDF");

    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);

    const res = await fetch("http://127.0.0.1:8000/upload-pdf", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    setSummary(data.summary || data.error);

    setLoading(false);
  };

  // ---------------- STREAM CHAT ----------------
  const sendMessage = async () => {
    if (!input) return;

    const question = input;

    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setInput("");

    setMessages((prev) => [...prev, { role: "bot", text: "" }]);
    setLoading(true);

    const res = await fetch("http://127.0.0.1:8000/chat-stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");

    let botText = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });

      const lines = chunk.split("\n");

      for (let line of lines) {
        if (line.startsWith("data: ")) {
          const token = line.replace("data: ", "").trim();

          if (token === "[DONE]") {
            setLoading(false);
            return;
          }

          botText += token + " ";

          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "bot",
              text: botText,
            };
            return updated;
          });
        }
      }
    }

    setLoading(false);
  };

  return (
    <div style={styles.container}>

      {/* SIDEBAR */}
      <div style={styles.sidebar}>
        <h2>📚 LearnMate AI</h2>

        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files[0])}
        />

        <button onClick={uploadPDF} style={styles.button}>
          Upload PDF
        </button>

        <hr style={{ margin: "10px 0" }} />

        <h4>📄 Summary</h4>
        <div style={styles.summaryBox}>
          {summary || "No PDF uploaded yet"}
        </div>
      </div>

      {/* CHAT AREA */}
      <div style={styles.chatArea}>

        <div style={styles.chatBox}>
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                ...styles.msg,
                alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                background: msg.role === "user" ? "#2563eb" : "#1f2937",
              }}
            >
              {msg.text}
            </div>
          ))}

          {loading && <p style={{ color: "gray" }}>Thinking...</p>}
        </div>

        {/* INPUT */}
        <div style={styles.inputBox}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything from your PDF..."
            style={styles.input}
          />

          <button onClick={sendMessage} style={styles.button}>
            Send
          </button>
        </div>

      </div>
    </div>
  );
}

// ---------------- STYLES ----------------
const styles = {
  container: {
    display: "flex",
    height: "100vh",
    background: "#0b0f19",
    color: "white",
    fontFamily: "Arial",
  },

  sidebar: {
    width: "260px",
    padding: "20px",
    background: "#111827",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },

  chatArea: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },

  chatBox: {
    flex: 1,
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    overflowY: "auto",
  },

  msg: {
    padding: "10px",
    borderRadius: "10px",
    maxWidth: "60%",
  },

  inputBox: {
    display: "flex",
    padding: "10px",
    borderTop: "1px solid #222",
  },

  input: {
    flex: 1,
    padding: "10px",
    borderRadius: "8px",
    border: "none",
    outline: "none",
  },

  button: {
    marginLeft: "10px",
    padding: "10px 15px",
    background: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
  },

  summaryBox: {
    background: "#0f172a",
    padding: "10px",
    borderRadius: "8px",
    minHeight: "100px",
    fontSize: "13px",
    color: "#ccc",
  },
};