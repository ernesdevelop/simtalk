import { useState } from "react";
import ScenarioPicker from "@/components/ScenarioPicker";
import ChatView, { type Msg } from "@/components/ChatView";
import FeedbackView from "@/components/FeedbackView";
import type { Scenario, Hostility } from "@/lib/scenarios";

type Stage = "pick" | "chat" | "feedback";

const Index = () => {
  const [stage, setStage] = useState<Stage>("pick");
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [hostility, setHostility] = useState<Hostility>("medium");
  const [chatMessages, setChatMessages] = useState<Msg[]>([]);

  const handleStart = (s: Scenario, h: Hostility) => {
    setScenario(s);
    setHostility(h);
    setStage("chat");
  };

  const handleRequestFeedback = (messages: Msg[]) => {
    setChatMessages(messages);
    setStage("feedback");
  };

  const handleRestart = () => {
    setScenario(null);
    setChatMessages([]);
    setStage("pick");
  };

  if (stage === "pick" || !scenario) return <ScenarioPicker onStart={handleStart} />;

  if (stage === "chat") {
    return (
      <ChatView
        scenario={scenario}
        hostility={hostility}
        onBack={handleRestart}
        onRequestFeedback={handleRequestFeedback}
      />
    );
  }

  return (
    <FeedbackView
      messages={chatMessages}
      scenario={scenario}
      hostility={hostility}
      onBack={() => setStage("chat")}
      onRestart={handleRestart}
    />
  );
};

export default Index;
