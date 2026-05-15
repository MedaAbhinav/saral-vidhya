import { useNavigate, useSearchParams } from "react-router-dom";

export type ToolId =
  | "summary"
  | "detailed"
  | "flashcards"
  | "podcasts"
  | "ask"
  | "videos"
  | "mindmap"
  | "pyq"
  | "popquiz"
  | "qbank"
  | "swot"
  | "leaderboard";

export interface ToolsMenuProps {
  activeTool: ToolId;
  onSelectTool: (tool: ToolId) => void;
  /** New Option-1 props */
  drawerOpen: boolean;
  onOpenDrawer: () => void;
  onCloseDrawer: () => void;
}

// Full tools list
const ALL_TOOLS: { id: ToolId; icon: string; label: string; desc: string }[] = [
  { id: "summary", icon: "📖", label: "Summary", desc: "Quick overview" },
  {
    id: "detailed",
    icon: "📝",
    label: "Detailed Notes",
    desc: "Deep dive notes",
  },
  {
    id: "flashcards",
    icon: "🃏",
    label: "Flash Cards",
    desc: "Quick revision",
  },
  { id: "podcasts", icon: "🎙️", label: "Podcasts", desc: "Listen and learn" },
  { id: "ask", icon: "❓", label: "Ask AI", desc: "Get instant answers" },
  { id: "mindmap", icon: "🧠", label: "Mindmap", desc: "Visualise concepts" },
  { id: "popquiz", icon: "⚡", label: "Quiz", desc: "Test knowledge" },
  { id: "qbank", icon: "🏦", label: "Question Bank", desc: "Practice more" },
  { id: "videos", icon: "🎥", label: "Videos", desc: "Watch and learn" },
  { id: "pyq", icon: "📄", label: "PYQ", desc: "Past year questions" },
  { id: "swot", icon: "🔍", label: "SWOT", desc: "Analyse strengths" },
  { id: "leaderboard", icon: "🏆", label: "Leaderboard", desc: "See rankings" },
];

export default function ToolsMenu({
  activeTool,
  onSelectTool,
  drawerOpen,
  onOpenDrawer,
  onCloseDrawer,
}: ToolsMenuProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const handleChaptersClick = () => {
    const p = new URLSearchParams(searchParams);
    p.delete("chapter");
    p.delete("chapterName");
    navigate(`/chapters?${p.toString()}`);
  };

  const toggleSidebar = () => {
    if (drawerOpen) onCloseDrawer();
    else onOpenDrawer();
  };

  return (
    <div
      className={`st-rich-sidebar ${drawerOpen ? "st-rich-sidebar--expanded" : "st-rich-sidebar--collapsed"}`}
    >
      {/* Top Toggle Button */}
      <button className="st-sidebar-toggle" onClick={toggleSidebar}>
        <div className={`hamburger-icon ${drawerOpen ? "open" : ""}`}>
          <span></span>
          <span></span>
          <span></span>
        </div>
      </button>

      {/* Tools List */}
      <div className="st-sidebar-scroll">
        <div className="st-sidebar-tools">
          {ALL_TOOLS.map((t, idx) => (
            <button
              key={t.id}
              className={`st-sidebar-btn ${activeTool === t.id ? "active" : ""}`}
              onClick={() => {
                onSelectTool(t.id);
                if (window.innerWidth < 768) onCloseDrawer();
              }}
              style={
                { animationDelay: `${idx * 0.03}s` } as React.CSSProperties
              }
            >
              <div className="st-btn-icon">{t.icon}</div>
              <div className="st-btn-text">
                <span className="st-btn-label">{t.label}</span>
                <span className="st-btn-desc">{t.desc}</span>
              </div>
              {activeTool === t.id && <div className="st-btn-glow" />}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="st-sidebar-footer">
        <button className="st-footer-btn" onClick={handleChaptersClick}>
          <span className="st-btn-icon">⬅️</span>
          <span className="st-btn-label">Back to Chapters</span>
        </button>
      </div>
    </div>
  );
}
