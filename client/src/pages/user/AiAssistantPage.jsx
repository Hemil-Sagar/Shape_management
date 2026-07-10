import { useRef, useState, useEffect } from "react";
import { api } from "../../api/client.js";

const GREETING = "Hi, I'm Neev, BuniyadByte's AI assistant. How can I help you today?";

export default function AiAssistantPage() {
  const [displayMessages, setDisplayMessages] = useState([{ role: "assistant", content: GREETING }]);
  const [agentConversationMessages, setAgentConversationMessages] = useState([]);
  const [currentStructuredData, setCurrentStructuredData] = useState({});
  const [latestAgentResponse, setLatestAgentResponse] = useState(null);
  const [userInput, setUserInput] = useState("");
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages]);

  function resetAll() {
    setDisplayMessages([]);
    setAgentConversationMessages([]);
    setCurrentStructuredData({});
    setLatestAgentResponse(null);
    setSubmitError("");
  }

  async function handleSend(e) {
    e.preventDefault();
    const text = userInput.trim();
    if (!text || sending) return;

    setUserInput("");
    setDisplayMessages((prev) => [...prev, { role: "user", content: text }]);
    const nextConversation = [...agentConversationMessages, { role: "user", content: text }];
    setAgentConversationMessages(nextConversation);

    setSending(true);
    try {
      const response = await api("/ai/chat", {
        method: "POST",
        body: {
          conversationMessages: nextConversation,
          currentStructuredData,
        },
      });

      setLatestAgentResponse(response);
      setCurrentStructuredData(response.structured_data || {});
      setDisplayMessages((prev) => [
        ...prev,
        { role: "assistant", content: response.response_to_user || "I could not process that request." },
      ]);
    } catch (err) {
      setDisplayMessages((prev) => [...prev, { role: "assistant", content: `Agent error: ${err.message}` }]);
    } finally {
      setSending(false);
    }
  }

  async function handleSubmitRequest() {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const result = await api("/ai/chat/submit", {
        method: "POST",
        body: currentStructuredData,
      });

      setDisplayMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Your request has been submitted successfully. Request No: ${result.requestCode}. You can track it from My AI Requests.`,
        },
      ]);

      setAgentConversationMessages([]);
      setCurrentStructuredData({});
      setLatestAgentResponse(null);
    } catch (err) {
      setSubmitError(`Failed to submit request: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  function handleCancelRequest() {
    resetAll();
  }

  function handleClearChat() {
    resetAll();
  }

  const readyToSubmit =
    latestAgentResponse &&
    latestAgentResponse.ready_to_submit &&
    latestAgentResponse.intent === "formula_update";

  const data = readyToSubmit ? latestAgentResponse.structured_data || {} : null;

  return (
    <div>
      <h1>AI Assistant</h1>
      <div style={{ color: "var(--muted)", marginBottom: "1rem" }}>
        Create formula update requests using conversation
      </div>

      <div className="chat-container">
        <div className="chat-messages">
          {displayMessages.map((message, idx) => (
            <div key={idx} className={`chat-message ${message.role}`}>
              {message.content}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <form className="chat-input-row" onSubmit={handleSend}>
          <input
            placeholder="Ask AI Assistant..."
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            disabled={sending}
          />
          <button className="btn btn-primary" type="submit" disabled={sending || !userInput.trim()}>
            {sending ? "Sending..." : "Send"}
          </button>
        </form>
      </div>

      {readyToSubmit && (
        <div className="card" style={{ marginTop: "1rem" }}>
          <h3>Request Preview</h3>

          {submitError && <div className="error-banner">{submitError}</div>}

          <div className="grid-2">
            <div>
              <p><strong>Project:</strong> {data.project_name || "N/A"}</p>
              <p><strong>Category:</strong> {data.category || "N/A"}</p>
              <p><strong>Shape:</strong> {data.shape_name || "N/A"}</p>
              <p><strong>Output:</strong> {data.output_name || "N/A"}</p>
            </div>
            <div>
              <p><strong>Reason:</strong> {data.reason || "N/A"}</p>
              <div className="info-banner">Scope: This request will apply only to this project.</div>
            </div>
          </div>

          <div className="grid-2">
            <div>
              <strong>Current Formula</strong>
              <pre>{data.current_formula || "N/A"}</pre>
            </div>
            <div>
              <strong>Requested Formula</strong>
              <pre>{data.requested_formula || "N/A"}</pre>
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
            <button className="btn btn-primary" onClick={handleSubmitRequest} disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Request to Admin"}
            </button>
            <button className="btn btn-secondary" onClick={handleCancelRequest} disabled={submitting}>
              Cancel Request
            </button>
          </div>
        </div>
      )}

      {!readyToSubmit && displayMessages.length > 0 && (
        <div style={{ marginTop: "1rem" }}>
          <button className="btn btn-secondary" onClick={handleClearChat}>
            Clear Chat
          </button>
        </div>
      )}
    </div>
  );
}
