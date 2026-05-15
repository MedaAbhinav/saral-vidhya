import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import MarkdownView from "@/components/MarkdownView";
import MermaidView from "@/components/MermaidView";
import FlashcardsView from "@/components/FlashcardsView";
import QuestionBankView, {
  QBankReadAloudToolbar,
} from "@/components/QuestionBankView";
import type { ToolId } from "@/components/ToolsMenu";
import {
  getResourceContent,
  getFlashcards,
  DifficultyLevel,
} from "@/data/contentRepository";
import { askGemini } from "@/services/askService";
import {
  googleTtsSpeak,
  googleTtsStop,
  googleTtsPause,
  googleTtsResume,
} from "@/services/googleTtsService";
import {
  startSpeechSession,
  hasWebSpeechSupport,
  type SpeechSession,
} from "@/services/speechService";

import { parseQuestionBank, type QuizQuestion } from "@/utils/quizParser";
import {
  trackChapterVisit,
  trackToolUsage,
  trackPersonaChange,
} from "@/utils/analytics";
import {
  useAudioProgress,
  type AudioProgress,
  GlobalAudioProgress,
} from "@/hooks/useAudioProgress";

/** Maps persona IDs to resource folder difficulty levels */
const PERSONA_TO_LEVEL: Record<string, DifficultyLevel> = {
  // Legacy keys
  naive: "beginner",
  average: "intermediate",
  above_average: "advanced",
  // Direct keys (used by PersonaSelection)
  beginner: "beginner",
  intermediate: "intermediate",
  advanced: "advanced",
};

export default function StudyTable() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const treeLogoSrc = `${import.meta.env.BASE_URL}brand-logo.png`;

  const className = searchParams.get("className") || "Class";
  const subjectName = searchParams.get("subjectName") || "Subject";
  const semesterName = searchParams.get("semesterName") || "";
  const subjectId = searchParams.get("sId") || "english";
  const personaRaw = searchParams.get("persona") || "intermediate";
  const [persona, setPersonaState] = useState<DifficultyLevel>(
    PERSONA_TO_LEVEL[personaRaw] || "intermediate",
  );

  const setPersona = (level: DifficultyLevel) => {
    // Stop any active TTS/audio before switching persona
    googleTtsStop();
    trackPersonaChange(persona, level);
    setPersonaState(level);
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set("persona", level);
        return p;
      },
      { replace: true },
    );
  };

  const PERSONAS: { key: DifficultyLevel; label: string; imgSrc: string }[] = [
    { key: "beginner", label: "Beginner", imgSrc: "/personas/beginner.png" },
    {
      key: "intermediate",
      label: "Intermediate",
      imgSrc: "/personas/intermediate.png",
    },
    { key: "advanced", label: "Advanced", imgSrc: "/personas/advanced.png" },
  ];

  const chapterNumStr = searchParams.get("chapter") || "1";
  const chapterNumber = parseInt(chapterNumStr, 10);
  const chapterName =
    searchParams.get("chapterName") || `Chapter ${chapterNumber}`;

  const location = useLocation();
  const navState = location.state as any;

  // Persist activeTool in URL so refresh restores the same tool
  const toolFromUrl = (searchParams.get("tool") as ToolId) || "summary";
  const initialTool = navState?.autoPlayPodcast ? "podcasts" : toolFromUrl;
  const [activeTool, setActiveToolState] = useState<ToolId>(initialTool);
  const [autoResumeTrack, setAutoResumeTrack] = useState<
    "long" | "short" | null
  >(null);

  useEffect(() => {
    const t = searchParams.get("tool") as ToolId;
    if (t && t !== activeTool) {
      setActiveToolState(t);
    }
  }, [searchParams, activeTool]);

  const setActiveTool = (tool: ToolId) => {
    setActiveToolState(tool);
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set("tool", tool);
        return p;
      },
      { replace: true },
    );
    trackToolUsage({
      tool,
      subjectId,
      chapterNumber,
      chapterName:
        searchParams.get("chapterName") || `Chapter ${chapterNumber}`,
    });
  };

  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  /** Mobile: drawer open/closed. Desktop (study): false = narrow “peek” rail, true = expanded with labels. */
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const railCollapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const clearRailCollapseTimer = useCallback(() => {
    if (railCollapseTimerRef.current != null) {
      clearTimeout(railCollapseTimerRef.current);
      railCollapseTimerRef.current = null;
    }
  }, []);
  const [readingHighlight, setReadingHighlight] = useState<{
    active: boolean;
    startWord: number;
    endWord: number;
  }>({
    active: false,
    startWord: -1,
    endWord: -1,
  });
  const [qbankReadAloudText, setQbankReadAloudText] = useState("");

  useEffect(() => {
    // Stop reading whenever we switch tools to prevent overlapping audio
    googleTtsStop();

    if (activeTool !== "qbank") {
      setQbankReadAloudText("");
    }
  }, [activeTool]);

  // Stop TTS when persona changes — new content will load
  useEffect(() => {
    googleTtsStop();
    setReadingHighlight({ active: false, startWord: -1, endWord: -1 });
  }, [persona]);
  useEffect(() => {
    const handleResize = () => {
      clearRailCollapseTimer();
      setIsSidebarOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      clearRailCollapseTimer();
    };
  }, [clearRailCollapseTimer]);

  /** Tools that do NOT have persona-specific content — hide the switcher for these */
  const NON_PERSONA_TOOLS = new Set([
    "pyq",
    "swot",
    "leaderboard",
    "ask",
    "videos",
    "mindmap",
  ]);
  const showPersonaSwitcher = !NON_PERSONA_TOOLS.has(activeTool);
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => localStorage.getItem("app_authenticated") === "true",
  );

  // Flashcard speak state — button lives in topbar, logic lives in FlashcardsView
  const [flashcardSpeakTrigger, setFlashcardSpeakTrigger] = useState(0);
  const [flashcardStopTrigger, setFlashcardStopTrigger] = useState(0);
  const [flashcardIsSpeaking, setFlashcardIsSpeaking] = useState(false);

  // Podcast play state — button lives in topbar, logic lives in PodcastsView
  const [podcastPlayTrigger, setPodcastPlayTrigger] = useState(0);
  const [podcastPauseTrigger, setPodcastPauseTrigger] = useState(0);
  const [podcastIsPlaying, setPodcastIsPlaying] = useState(false);

  const handleAuthClick = () => {
    if (isAuthenticated) {
      localStorage.removeItem("app_authenticated");
      localStorage.removeItem("app_role");
      setIsAuthenticated(false);
      navigate("/login", { replace: true });
      return;
    }
    navigate("/login", { replace: true });
  };

  // Track chapter visit whenever chapter changes
  useEffect(() => {
    trackChapterVisit({
      subjectId,
      subjectName,
      chapterNumber,
      chapterName:
        searchParams.get("chapterName") || `Chapter ${chapterNumber}`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId, chapterNumber]);

  // Auto-resume podcast if there's progress for this lesson
  useEffect(() => {
    const checkAutoResume = async () => {
      if (navState?.autoPlayPodcast || toolFromUrl === "podcasts") return; // Already set to podcasts

      const userId = localStorage.getItem("app_user_id") || "anonymous";
      let progress: GlobalAudioProgress | null = null;

      // Check local storage first
      const localDataStr = localStorage.getItem(
        `global_last_podcast_${userId}`,
      );
      if (localDataStr) {
        try {
          progress = JSON.parse(localDataStr);
        } catch (e) {
          console.error(e);
        }
      }

      // Check Firestore if user logged in
      if (userId && userId !== "anonymous") {
        try {
          const { doc, getDoc } = await import("firebase/firestore");
          const { db } = await import("@/services/firebase");
          const docRef = doc(db, "global_podcast_progress", `user_${userId}`);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const cloudProgress = docSnap.data() as GlobalAudioProgress;
            if (!progress || cloudProgress.updatedAt > progress.updatedAt) {
              progress = cloudProgress;
            }
          }
        } catch (error) {
          console.warn(
            "Failed to fetch global progress from Firestore.",
            error,
          );
        }
      }

      if (
        progress &&
        progress.currentTime > 0 &&
        progress.subjectId === subjectId &&
        progress.chapterNumber === chapterNumber &&
        progress.persona === persona &&
        progress.wasPaused
      ) {
        setActiveToolState("podcasts");
        setAutoResumeTrack(progress.track as "long" | "short");
      }
    };

    checkAutoResume();
  }, [
    subjectId,
    chapterNumber,
    persona,
    navState?.autoPlayPodcast,
    toolFromUrl,
  ]);

  useEffect(() => {
    setLoading(true);
    setContent(null);

    // Pass the real subjectId for all tools — each tool handles subject routing itself
    const internalSubId = subjectId;

    if (activeTool === "summary") {
      getResourceContent(internalSubId, chapterNumber, "summary.md", persona)
        .then((res) => {
          setContent(res);
          setLoading(false);
        })
        .catch(() => {
          setContent("Summary content unavailable for this persona.");
          setLoading(false);
        });
    } else if (activeTool === "detailed") {
      getResourceContent(
        internalSubId,
        chapterNumber,
        "detailed_view.md",
        persona,
      )
        .then((res) => {
          setContent(res);
          setLoading(false);
        })
        .catch(() => {
          setContent("Detailed notes unavailable.");
          setLoading(false);
        });
    } else if (activeTool === "flashcards") {
      getFlashcards(internalSubId, chapterNumber, persona)
        .then((res) => {
          setContent(res);
          setLoading(false);
        })
        .catch(() => {
          setContent([]);
          setLoading(false);
        });
    } else if (activeTool === "mindmap") {
      getResourceContent(internalSubId, chapterNumber, "mindmap.md", persona)
        .then((res) => {
          setContent(res);
          setLoading(false);
        })
        .catch(() => {
          setContent("graph TD\n  A[Unavailable] --> B[Mindmap not found]");
          setLoading(false);
        });
    } else if (activeTool === "qbank" || activeTool === "popquiz") {
      getResourceContent(
        internalSubId,
        chapterNumber,
        "question_bank.md",
        persona,
      )
        .then((res) => {
          setContent(res);
          setLoading(false);
        })
        .catch(() => {
          setContent("Question bank unavailable.");
          setLoading(false);
        });
    } else if (activeTool === "videos") {
      getResourceContent(
        internalSubId,
        chapterNumber,
        "youtube_links.md",
        persona,
      )
        .then((res) => {
          setContent(res);
          setLoading(false);
        })
        .catch(() => {
          setContent(null);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [activeTool, subjectId, chapterNumber, persona]);

  const handleBackToClass = () => navigate("/");
  const handleBackToChapters = () => {
    const p = new URLSearchParams(searchParams);
    p.delete("chapter");
    p.delete("chapterName");
    navigate(`/chapters?${p.toString()}`);
  };

  // Build breadcrumb: M.A > 3rd Semester > Public Administration (Urdu Medium) > Chapter 1
  const breadcrumbParts: { label: string; onClick?: () => void }[] = [];
  breadcrumbParts.push({ label: className, onClick: handleBackToClass });
  if (semesterName) {
    breadcrumbParts.push({ label: semesterName });
  }
  breadcrumbParts.push({ label: subjectName, onClick: handleBackToChapters });
  breadcrumbParts.push({ label: chapterName });

  const renderContent = () => {
    if (loading)
      return <div className="loading-state">Loading {activeTool}...</div>;

    switch (activeTool) {
      case "summary":
      case "detailed":
        return (
          <div className="markdown-container">
            <ReadingHighlightView
              content={typeof content === "string" ? content : ""}
              active={readingHighlight.active}
              startWord={readingHighlight.startWord}
              endWord={readingHighlight.endWord}
            />
          </div>
        );
      case "mindmap":
        return (
          <div className="mindmap-container">
            <MermaidView content={typeof content === "string" ? content : ""} />
          </div>
        );
      case "flashcards":
        return Array.isArray(content) && content.length > 0 ? (
          <FlashcardsView
            cards={content}
            subjectId={subjectId}
            speakTrigger={flashcardSpeakTrigger}
            stopTrigger={flashcardStopTrigger}
            onSpeakingChange={setFlashcardIsSpeaking}
          />
        ) : (
          <p>No flashcards available.</p>
        );
      case "ask":
        return (
          <AskBotView
            chapterName={chapterName}
            subjectId={subjectId}
            chapterNumber={chapterNumber}
            difficulty={persona}
          />
        );
      case "podcasts":
        return (
          <PodcastsView
            chapterName={chapterName}
            subjectId={subjectId}
            chapterNumber={chapterNumber}
            persona={persona}
            autoPlay={navState?.autoPlayPodcast}
            resumeTrack={navState?.resumeTrack || autoResumeTrack}
            onPlayingChange={setPodcastIsPlaying}
            playTrigger={podcastPlayTrigger}
            pauseTrigger={podcastPauseTrigger}
          />
        );
      case "videos":
        return (
          <VideosView
            chapterName={chapterName}
            subjectId={subjectId}
            chapterNumber={chapterNumber}
            youtubeLinksContent={typeof content === "string" ? content : null}
          />
        );
      case "pyq":
        return <PYQView subjectName={subjectName} subjectId={subjectId} />;
      case "popquiz":
        return (
          <PopQuizView
            markdownContent={typeof content === "string" ? content : ""}
            subjectId={subjectId}
            chapterNumber={chapterNumber}
            onQuit={() => setActiveTool("summary")}
          />
        );
      case "qbank":
        return (
          <QuestionBankView
            persona={persona}
            currentSubjectId={subjectId}
            currentChapterNumber={chapterNumber}
            onReadAloudTextChange={setQbankReadAloudText}
            highlight={readingHighlight}
          />
        );
      case "swot":
        return <SwotView subjectId={subjectId} chapterNumber={chapterNumber} />;
      case "leaderboard":
        return <LeaderboardView subjectId={subjectId} />;
      default:
        return <div>Select a tool from the menu</div>;
    }
  };

  const TOOL_LABELS: Record<string, string> = {
    summary: "Study Table",
    detailed: "Study Table",
    mindmap: "Mindmap",
    flashcards: "Flash Cards",
    podcasts: "Podcasts",
    videos: "Videos",
    ask: "Ask",
    popquiz: "Quiz",
    qbank: "Question Bank",
    swot: "SWOT Analysis",
    pyq: "PYQ",
    leaderboard: "Leaderboard",
  };

  return (
    <div
      className="sv-app st-app"
      style={{
        display: "flex",
        flexDirection: "row",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      {/* Mobile overlay */}
      {isSidebarOpen && window.innerWidth <= 992 && (
        <div
          className="sv-mobile-overlay"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      {/* ── DARK RAIL (BACK ON LEFT) ── */}
      <nav className={`sv-rail ${!isSidebarOpen ? "collapsed" : ""}`}>
        <button
          className="sv-rail-toggle"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          title={isSidebarOpen ? "Collapse Menu" : "Expand Menu"}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        <div
          className="sv-rail-items"
          style={{ overflow: "hidden", flex: 1, paddingBottom: "20px" }}
        >
          {[
            { id: "summary", icon: "📖", label: "Summary" },
            { id: "detailed", icon: "📝", label: "Detailed" },
            { id: "flashcards", icon: "🃏", label: "Flash Cards" },
            { id: "podcasts", icon: "🎙️", label: "Podcasts" },
            { id: "ask", icon: "❓", label: "Ask" },
            { id: "mindmap", icon: "🧠", label: "Mindmap" },
            { id: "popquiz", icon: "⚡", label: "Quiz" },
            { id: "qbank", icon: "🏦", label: "Q-Bank" },
            { id: "videos", icon: "🎥", label: "Videos" },
            { id: "pyq", icon: "📄", label: "PYQ" },
          ].map((t) => (
            <div
              key={t.id}
              className="sv-rail-item"
              onClick={() => {
                setActiveTool(t.id as ToolId);
                if (window.innerWidth <= 992) setIsSidebarOpen(false);
              }}
              title={t.label}
            >
              <div
                className={`sv-rail-icon ${activeTool === t.id ? "sv-rail-icon--active" : ""}`}
                style={{
                  fontSize: "24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {t.icon}
              </div>
              {isSidebarOpen && <span className="sv-rail-chip">{t.label}</span>}
            </div>
          ))}
        </div>
      </nav>

      {/* Hover zone — left edge brings sidebar back */}
      {!isSidebarOpen && (
        <div
          className="sv-rail-hover-zone"
          onMouseEnter={() => setIsSidebarOpen(true)}
          style={{
            position: "fixed",
            left: 0,
            top: 0,
            width: "14px",
            height: "100vh",
            zIndex: 65,
            cursor: "pointer",
          }}
        />
      )}

      {/* ── MAIN ── */}
      <main
        className="sv-main book-main"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Frosted topbar */}
        <header className="sv-topbar">
          <div className="sv-topbar-left">
            <div
              className="sv-rail-brand"
              onClick={() => navigate("/")}
              style={{
                cursor: "pointer",
                marginRight: "16px",
                display: "flex",
                alignItems: "center",
              }}
            >
              <img
                className="sv-brand-logo-img sv-study-rail-tree-logo"
                src={treeLogoSrc}
                alt="Saral Vidhya"
              />
            </div>
            <div className="sv-breadcrumb">
              <span className="sv-bc-link" onClick={handleBackToClass}>
                {className || "Class"}
              </span>
              <span className="sv-bc-sep">/</span>
              <span className="sv-bc-link" onClick={handleBackToChapters}>
                {subjectName || "Subject"}
              </span>
              <span className="sv-bc-sep">/</span>
              <span className="sv-bc-link" onClick={handleBackToChapters}>
                Chapters
              </span>
              <span className="sv-bc-sep">/</span>
              <span className="sv-bc-current">{chapterName}</span>
            </div>
          </div>
          <div className="sv-topbar-right">
            <button className="sv-logout-btn" onClick={handleAuthClick}>
              <svg
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              {isAuthenticated ? "Log Out" : "Log In"}
            </button>
            <button
              className="sv-profile-btn"
              onClick={() => navigate("/profile")}
            >
              <svg
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              Profile
            </button>
          </div>
        </header>

        <div
          className="sv-content"
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          {/* ── BODY ── */}
          <div
            className="st-body"
            style={{
              flex: 1,
              overflowY:
                activeTool === "flashcards" || activeTool === "podcasts"
                  ? "hidden"
                  : "auto",
              padding:
                activeTool === "flashcards" ||
                activeTool === "popquiz" ||
                activeTool === "podcasts"
                  ? "8px 20px 0 20px"
                  : "16px 20px",
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              background: "transparent",
            }}
          >
            {/* ── COMPACT TOP BAR ── */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto 1fr",
                alignItems: "center",
                gap: "20px",
                marginBottom:
                  activeTool === "flashcards" || activeTool === "popquiz"
                    ? "6px"
                    : "12px",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center" }}>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <h1
                    className="st-page-title"
                    style={{ margin: 0, fontSize: "1.6rem" }}
                  >
                    {["summary", "detailed"].includes(activeTool)
                      ? "Study Table"
                      : TOOL_LABELS[activeTool]}
                  </h1>
                  {["summary", "detailed"].includes(activeTool) && (
                    <div className="st-page-subtitle-row">
                      <span className="st-page-subtitle">
                        {activeTool === "summary" ? "Summary" : "Detailed view"}
                      </span>
                      <span className="st-page-subtitle-sep">•</span>
                      <span className="st-chapter-subtitle">{chapterName}</span>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "center" }}>
                {showPersonaSwitcher && (
                  <div
                    className="persona-switcher persona-switcher--icons"
                    style={{
                      margin: 0,
                      padding: "4px 8px",
                      gap: "8px",
                      flexShrink: 0,
                    }}
                  >
                    {PERSONAS.map((p) => (
                      <button
                        key={p.key}
                        type="button"
                        className={`persona-icon-btn ${persona === p.key ? "active" : ""}`}
                        onClick={() => setPersona(p.key)}
                        aria-label={p.label}
                        data-label={p.label}
                        style={{
                          width: "72px",
                          height: "72px",
                          padding: "4px",
                          overflow: "hidden",
                          borderRadius: "16px",
                          border:
                            persona === p.key
                              ? "3px solid #7C3AED"
                              : "2px solid rgba(0, 0, 0, 0.08)",
                          boxShadow:
                            persona === p.key
                              ? "0 4px 12px rgba(124, 58, 237, 0.2)"
                              : "0 2px 6px rgba(0,0,0,0.05)",
                          background: "#ffffff",
                          transition: "all 0.2s ease",
                        }}
                      >
                        <img
                          src={p.imgSrc}
                          alt=""
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "contain",
                          }}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  alignItems: "center",
                  minWidth: 0,
                }}
              >
                {activeTool === "flashcards" && (
                  <div className="read-aloud-tool-pill read-aloud-tool-pill--transport">
                    <div className="read-aloud-play-cluster">
                      <button
                        type="button"
                        onClick={() => {
                          setFlashcardSpeakTrigger((t) => t + 1);
                          setIsSidebarOpen(false);
                        }}
                        className="read-aloud-play-btn"
                        aria-label={
                          flashcardIsSpeaking ? "Pause reading" : "Read aloud"
                        }
                        data-label={
                          flashcardIsSpeaking ? "Pause" : "Read aloud"
                        }
                      >
                        {flashcardIsSpeaking ? (
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                          </svg>
                        ) : (
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            style={{ marginLeft: "2px" }}
                          >
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        )}
                      </button>
                      {flashcardIsSpeaking && (
                        <button
                          type="button"
                          onClick={() => setFlashcardStopTrigger((t) => t + 1)}
                          className="read-aloud-action-btn"
                          aria-label="Stop reading"
                          data-label="Stop"
                        >
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M6 6h12v12H6z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {activeTool === "podcasts" && (
                  <div className="read-aloud-tool-pill read-aloud-tool-pill--transport">
                    <div className="read-aloud-play-cluster">
                      <button
                        type="button"
                        onClick={() => {
                          podcastIsPlaying
                            ? setPodcastPauseTrigger((t) => t + 1)
                            : setPodcastPlayTrigger((t) => t + 1);
                          if (!podcastIsPlaying) setIsSidebarOpen(false);
                        }}
                        className="read-aloud-play-btn"
                        aria-label={podcastIsPlaying ? "Pause" : "Play"}
                        data-label={podcastIsPlaying ? "Pause" : "Play"}
                      >
                        {podcastIsPlaying ? (
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                          </svg>
                        ) : (
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            style={{ marginLeft: "2px" }}
                          >
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        )}
                      </button>
                      {podcastIsPlaying && (
                        <button
                          type="button"
                          onClick={() => setPodcastPauseTrigger((t) => t + 1)}
                          className="read-aloud-action-btn"
                          aria-label="Stop"
                          data-label="Stop"
                        >
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M6 6h12v12H6z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {(activeTool === "summary" || activeTool === "detailed") && (
                  <ReadAloudBar
                    key={`${persona}-${activeTool}`}
                    text={typeof content === "string" ? content : ""}
                    subjectId={subjectId}
                    persona={persona}
                    onPlay={() => {
                      setIsSidebarOpen(false);
                    }}
                    onHighlightChange={(payload) =>
                      setReadingHighlight(payload)
                    }
                    activeTool={activeTool}
                    onSwitchTool={setActiveTool}
                  />
                )}
                {activeTool === "qbank" && (
                  <QBankReadAloudToolbar
                    text={qbankReadAloudText}
                    subjectId={subjectId}
                    onPlay={() => setIsSidebarOpen(false)}
                    onHighlightChange={(payload) =>
                      setReadingHighlight(payload)
                    }
                  />
                )}
              </div>
            </div>

            <div
              className={`st-mainview ${activeTool === "flashcards" || activeTool === "popquiz" ? "st-mainview--flashcards" : ""}`}
              style={{
                flex: 1,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                background:
                  activeTool === "flashcards" ||
                  activeTool === "popquiz" ||
                  activeTool === "podcasts"
                    ? "transparent"
                    : activeTool === "summary" || activeTool === "detailed"
                      ? "linear-gradient(135deg, #FFF5F8 0%, #FCE4EC 100%)"
                      : "#fff",
                borderRadius: "16px",
                border:
                  activeTool === "flashcards" ||
                  activeTool === "popquiz" ||
                  activeTool === "podcasts"
                    ? "none"
                    : activeTool === "summary" || activeTool === "detailed"
                      ? "1px solid #F8BBD0"
                      : "1px solid #E2E8F0",
                overflowX: "hidden",
                overflowY:
                  activeTool === "flashcards" ||
                  activeTool === "ask" ||
                  activeTool === "podcasts"
                    ? "hidden"
                    : "auto",
                padding:
                  activeTool === "ask"
                    ? "20px 30px 10px 30px"
                    : activeTool === "flashcards"
                      ? "0"
                      : activeTool === "popquiz"
                        ? "12px 8px"
                        : activeTool === "podcasts"
                          ? "16px 24px"
                          : "30px",
              }}
            >
              {renderContent()}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ----------------- Tool Views -----------------

// ── ReadAloudBar: Google TTS strip for text-heavy views ──────────────────────
const SUBJECT_LANG: Record<string, string> = {
  pubadm_ur: "ur-PK",
  hindi: "hi-IN",
  telugu: "te-IN",
};

function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, "")
    .replace(/#{1,6}\s*/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[>*_~`#|]/g, "")
    .replace(/---+/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function ReadAloudBar({
  text,
  subjectId,
  persona,
  onPlay,
  onHighlightChange,
  activeTool,
  onSwitchTool,
}: {
  text: string;
  subjectId: string;
  persona?: string;
  onPlay?: () => void;
  onHighlightChange?: (payload: {
    active: boolean;
    startWord: number;
    endWord: number;
  }) => void;
  activeTool?: string;
  onSwitchTool?: (tool: ToolId) => void;
}) {
  const [playbackState, setPlaybackState] = useState<
    "idle" | "playing" | "paused"
  >("idle");
  const lang = SUBJECT_LANG[subjectId] ?? "en-IN";
  const playbackRef = useRef<"idle" | "playing" | "paused">("idle");
  const cooldownRef = useRef(false);
  const cleanTextRef = useRef("");
  const wordRangesRef = useRef<{ start: number; end: number }[]>([]);
  const resumeCharRef = useRef(0);
  const lastHighlightRef = useRef<{ startWord: number; endWord: number }>({
    startWord: 0,
    endWord: 2,
  });
  const stoppedExternallyRef = useRef(false); // true = stopped by persona switch, not natural end
  const progressStorageKey = useMemo(() => {
    if (!text)
      return `read_progress_${subjectId}_${persona ?? ""}_${activeTool ?? "summary"}_empty`;
    const clean = stripMarkdown(text);
    let hash = 0;
    for (let i = 0; i < clean.length; i++) {
      hash = ((hash << 5) - hash + clean.charCodeAt(i)) | 0;
    }
    return `read_progress_${subjectId}_${persona ?? ""}_${activeTool ?? "summary"}_${Math.abs(hash)}`;
  }, [text, subjectId, activeTool, persona]);

  const setPlayback = (state: "idle" | "playing" | "paused") => {
    playbackRef.current = state;
    setPlaybackState(state);
  };

  const handlePlayPause = () => {
    if (cooldownRef.current) return;
    cooldownRef.current = true;
    setTimeout(() => {
      cooldownRef.current = false;
    }, 400);

    if (playbackRef.current === "playing") {
      googleTtsPause();
      setPlayback("paused");
      onHighlightChange?.({ active: false, startWord: -1, endWord: -1 });
    } else if (playbackRef.current === "paused") {
      googleTtsResume();
      setPlayback("playing");
      onPlay?.();
      onHighlightChange?.({
        active: true,
        startWord: Math.max(0, lastHighlightRef.current.startWord),
        endWord: Math.max(0, lastHighlightRef.current.endWord),
      });
    } else {
      const clean = stripMarkdown(text);
      if (!clean) {
        cooldownRef.current = false;
        return;
      }
      cleanTextRef.current = clean;
      const savedProgress = Number(
        localStorage.getItem(progressStorageKey) || "0",
      );
      const startChar = Number.isFinite(savedProgress)
        ? Math.max(0, Math.min(clean.length - 1, savedProgress))
        : 0;
      resumeCharRef.current = startChar;
      const ranges: { start: number; end: number }[] = [];
      const re = /\S+/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(clean)) !== null) {
        ranges.push({ start: m.index, end: m.index + m[0].length });
      }
      wordRangesRef.current = ranges;
      const getWordIndexFromChar = (charIndex: number) => {
        if (!ranges.length) return 0;
        for (let i = 0; i < ranges.length; i++) {
          if (charIndex <= ranges[i].end) return i;
        }
        return ranges.length - 1;
      };
      const startWordIdx = getWordIndexFromChar(startChar);
      googleTtsSpeak(
        clean.slice(startChar),
        lang,
        () => {
          setPlayback("playing");
          onPlay?.();
          onHighlightChange?.({
            active: true,
            startWord: Math.max(0, startWordIdx),
            endWord: Math.min(ranges.length - 1, startWordIdx + 2),
          });
          lastHighlightRef.current = {
            startWord: Math.max(0, startWordIdx),
            endWord: Math.min(ranges.length - 1, startWordIdx + 2),
          };
        },
        () => {
          // Only clear saved progress if audio ended naturally (not stopped by persona switch)
          if (!stoppedExternallyRef.current) {
            setPlayback("idle");
            localStorage.removeItem(progressStorageKey);
            resumeCharRef.current = 0;
            onHighlightChange?.({ active: false, startWord: -1, endWord: -1 });
          }
          stoppedExternallyRef.current = false;
        },
        (localCharIndex) => {
          const rangesLocal = wordRangesRef.current;
          if (!rangesLocal.length) return;
          const globalCharIndex = Math.min(
            clean.length,
            resumeCharRef.current + Math.max(0, localCharIndex),
          );
          localStorage.setItem(progressStorageKey, String(globalCharIndex));

          // Find the word at this char position using binary search
          let lo = 0,
            hi = rangesLocal.length - 1,
            idx = 0;
          while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            if (rangesLocal[mid].end < globalCharIndex) {
              lo = mid + 1;
              idx = mid;
            } else if (rangesLocal[mid].start > globalCharIndex) {
              hi = mid - 1;
            } else {
              idx = mid;
              break;
            }
          }

          // Highlight a window of 3 words centered on current position
          const windowStart = Math.max(0, idx);
          const windowEnd = Math.min(rangesLocal.length - 1, idx + 2);

          onHighlightChange?.({
            active: true,
            startWord: windowStart,
            endWord: windowEnd,
          });
          lastHighlightRef.current = {
            startWord: windowStart,
            endWord: windowEnd,
          };
        },
      );
    }
  };

  const handleStop = () => {
    if (cooldownRef.current) return;
    // Manual stop — clear saved progress so next play starts from beginning
    stoppedExternallyRef.current = false;
    googleTtsStop();
    setPlayback("idle");
    localStorage.removeItem(progressStorageKey);
    resumeCharRef.current = 0;
    onHighlightChange?.({ active: false, startWord: -1, endWord: -1 });
  };

  useEffect(() => {
    return () => {
      // Mark as externally stopped so onEnd doesn't clear saved progress
      stoppedExternallyRef.current = true;
      googleTtsStop();
    };
  }, []);

  if (!text) return null;

  return (
    <div className="read-aloud-toolbar-row">
      <div
        className="read-aloud-toolbar-split"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            handlePlayPause();
          }
          if (e.key.toLowerCase() === "s") {
            e.preventDefault();
            handleStop();
          }
        }}
        aria-label="Read aloud controls"
      >
        {onSwitchTool &&
          (activeTool === "summary" || activeTool === "detailed") && (
            <div className="read-aloud-tool-pill read-aloud-tool-pill--view">
              <button
                type="button"
                className="read-aloud-view-toggle-btn"
                data-label={
                  activeTool === "summary" ? "Detailed view" : "Summary"
                }
                aria-label={
                  activeTool === "summary"
                    ? "Switch to detailed view"
                    : "Switch to summary"
                }
                onClick={() =>
                  onSwitchTool(
                    activeTool === "summary" ? "detailed" : "summary",
                  )
                }
              >
                {activeTool === "summary" ? (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M4 6h16M4 12h10M4 18h14" />
                  </svg>
                ) : (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          )}

        <div className="read-aloud-tool-pill read-aloud-tool-pill--transport">
          <div className="read-aloud-play-cluster">
            <button
              onClick={handlePlayPause}
              className="read-aloud-play-btn"
              type="button"
              aria-label={
                playbackState === "playing" ? "Pause reading" : "Play reading"
              }
              data-label={playbackState === "playing" ? "Pause" : "Read aloud"}
            >
              {playbackState === "playing" ? (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  style={{
                    marginLeft: playbackState === "paused" ? "0" : "2px",
                  }}
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {playbackState !== "idle" && (
              <button
                onClick={handleStop}
                className="read-aloud-action-btn"
                type="button"
                aria-label="Stop reading"
                data-label="Stop"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M6 6h12v12H6z" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReadingHighlightView({
  content,
  active,
  startWord,
  endWord,
}: {
  content: string;
  active: boolean;
  startWord: number;
  endWord: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastMarkRef = useRef<HTMLElement | null>(null);
  // Pre-built map: wordIndex → { node, nodeOffset, length }
  const wordMapRef = useRef<
    Array<{ node: Text; offset: number; length: number }>
  >([]);
  const mapBuiltRef = useRef(false);

  // Build the word map once after content renders
  const buildWordMap = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    wordMapRef.current = [];
    mapBuiltRef.current = false;

    // Collect all text nodes in document order
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    let n: Text | null;
    while ((n = walker.nextNode() as Text | null)) textNodes.push(n);

    // Walk through text nodes and split into words, recording exact position
    const wordRegex = /\S+/g;
    for (const node of textNodes) {
      const text = node.textContent || "";
      let m: RegExpExecArray | null;
      wordRegex.lastIndex = 0;
      while ((m = wordRegex.exec(text)) !== null) {
        wordMapRef.current.push({ node, offset: m.index, length: m[0].length });
      }
    }
    mapBuiltRef.current = true;
  }, []);

  // Rebuild map when content changes (after MarkdownView re-renders)
  useEffect(() => {
    // Small delay to let MarkdownView finish rendering
    const timer = setTimeout(buildWordMap, 50);
    return () => clearTimeout(timer);
  }, [content, buildWordMap]);

  // Highlight the current word range
  useEffect(() => {
    if (!active) return;
    if (!mapBuiltRef.current) {
      buildWordMap();
    }

    const map = wordMapRef.current;
    if (!map.length || startWord < 0) return;

    // Remove previous mark
    if (lastMarkRef.current) {
      const m = lastMarkRef.current;
      const parent = m.parentNode;
      if (parent) {
        // Restore original text node
        const textNode = document.createTextNode(m.textContent || "");
        parent.replaceChild(textNode, m);
        parent.normalize();
        // After normalize, the map is stale — rebuild on next call
        mapBuiltRef.current = false;
      }
      lastMarkRef.current = null;
    }

    // Rebuild map if stale (after previous mark removal)
    if (!mapBuiltRef.current) buildWordMap();

    const freshMap = wordMapRef.current;
    const idx = Math.min(startWord, freshMap.length - 1);
    if (idx < 0 || idx >= freshMap.length) return;

    const startEntry = freshMap[idx];
    if (!startEntry || !startEntry.node.parentNode) return;

    // Span up to 3 words
    const endIdx = Math.min(idx + 2, freshMap.length - 1);
    const endEntry = freshMap[endIdx];

    try {
      // If all words are in the same text node, wrap them all in one mark
      if (startEntry.node === endEntry.node) {
        const range = document.createRange();
        range.setStart(startEntry.node, startEntry.offset);
        range.setEnd(endEntry.node, endEntry.offset + endEntry.length);
        const mark = document.createElement("mark");
        mark.className = "reading-mark reading-phrase-active";
        range.surroundContents(mark);
        lastMarkRef.current = mark;
        mapBuiltRef.current = false;
        mark.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } else {
        // Words span different nodes — wrap just the first word
        const range = document.createRange();
        range.setStart(startEntry.node, startEntry.offset);
        range.setEnd(startEntry.node, startEntry.offset + startEntry.length);
        const mark = document.createElement("mark");
        mark.className = "reading-mark reading-phrase-active";
        range.surroundContents(mark);
        lastMarkRef.current = mark;
        mapBuiltRef.current = false;
        mark.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    } catch {
      // surroundContents can fail if range crosses element boundaries — skip
    }
  }, [active, startWord, endWord, buildWordMap]);

  // Cleanup when inactive
  useEffect(() => {
    if (active) return;
    if (lastMarkRef.current) {
      const m = lastMarkRef.current;
      const parent = m.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(m.textContent || ""), m);
        parent.normalize();
      }
      lastMarkRef.current = null;
      mapBuiltRef.current = false;
    }
  }, [active]);

  return (
    <div ref={containerRef}>
      <MarkdownView content={content} />
    </div>
  );
}

const ASK_LANGUAGES = [
  { code: "ur-PK", label: "اردو", flag: "IN" },
  { code: "en-IN", label: "English", flag: "🇬🇧" },
  { code: "hi-IN", label: "हिन्दी", flag: "🇮🇳" },
  { code: "te-IN", label: "తెలుగు", flag: "🇮🇳" },
  { code: "or-IN", label: "ଓଡ଼ିଆ", flag: "🇮🇳" },
];

function AskBotView({
  chapterName,
  subjectId,
  chapterNumber: _chapterNumber,
  difficulty: _difficulty,
}: {
  chapterName: string;
  subjectId: string;
  chapterNumber: number;
  difficulty: DifficultyLevel;
}) {
  const chatStorageKey = useMemo(
    () => `ask_chat_${subjectId}_${_chapterNumber}_${_difficulty}`,
    [subjectId, _chapterNumber, _difficulty],
  );
  const draftStorageKey = useMemo(
    () => `ask_draft_${subjectId}_${_chapterNumber}_${_difficulty}`,
    [subjectId, _chapterNumber, _difficulty],
  );
  const [messages, setMessages] = useState<
    { role: "user" | "bot"; text: string; loading?: boolean }[]
  >(() => {
    try {
      const raw = localStorage.getItem(chatStorageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed
            .filter(
              (m: any) =>
                m &&
                typeof m.text === "string" &&
                (m.role === "user" || m.role === "bot"),
            )
            .slice(-30)
        : [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState(
    () => localStorage.getItem(draftStorageKey) || "",
  );
  const [isSending, setIsSending] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const [selectedLang, setSelectedLang] = useState(
    subjectId === "pubadm_ur" ? "ur-PK" : "en-IN",
  );
  const [, setMicError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const speechSessionRef = useRef<SpeechSession | null>(null);
  const askedViaMicRef = useRef(false);
  const [isHoldingMic, setIsHoldingMic] = useState(false);
  const [showWave, setShowWave] = useState(false);
  const [showClickWave, setShowClickWave] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [barHeights, setBarHeights] = useState<number[]>(new Array(13).fill(4));
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const waveBarRefs = useRef<(HTMLDivElement | null)[]>([]);

  // We track latest input so stopMic can grab it cleanly
  const currentInputRef = useRef("");
  useEffect(() => {
    currentInputRef.current = input;
  }, [input]);

  const isStreamingMic = hasWebSpeechSupport();

  useEffect(() => {
    // Persist chat so transient remounts don't wipe conversation.
    const cleaned = messages.filter((m) => !m.loading).slice(-30);
    localStorage.setItem(chatStorageKey, JSON.stringify(cleaned));
  }, [messages, chatStorageKey]);

  useEffect(() => {
    localStorage.setItem(draftStorageKey, input);
  }, [input, draftStorageKey]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cleanup speech session + TTS on unmount
  useEffect(() => {
    return () => {
      if (speechSessionRef.current) {
        speechSessionRef.current.stop().catch(() => {});
        speechSessionRef.current = null;
      }
      googleTtsStop();
    };
  }, []);

  const isHoldingMicRef = useRef(false);

  // ── Mic: Universal Speech-to-Text (Web Speech API + MediaRecorder fallback) ──
  const handleMicMouseDown = async (e: React.MouseEvent | React.TouchEvent) => {
    if (isTranscribing) return;
    e.preventDefault();
    isHoldingMicRef.current = true;
    setIsHoldingMic(true);
    setShowWave(true);

    // Open analyser stream for waveform (separate from speech recognition stream)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      // If user already released mic before stream opened, stop immediately
      if (!isHoldingMicRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      const AudioCtx =
        window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const bases = [
        0.4, 0.6, 0.8, 1.0, 0.9, 0.7, 1.0, 0.7, 0.9, 1.0, 0.8, 0.6, 0.4,
      ];
      const tick = () => {
        if (!analyserRef.current) return;
        analyser.getByteFrequencyData(data);
        const voiceData = Array.from(data.slice(2, 30));
        const avg = voiceData.reduce((a, b) => a + b, 0) / voiceData.length;
        const level = Math.min(1, avg / 50);
        const step = Math.max(1, Math.floor(data.length / 13));
        bases.forEach((base, i) => {
          const el = waveBarRefs.current[i];
          if (!el) return;
          let h: number;
          if (level > 0.05) {
            const slice = Array.from(data.slice(i * step, (i + 1) * step));
            const bandAvg = slice.reduce((a, b) => a + b, 0) / slice.length;
            h = Math.max(4, Math.min(60, base * (bandAvg / 100) * 60));
          } else {
            h = Math.round(base * 6);
          }
          el.style.height = `${h}px`;
        });
        animFrameRef.current = requestAnimationFrame(tick);
      };
      animFrameRef.current = requestAnimationFrame(tick);
    } catch {
      // Mic permission denied — show static bars
    }

    if (isHoldingMicRef.current) {
      await startMic();
    }
  };

  const handleMicMouseUp = async () => {
    if (!isHoldingMicRef.current) return;
    isHoldingMicRef.current = false;
    setIsHoldingMic(false);
    setShowWave(false);

    // Stop analyser
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    analyserRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    // Wait for speech session to be ready if startMic hasn't completed yet
    let waited = 0;
    while (!speechSessionRef.current && waited < 3000) {
      await new Promise((r) => setTimeout(r, 100));
      waited += 100;
    }

    await stopMic(true);
  };

  const handleAskClick = () => {
    setShowClickWave(true);
    setTimeout(() => setShowClickWave(false), 600);
    handleSendText();
  };

  const startMic = async () => {
    setMicError(null);
    try {
      console.log("Starting microphone for language:", selectedLang);
      const session = await startSpeechSession({
        language: selectedLang,
        onInterim: (text) => {
          setInput(text);
          setMicError(null); // Clear error when receiving input
        },
        onError: (err) => {
          console.warn("Speech session error:", err);
          setMicError(err);
          setIsListening(false);
        },
        onEnd: () => {
          console.log("Speech session ended");
          setIsListening(false);
        },
      });
      speechSessionRef.current = session;
      setIsListening(true);
      console.log(
        "Microphone started successfully, streaming:",
        session.isStreaming,
      );
    } catch (e: any) {
      console.error("Could not start speech session:", e);
      const errMsg =
        e.message ||
        "Could not start microphone. Please check permissions and try again.";
      setMicError(errMsg);
      setIsListening(false);
      setIsTranscribing(false);

      // Show error in chat as a bot message
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: errMsg,
        },
      ]);
    }
  };

  const stopMic = async (autoSend = false) => {
    if (!speechSessionRef.current) return;
    setIsListening(false);

    if (!isStreamingMic) {
      // MediaRecorder path: transcription happens on stop — show spinner
      setIsTranscribing(true);
    }

    let transcript = "";
    try {
      console.log("Stopping microphone and transcribing...");
      transcript = await speechSessionRef.current.stop();
      console.log("Transcription successful:", transcript);
      setMicError(null);
    } catch (e: any) {
      console.error("Transcription error:", e);
      const errMsg =
        e.message || "Could not transcribe audio. Please try again.";
      setMicError(errMsg);

      // Show error in chat
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: errMsg,
        },
      ]);
    }
    speechSessionRef.current = null;

    setIsTranscribing(false);

    // Web Speech API often misses the final word in its return string. We fall back to the live input ref safely.
    const finalTranscript =
      transcript || (isStreamingMic ? currentInputRef.current : "");

    if (finalTranscript) {
      setInput(finalTranscript);
      if (autoSend) {
        askedViaMicRef.current = true;
        handleSend(finalTranscript);
      }
    } else if (!finalTranscript && !isStreamingMic) {
      setInput("");
    }
  };

  // ── TTS: Google Translate TTS for bot answers ──
  const cleanForSpeech = (text: string): string => {
    return text
      .replace(/#{1,6}\s*/g, "")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/```[\s\S]*?```/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[>*_~`#]/g, "")
      .replace(/⚠️|📖|📚|💙|🚫|🙏|👋/g, "")
      .replace(/---+/g, "")
      .trim();
  };

  const speakText = (text: string, msgIndex: number) => {
    const cleanText = cleanForSpeech(text);
    if (!cleanText) return;

    // Toggle off if already speaking this message
    if (speakingIdx === msgIndex) {
      googleTtsStop();
      setSpeakingIdx(null);
      return;
    }

    googleTtsSpeak(
      cleanText,
      selectedLang,
      () => setSpeakingIdx(msgIndex),
      () => setSpeakingIdx(null),
    );
  };

  const stopSpeech = () => {
    googleTtsStop();
    setSpeakingIdx(null);
  };

  // Auto-read bot response when question was asked via mic
  useEffect(() => {
    if (!askedViaMicRef.current) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.role === "bot" && !lastMsg.loading && lastMsg.text) {
      askedViaMicRef.current = false;
      const idx = messages.length - 1;
      setTimeout(() => speakText(lastMsg.text, idx), 300);
    }
  }, [messages]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Send question ──
  const handleSend = async (question: string) => {
    if (!question.trim() || isSending) return;

    // Stop mic if listening
    if (isListening && speechSessionRef.current) {
      speechSessionRef.current.stop().catch(() => {});
      speechSessionRef.current = null;
      setIsListening(false);
    }

    const userMsg = question.trim();
    setIsSending(true);
    setInput("");

    // Add user message + bot loading placeholder
    setMessages((prev) => [
      ...prev,
      { role: "user", text: userMsg },
      { role: "bot", text: "", loading: true },
    ]);

    try {
      const result = await askGemini(
        userMsg,
        subjectId,
        chapterName,
        _chapterNumber,
        _difficulty,
        selectedLang,
      );
      // Replace the loading placeholder with the real answer
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "bot", text: result.answer };
        return updated;
      });
    } catch (err: any) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "bot",
          text: `⚠️ Sorry, I could not connect to the AI. ${err?.message || "Please check your internet connection and try again."}`,
        };
        return updated;
      });
      console.error("Ask Gemini failed:", err);
    } finally {
      setIsSending(false);
    }
  };

  const handleSendText = () => handleSend(input);

  return (
    <div
      className="ask-bot-view"
      role="region"
      aria-label="Ask AI Assistant"
      style={{ position: "relative" }}
    >
      {/* Voice wave overlay — covers the whole ask view when mic held */}
      {showWave && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,255,255,0.92)",
            backdropFilter: "blur(10px)",
            zIndex: 20,
            borderRadius: "12px",
            gap: "16px",
            pointerEvents: "none",
          }}
        >
          <div className="voice-wave-container">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((_, i) => (
              <div
                key={i}
                className="voice-wave-bar"
                ref={(el) => {
                  waveBarRefs.current[i] = el;
                }}
                style={{ height: "4px" }}
              />
            ))}
          </div>
          <span
            style={{ fontSize: "0.95rem", color: "#7c3aed", fontWeight: 700 }}
          >
            🎙️ Listening… speak now
          </span>
        </div>
      )}
      <div className="ask-header">
        <div className="ask-header-row">
          <div>
            {!isStreamingMic && (
              <p
                style={{ fontSize: "0.85em", color: "#666", marginTop: "4px" }}
              >
                🦊 Firefox Mode: Audio will be transcribed when you stop
                recording
              </p>
            )}
          </div>
          <div className="mic-top-center">
            <button
              className={`btn-mic-top ${isListening ? "recording" : ""} ${isTranscribing ? "transcribing" : ""} ${isHoldingMic ? "holding" : ""}`}
              onPointerDown={(e) => {
                e.preventDefault();
                handleMicMouseDown(e as any);
              }}
              onPointerUp={() => handleMicMouseUp()}
              onPointerLeave={() => {
                if (isHoldingMicRef.current) handleMicMouseUp();
              }}
              disabled={isSending || isTranscribing}
              title={
                isListening
                  ? "Stop and send"
                  : isTranscribing
                    ? "Transcribing…"
                    : "Start voice input (press and hold)"
              }
              aria-label={
                isListening
                  ? "Stop listening and send"
                  : isTranscribing
                    ? "Transcribing audio"
                    : "Start voice input (press and hold)"
              }
            >
              {isTranscribing ? "⏳" : isListening ? "⏹️" : "🎙️"}
            </button>
          </div>
          <div className="lang-selector">
            <label htmlFor="ask-lang">🌐</label>
            <select
              id="ask-lang"
              value={selectedLang}
              onChange={(e) => setSelectedLang(e.target.value)}
            >
              {ASK_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.flag} {l.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <div
        className="ask-chat-window"
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
      >
        {messages.length === 0 && (
          <div className="chat-placeholder">
            <p>
              👋 Hi there! I'm Saral Vidhya, your academic tutor for NCERT Class
              10 English. We're currently looking at "A Letter to God."
            </p>
            <p
              style={{ fontSize: "0.85em", opacity: 0.7, marginTop: "0.5rem" }}
            >
              How can I help you today? Do you have any questions about the
              chapter, its themes, characters, or anything else related to your
              studies? Feel free to ask! 😊
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`chat-bubble ${m.role}`}
            role="article"
            aria-label={m.role === "user" ? "Your question" : "AI response"}
          >
            {m.loading ? (
              <div
                className="chat-text"
                style={{
                  fontSize: "1.2rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
                aria-label="AI is thinking"
              >
                <span
                  className="gear-spin"
                  style={{ display: "inline-block", fontSize: "1.8rem" }}
                >
                  ⚙️
                </span>{" "}
                <span style={{ opacity: 0.8 }}>Generating answer...</span>
              </div>
            ) : m.role === "bot" ? (
              <>
                <div className="chat-text bot-markdown" dir="auto">
                  <MarkdownView content={m.text} />
                </div>
                <div className="tts-controls">
                  {speakingIdx !== i ? (
                    <button
                      className="btn-tts"
                      onClick={() => speakText(m.text, i)}
                      title="Read aloud"
                      aria-label="Read this answer aloud"
                    >
                      ▶
                    </button>
                  ) : (
                    <button
                      className="btn-tts speaking"
                      onClick={stopSpeech}
                      title="Stop reading"
                      aria-label="Stop reading"
                    >
                      ⏹
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="chat-text" dir="auto">
                {m.text}
              </div>
            )}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
      <div className="ask-input-area">
        <input
          type="text"
          className="ask-question-input"
          placeholder={
            isTranscribing
              ? "Transcribing your speech…"
              : isListening
                ? isStreamingMic
                  ? "Listening… click ⏹ to stop and send"
                  : "Recording… click ⏹ to stop and transcribe"
                : "Type your question…"
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSendText();
            }
          }}
          disabled={isSending}
          aria-label="Question input"
        />
        <button
          className={`btn-send ${showClickWave ? "wave-active" : ""}`}
          onClick={handleAskClick}
          disabled={isSending || !input.trim()}
          aria-label="Send question"
        >
          {isSending ? "..." : "Ask"}
        </button>
      </div>
      {(isListening || isTranscribing) && (
        <div className="listening-indicator" aria-live="assertive">
          {isTranscribing ? (
            <>
              <span className="pulse-dot transcribing"></span> Transcribing your
              speech… please wait
            </>
          ) : isStreamingMic ? (
            <>
              <span className="pulse-dot"></span> Listening… speak now, then
              click ⏹ to stop &amp; send
            </>
          ) : (
            <>
              <span className="pulse-dot recording"></span> Recording… click ⏹
              to stop and transcribe (works in all browsers)
            </>
          )}
        </div>
      )}
    </div>
  );
}

function PodcastsView({
  chapterName,
  subjectId,
  chapterNumber,
  persona,
  autoPlay,
  resumeTrack,
  onPlayingChange,
  playTrigger,
  pauseTrigger,
}: {
  chapterName: string;
  subjectId: string;
  chapterNumber: number;
  persona: string;
  autoPlay?: boolean;
  resumeTrack?: string;
  onPlayingChange?: (playing: boolean) => void;
  playTrigger?: number;
  pauseTrigger?: number;
}) {
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [available, setAvailable] = useState<boolean | null>(null); // null = checking

  const getSavedTrack = (): "long" | "short" => {
    if (resumeTrack === "long" || resumeTrack === "short") return resumeTrack;
    const saved = localStorage.getItem(
      `last_track_${subjectId}_${chapterNumber}_${persona}`,
    );
    return saved === "long" || saved === "short" ? saved : "short";
  };

  const [selectedTrack, setSelectedTrack] = useState<"long" | "short">(
    getSavedTrack(),
  );

  useEffect(() => {
    localStorage.setItem(
      `last_track_${subjectId}_${chapterNumber}_${persona}`,
      selectedTrack,
    );
  }, [selectedTrack, subjectId, chapterNumber, persona]);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isHoldingMic, setIsHoldingMic] = useState(false);
  const [showWave, setShowWave] = useState(false);
  const [showClickWave, setShowClickWave] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(true);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const transcriptBoxRef = useRef<HTMLDivElement>(null);
  const [transcriptVisible, setTranscriptVisible] = useState(false);

  const transcriptTokens = useMemo(() => {
    if (!transcript) return [] as string[];
    return transcript.split(/(\s+|[.,!?;:]+)/g).filter(Boolean);
  }, [transcript]);

  const wordTimings = useMemo(() => {
    if (!transcriptTokens.length)
      return {
        totalWeight: 0,
        wordWeights: [] as number[],
        wordIndexes: [] as number[],
      };

    let cumulativeChars = 0;
    const wordWeights: number[] = [];
    const wordIndexes: number[] = [];

    for (let i = 0; i < transcriptTokens.length; i++) {
      const token = transcriptTokens[i];
      const isWord = token.trim() !== "" && !/^[.,!?;:]+$/.test(token);

      if (isWord) {
        // Pure character count makes TTS sync much more accurate since reading speed is roughly constant in chars/sec
        cumulativeChars += token.length;
        wordWeights.push(cumulativeChars);
        wordIndexes.push(i);
      } else {
        // Equivalent pause lengths in "characters" (assuming ~15 chars/sec reading speed)
        if (token.includes(".")) cumulativeChars += 12;
        else if (token.includes("?")) cumulativeChars += 12;
        else if (token.includes("!")) cumulativeChars += 12;
        else if (token.includes(",")) cumulativeChars += 6;
        else if (token.includes(";")) cumulativeChars += 8;
        else if (token.includes(":")) cumulativeChars += 8;
        else if (token.includes("\n\n"))
          cumulativeChars += 20; // paragraph pause
        else if (token.includes("\n")) cumulativeChars += 10;
        else cumulativeChars += token.length; // standard spaces
      }
    }

    // Add start and end silence buffer (TTS usually has a brief pause at start/end)
    const START_SILENCE_CHARS = 10;
    const totalWeight = cumulativeChars + START_SILENCE_CHARS + 15;

    const shiftedWeights = wordWeights.map((w) => w + START_SILENCE_CHARS);

    return { totalWeight, wordWeights: shiftedWeights, wordIndexes };
  }, [transcriptTokens]);

  const { activeWordIdx, activeWordSet, activeTokenStart, activeTokenEnd } =
    useMemo(() => {
      if (
        !transcript ||
        !audioDuration ||
        wordTimings.wordIndexes.length === 0 ||
        currentTime < 0
      ) {
        return {
          activeWordIdx: -1,
          activeWordSet: new Set<number>(),
          activeTokenStart: -1,
          activeTokenEnd: -1,
        };
      }

      const clampedTime = Math.min(currentTime, audioDuration);
      const progress = clampedTime / audioDuration;

      const targetWeight = progress * wordTimings.totalWeight;

      let wordIdx = 0;
      for (let i = 0; i < wordTimings.wordWeights.length; i++) {
        if (wordTimings.wordWeights[i] >= targetWeight) {
          wordIdx = i;
          break;
        }
      }

      const t1 = wordTimings.wordIndexes[Math.max(0, wordIdx)];
      const t2 =
        wordTimings.wordIndexes[
          Math.min(wordIdx + 1, wordTimings.wordIndexes.length - 1)
        ];
      const t3 =
        wordTimings.wordIndexes[
          Math.min(wordIdx + 2, wordTimings.wordIndexes.length - 1)
        ];
      const startToken = Math.min(t1, t2, t3);
      const endToken = Math.max(t1, t2, t3);

      return {
        activeWordIdx: wordIdx,
        activeWordSet: new Set([t1, t2, t3].filter((x) => x !== undefined)),
        activeTokenStart: startToken,
        activeTokenEnd: endToken,
      };
    }, [transcript, audioDuration, currentTime, wordTimings]);

  // Auto-scroll transcript when active word or phrase changes
  useEffect(() => {
    if (!transcriptBoxRef.current) return;

    let targetElement: HTMLElement | null = null;

    // First try to find phrase highlighting (takes precedence)
    const phraseActive = transcriptBoxRef.current.querySelector(
      ".transcript-phrase-active",
    );
    if (phraseActive) {
      targetElement = phraseActive as HTMLElement;
    } else {
      // Fall back to word highlighting
      const activeWords = transcriptBoxRef.current.querySelectorAll(
        ".transcript-word.active",
      );
      if (activeWords.length > 0) {
        targetElement = activeWords[0] as HTMLElement;
      }
    }

    if (targetElement) {
      // Use scrollIntoView with block center for smooth scrolling
      targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeWordIdx, activeTokenStart]); // Include both word and phrase changes

  const chapterPad = String(chapterNumber).padStart(2, "0");
  const basePath = `/generated_resources/${subjectId}/chapter_${chapterPad}/podcasts`;
  const lessonId = `${subjectId}_ch${chapterNumber}_${persona}_${selectedTrack}`;
  const userId = localStorage.getItem("app_user_id") || "anonymous";

  // Memoize metadata so it doesn't trigger useEffect on every timeupdate re-render
  const metadata = useMemo(
    () => ({
      subjectId,
      chapterNumber,
      chapterName,
      persona,
      track: selectedTrack,
    }),
    [subjectId, chapterNumber, chapterName, persona, selectedTrack],
  );

  useAudioProgress(
    userId,
    lessonId,
    audioRef,
    available === true,
    metadata,
    setCurrentTime,
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || available !== true) return;

    const savedData = localStorage.getItem(
      `audio_progress_${userId}_${lessonId}`,
    );
    if (!savedData) return;

    try {
      const parsed = JSON.parse(savedData) as AudioProgress;
      if (parsed.currentTime > 0) {
        const seekAudio = () => {
          if (!audio) return;
          audio.currentTime = parsed.currentTime;
          setCurrentTime(parsed.currentTime);
        };

        if (audio.readyState >= 1) {
          seekAudio();
        } else {
          audio.addEventListener("loadedmetadata", seekAudio, { once: true });
        }
      }
    } catch (error) {
      console.warn("Failed to restore local audio progress:", error);
    }
  }, [available, lessonId, userId]);

  /** Resolve filenames per subject naming convention */
  const getFileNames = (track: "long" | "short") => {
    if (subjectId === "pubadm_ur") {
      return {
        audio:
          track === "long"
            ? `${basePath}/podcast_long.m4a`
            : `${basePath}/podcast_short.mp3`,
        transcript: `${basePath}/transcript_${track}.md`,
      };
    }
    if (subjectId === "science") {
      // Chapters 1–3 have persona-aware subfolders with .mp3 files
      if (chapterNumber <= 3) {
        // Map persona key → label used in filename
        // Note: intermediate files use "Moderate" not "Intermediate"
        const personaLabel: Record<string, string> = {
          beginner: "Beginner",
          intermediate: "Moderate",
          advanced: "Advanced",
        };
        const label = personaLabel[persona] ?? "Moderate";
        const trackLabel = track === "long" ? "Long" : "Short";
        const base = `${basePath}/${persona}/Science_Chapter${chapterNumber}_${label}_${trackLabel}`;
        return { audio: `${base}.mp3`, transcript: `${base}.txt` };
      }
      // Chapters 4+ use the older flat naming (no persona, .m4a)
      const base = `${basePath}/Science_Chapter_${chapterPad}_${track}`;
      return { audio: `${base}.m4a`, transcript: `${base}.txt` };
    }
    if (subjectId === "english") {
      // Chapters 1–3 have persona-aware subfolders with .mp3 files
      if (chapterNumber <= 3) {
        const personaLabel: Record<string, string> = {
          beginner: "Beginner",
          intermediate: "Moderate",
          advanced: "Advanced",
        };
        const label = personaLabel[persona] ?? "Moderate";
        const trackLabel = track === "long" ? "Long" : "Short";
        const base = `${basePath}/${persona}/English_Chapter_${chapterNumber}_${label}_${trackLabel}`;
        return { audio: `${base}.mp3`, transcript: `${base}.txt` };
      }
      // Chapters 4+ use the older flat naming (no persona, .m4a)
      const base = `${basePath}/ch${chapterNumber}-${track}`;
      return { audio: `${base}.m4a`, transcript: `${base}.txt` };
    }
    // any other subject
    const base = `${basePath}/ch${chapterNumber}-${track}`;
    return { audio: `${base}.m4a`, transcript: `${base}.txt` };
  };

  const tracks = {
    long: { label: "Long Podcast", desc: "In-depth Chapter Coverage" },
    short: { label: "Short Podcast", desc: "Brief Recap of Key Points" },
  };

  // ── Check availability once per chapter/subject change ──
  useEffect(() => {
    setAvailable(null);
    const { audio } = getFileNames("short");
    fetch(audio, { method: "HEAD" })
      .then((res) => {
        const ct = res.headers.get("content-type") || "";
        setAvailable(res.ok && !ct.includes("text/html"));
      })
      .catch(() => setAvailable(false));
  }, [subjectId, chapterNumber, persona]);

  const isTrackMount = useRef(true);
  // ── Reset player when track selection changes ──
  useEffect(() => {
    if (isTrackMount.current) {
      isTrackMount.current = false;
      return;
    }
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      setIsPlaying(false);
      onPlayingChange?.(false);
      setAudioDuration(0);
      audio.load();
    }
  }, [selectedTrack]);

  // ── Reset player when persona changes ──
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      setIsPlaying(false);
      onPlayingChange?.(false);
      setCurrentTime(0);
      setAudioDuration(0);
    }
  }, [persona]);

  // ── Audio event listeners ──
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => {
      if (autoPlay) {
        audio.play().catch((e) => console.warn("Auto-play prevented:", e));
      }
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("seeked", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("seeked", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
    };
  }, [selectedTrack, autoPlay]);

  // ── Load transcript when track or availability changes ──
  useEffect(() => {
    if (!available) return;
    setTranscript(null);
    setTranscriptVisible(false); // Reset visibility so observer re-triggers
    const { transcript: tFile } = getFileNames(selectedTrack);
    fetch(tFile)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.text();
      })
      .then((t) => setTranscript(t))
      .catch(() => setTranscript(null));
  }, [selectedTrack, available, subjectId, chapterNumber, persona]);

  // ── Lazy-reveal transcript when scrolled into view ──
  useEffect(() => {
    if (transcriptVisible) return; // already visible, no need to re-observe
    const el = transcriptRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTranscriptVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [available, transcriptVisible]);

  const handlePlay = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.play().catch((e) => console.warn("Play failed:", e));
      // State update handled by the 'play' event listener
    }
  };
  const handlePause = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      // State update handled by the 'pause' event listener
    }
  };

  // Sync playing state to parent when audio events fire
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onPlay = () => {
      setIsPlaying(true);
      onPlayingChange?.(true);
    };
    const onPause = () => {
      setIsPlaying(false);
      onPlayingChange?.(false);
    };
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      onPlayingChange?.(false);
    };
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }, [onPlayingChange]);

  // React to external play trigger
  useEffect(() => {
    if (!playTrigger) return;
    handlePlay();
  }, [playTrigger]);

  // React to external pause trigger
  useEffect(() => {
    if (!pauseTrigger) return;
    handlePause();
  }, [pauseTrigger]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = t;
      setCurrentTime(t);
    }
  };

  const fmtTime = (s: number, fallback = "0:00") => {
    if (s === undefined || s === null || isNaN(s) || !isFinite(s))
      return fallback;
    const m = Math.floor(s / 60);
    const sec = String(Math.floor(s % 60)).padStart(2, "0");
    return `${m}:${sec}`;
  };

  const progressPct = audioDuration ? (currentTime / audioDuration) * 100 : 0;

  // ── Loading state ──
  if (available === null) {
    return (
      <div className="podcasts-view">
        <p className="loading-state">Checking podcast availability…</p>
      </div>
    );
  }

  // ── Coming Soon ──
  if (!available) {
    return (
      <div className="podcasts-view">
        <div
          className="card"
          style={{ padding: "48px", textAlign: "center", marginTop: "20px" }}
        >
          <span style={{ fontSize: "3.5rem" }}>🎧</span>
          <h3 style={{ margin: "16px 0 8px", color: "var(--text)" }}>
            Coming Soon
          </h3>
          <p style={{ color: "var(--text-secondary)" }}>
            Podcasts for <strong>{chapterName}</strong> haven't been uploaded
            yet.
            <br />
            Check back soon!
          </p>
        </div>
      </div>
    );
  }

  const currentFiles = getFileNames(selectedTrack);

  return (
    <div className="podcasts-view">
      {/* ── Fixed top section: track selector + player ── */}
      <div className="podcast-sticky-top">
        {/* Track selector */}
        <div className="podcast-track-selector">
          {(["short", "long"] as const).map((t) => (
            <div
              key={t}
              className={`podcast-track-card card ${selectedTrack === t ? "active" : ""}`}
              onClick={() => setSelectedTrack(t)}
            >
              <span className="track-icon">{t === "short" ? "⚡" : "📖"}</span>
              <div className="track-info">
                <strong>{tracks[t].label}</strong>
                <span className="track-desc">{tracks[t].desc}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Audio Player */}
        <div className="podcast-player-real">
          <audio
            ref={audioRef}
            src={currentFiles.audio}
            preload="auto"
            onLoadedMetadata={(e) => {
              const d = (e.target as HTMLAudioElement).duration;
              if (d && isFinite(d)) setAudioDuration(d);
            }}
            onDurationChange={(e) => {
              const d = (e.target as HTMLAudioElement).duration;
              if (d && isFinite(d)) setAudioDuration(d);
            }}
          />

          {/* Single row: current | bar | total */}
          <div className="player-row">
            <span className="player-time current">{fmtTime(currentTime)}</span>

            <div className="player-bar-wrap">
              <div
                className="player-bar-fill"
                style={{ width: `${progressPct}%` }}
              />
              <input
                type="range"
                min={0}
                max={audioDuration || 0}
                step={0.5}
                value={currentTime}
                onChange={handleSeek}
                className="seek-slider"
                aria-label="Seek"
              />
            </div>

            <span className="player-time total">
              {audioDuration ? fmtTime(audioDuration) : "--:--"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Scrollable transcript ── */}
      <div className="podcast-transcript-scroll" ref={transcriptRef}>
        <div className="transcript-toggle">
          <h4>Transcript</h4>
          {transcript && (
            <button
              className="btn-transcript-toggle"
              onClick={() => setShowTranscript(!showTranscript)}
            >
              {showTranscript ? "Hide" : "Show"}
            </button>
          )}
        </div>
        {!transcriptVisible && (
          <div
            style={{
              height: "48px",
              display: "flex",
              alignItems: "center",
              color: "var(--text-secondary)",
              fontSize: "0.85rem",
              opacity: 0.6,
            }}
          >
            Scroll down to load transcript…
          </div>
        )}
        {transcriptVisible && transcript === null && (
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            No transcript available.
          </p>
        )}
        {transcriptVisible && showTranscript && transcript && (
          <div
            className="transcript-box transcript-body"
            ref={transcriptBoxRef}
          >
            {transcriptTokens.map((token, idx) => {
              if (activeTokenStart >= 0 && idx === activeTokenStart) {
                const grouped = transcriptTokens
                  .slice(activeTokenStart, activeTokenEnd + 1)
                  .join("");
                return (
                  <span key={`grp-${idx}`} className="transcript-phrase-active">
                    {grouped}
                  </span>
                );
              }
              if (
                activeTokenStart >= 0 &&
                idx > activeTokenStart &&
                idx <= activeTokenEnd
              )
                return null;
              const isWord = token.trim() !== "" && !/^[.,!?;:]+$/.test(token);
              return (
                <span
                  key={idx}
                  className={
                    isWord && activeWordSet.has(idx)
                      ? "transcript-word active"
                      : undefined
                  }
                >
                  {token}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function PYQView({
  subjectName,
  subjectId,
}: {
  subjectName: string;
  subjectId: string;
}) {
  let availableYears: string[] = [];

  if (subjectId === "pubadm_ur") {
    availableYears = [
      "2015",
      "2016",
      "2017",
      "2018",
      "2019",
      "2020",
      "2021",
      "2022",
      "2023",
      "2024",
    ];
  } else if (subjectId === "science") {
    availableYears = ["2024", "2025"];
  } else if (subjectId === "english") {
    availableYears = ["2024", "2025"];
  }

  const [selectedYear, setSelectedYear] = useState("");

  // Auto-select first year on mount or subject change
  useEffect(() => {
    if (subjectId === "pubadm_ur") setSelectedYear("2015");
    else if (subjectId === "science") setSelectedYear("2024");
    else if (subjectId === "english") setSelectedYear("2024");
    else setSelectedYear("");
  }, [subjectId]);

  let pdfUrl = "";
  if (subjectId === "pubadm_ur") {
    pdfUrl = `/generated_resources/${subjectId}/pyq/${selectedYear}/question_paper.pdf`;
  } else if (subjectId === "science") {
    pdfUrl =
      selectedYear === "2024"
        ? `/generated_resources/science/pyq/2024/31_2_2_Science.pdf`
        : `/generated_resources/science/pyq/2025/31-6-1_Science.pdf`;
  } else if (subjectId === "english") {
    pdfUrl =
      selectedYear === "2024"
        ? `/generated_resources/english/pyq/2024/2_3_2_English%20L%20&%20L.pdf`
        : `/generated_resources/english/pyq/2025/2-1-1_English%20Language%20and%20Literature.pdf`;
  }

  const [isPdfAvailable, setIsPdfAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    if (!selectedYear) return;
    setIsPdfAvailable(null); // Switch to loading state

    fetch(pdfUrl, { method: "HEAD" })
      .then((res) => {
        const contentType = res.headers.get("content-type");
        // Vite / SPA servers return 200 OK + index.html (text/html) for missing static files
        if (res.ok && contentType && !contentType.includes("text/html")) {
          setIsPdfAvailable(true);
        } else {
          setIsPdfAvailable(false);
        }
      })
      .catch(() => {
        setIsPdfAvailable(false);
      });
  }, [pdfUrl, selectedYear]);

  if (availableYears.length === 0) {
    return (
      <div className="pyq-view">
        <div
          className="card"
          style={{ padding: "40px", textAlign: "center", marginTop: "20px" }}
        >
          <span style={{ fontSize: "3rem", opacity: 0.5 }}>📄</span>
          <p style={{ marginTop: "1rem" }}>
            No previous year question papers available for this subject.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="pyq-view">
      {/* Compact header: title on the left, controls on the right */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "16px",
        }}
      >
        <div
          className="pyq-year-selector"
          style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}
        >
          {availableYears.map((year) => (
            <button
              key={year}
              onClick={() => setSelectedYear(year)}
              className={`pyq-year-btn ${selectedYear === year ? "active" : ""}`}
            >
              {year}
            </button>
          ))}
        </div>
        <div className="pyq-controls" style={{ display: "flex", gap: "8px" }}>
          <select
            disabled
            style={{
              padding: "8px 16px",
              borderRadius: "12px",
              background: "#f8fafc",
              border: "1.5px solid #e2e8f0",
              fontSize: "0.85rem",
              fontWeight: 600,
              color: "#64748b",
            }}
          >
            <option>{subjectName}</option>
          </select>
        </div>
      </div>

      <div
        className="pdf-viewer card"
        style={{
          height: "calc(100vh - 220px)",
          minHeight: "500px",
          padding: 0,
          overflow: "hidden",
          borderRadius: "12px",
        }}
      >
        {isPdfAvailable === null ? (
          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <p
              className="opacity-70"
              style={{ fontWeight: 600, color: "var(--text-secondary)" }}
            >
              Checking document availability...
            </p>
          </div>
        ) : isPdfAvailable ? (
          <iframe
            src={`${pdfUrl}#toolbar=1&navpanes=1&scrollbar=1`}
            width="100%"
            height="100%"
            style={{ border: "none" }}
            title={`Question Paper ${selectedYear}`}
          />
        ) : (
          <div
            style={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--surface)",
            }}
          >
            <span
              style={{ fontSize: "4rem", opacity: 0.4, marginBottom: "16px" }}
            >
              📄🚫
            </span>
            <h3 style={{ margin: 0, color: "var(--text)", fontSize: "1.4rem" }}>
              No Document Available
            </h3>
            <p
              style={{
                color: "var(--text-secondary)",
                opacity: 0.8,
                marginTop: "8px",
                fontWeight: 500,
              }}
            >
              The question paper PDF for the year {selectedYear} hasn't been
              uploaded yet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function VideosView({
  chapterName: _chapterName,
  subjectId,
  chapterNumber,
  youtubeLinksContent,
}: {
  chapterName: string;
  subjectId: string;
  chapterNumber: number;
  youtubeLinksContent?: string | null;
}) {
  const [activeVideo, setActiveVideo] = useState(0);

  // Hard-coded videos for subjects/chapters that have real embeds
  let videos: { title: string; ytId: string }[] = [];
  if (subjectId === "pubadm_ur" && chapterNumber === 1) {
    videos = [
      { title: "Video Lecture Part 1", ytId: "zudAdjtoraA" },
      { title: "Video Lecture Part 2", ytId: "LEfMH2SNznY" },
      { title: "Video Lecture Part 3", ytId: "vb9N0S158GA" },
      { title: "Video Lecture Part 4", ytId: "Q9Xe-usGEVE" },
    ];
  }

  // Dynamically parse YouTube IDs from youtu.be or youtube.com URLs in the markdown content
  if (videos.length === 0 && youtubeLinksContent) {
    const ytRegex =
      /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/g;
    let match;
    let idx = 1;
    while ((match = ytRegex.exec(youtubeLinksContent)) !== null) {
      videos.push({ title: `Video ${idx++}`, ytId: match[1] });
    }
  }

  // If we have embeddable videos, show the player
  if (videos.length > 0) {
    const robustActive = activeVideo >= videos.length ? 0 : activeVideo;
    const currentVideo = videos[robustActive];
    return (
      <div
        className="videos-view"
        style={{
          display: "flex",
          gap: "12px",
          height: "100%",
          alignItems: "flex-start",
        }}
      >
        {/* Left: video tile list — 10% width */}
        <div
          className="video-tiles"
          style={{
            width: "10%",
            minWidth: "80px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            overflowY: "auto",
            maxHeight: "56.25vw" /* roughly match iframe height */,
            flexShrink: 0,
          }}
        >
          {videos.map((vid, i) => (
            <div
              key={i}
              className={`video-tile card ${robustActive === i ? "active" : ""}`}
              onClick={() => setActiveVideo(i)}
              style={{
                cursor: "pointer",
                padding: "6px",
                border:
                  robustActive === i
                    ? "2px solid var(--primary)"
                    : "2px solid transparent",
                borderRadius: "8px",
              }}
            >
              <div
                className="video-thumbnail"
                style={{
                  height: "48px",
                  background: "#e0e0e0",
                  borderRadius: "6px",
                  overflow: "hidden",
                  marginBottom: "4px",
                }}
              >
                <img
                  src={`https://img.youtube.com/vi/${vid.ytId}/default.jpg`}
                  alt="thumbnail"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    opacity: robustActive === i ? 1 : 0.7,
                  }}
                />
              </div>
              <p
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 500,
                  margin: 0,
                  lineHeight: 1.3,
                  wordBreak: "break-word",
                }}
              >
                {vid.title}
              </p>
            </div>
          ))}
        </div>

        {/* Right: iframe player — 90% width */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="video-player-container"
            style={{
              position: "relative",
              paddingBottom: "56.25%",
              height: 0,
              overflow: "hidden",
              borderRadius: "12px",
              background: "#000",
            }}
          >
            <iframe
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                border: 0,
              }}
              src={`https://www.youtube.com/embed/${currentVideo.ytId}?rel=0&modestbranding=1`}
              title="YouTube video player"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      </div>
    );
  }

  // For english/science: show youtube_links.md content as markdown guidance
  if (youtubeLinksContent && youtubeLinksContent !== "Content not available.") {
    return (
      <div className="videos-view">
        <div
          className="card"
          style={{
            padding: "4px 8px",
            marginBottom: "16px",
            background: "var(--primary-light)",
            borderRadius: "10px",
            borderLeft: "4px solid var(--primary)",
          }}
        >
          <p
            style={{
              margin: "8px 0",
              fontSize: "0.9rem",
              color: "var(--primary)",
              fontWeight: 600,
            }}
          >
            🎥 No embedded videos yet — use these curated search queries on
            YouTube to find the best lessons for this chapter.
          </p>
        </div>
        <div className="markdown-container">
          <MarkdownView content={youtubeLinksContent} />
        </div>
      </div>
    );
  }

  // Fallback: nothing available
  return (
    <div className="videos-view">
      <div
        className="card"
        style={{ padding: "40px", textAlign: "center", marginTop: "20px" }}
      >
        <span style={{ fontSize: "3rem", opacity: 0.5 }}>🎥</span>
        <p style={{ marginTop: "1rem" }}>
          No video content is currently available for this chapter.
        </p>
      </div>
    </div>
  );
}

function PopQuizView({
  markdownContent,
  subjectId,
  chapterNumber,
  onQuit,
}: {
  markdownContent: string;
  subjectId: string;
  chapterNumber: number;
  onQuit: () => void;
}) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [showQuitModal, setShowQuitModal] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [hoveredOption, setHoveredOption] = useState<number | null>(null);
  // Track which steps had an answer selected
  const [answered, setAnswered] = useState<boolean[]>([]);

  useEffect(() => {
    setLoading(true);
    try {
      const parsed = parseQuestionBank(markdownContent);
      if (!parsed || parsed.length === 0) {
        console.warn("No questions parsed from markdown content");
        setQuestions([]);
        setLoading(false);
        return;
      }
      const shuffled = parsed.sort(() => 0.5 - Math.random()).slice(0, 5);
      setQuestions(shuffled);
      setStep(0);
      setSelected(null);
      setScore(0);
      setIsFinished(false);
      setAnswered(new Array(shuffled.length).fill(false));
    } catch (err) {
      console.error("Error parsing questions:", err);
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }, [markdownContent]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isFinished || loading || showQuitModal || showExplanation) return;

      if (e.key === "ArrowLeft") {
        handlePrevious();
      } else if (e.key === "ArrowRight") {
        // If question answered, go next. If not, maybe skip?
        // Typically users expect next on right arrow.
        if (selected !== null) handleNext();
        else handleSkip();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    step,
    selected,
    isFinished,
    loading,
    showQuitModal,
    showExplanation,
    questions.length,
  ]);

  const handleNext = () => {
    setShowExplanation(false);
    if (step < questions.length - 1) {
      setStep(step + 1);
      setSelected(null);
      setHoveredOption(null);
    } else {
      setIsFinished(true);
    }
  };

  const handleSelect = (idx: number) => {
    if (selected !== null) return;
    setSelected(idx);
    setAnswered((prev) => {
      const next = [...prev];
      next[step] = true;
      return next;
    });
    setHoveredOption(null);
    const isCorrect = idx === questions[step].answer;
    if (isCorrect) setScore((s) => s + 1);
    // Show explanation popup if wrong answer
    if (!isCorrect) {
      setShowExplanation(true);
    }
    // Auto-submit when user answers last question
    if (step === questions.length - 1) {
      const finalScore = isCorrect ? score + 1 : score;
      setTimeout(() => {
        setIsFinished(true);
        const pct = Math.round((finalScore / questions.length) * 100);
        localStorage.setItem(
          `ekam_quiz_score_${subjectId}_${chapterNumber}`,
          pct.toString(),
        );
      }, 800);
    }
  };

  const handlePrevious = () => {
    if (step > 0) {
      setStep(step - 1);
      setSelected(null);
      setHoveredOption(null);
      setShowExplanation(false);
    }
  };

  const handleSkip = () => {
    if (step < questions.length - 1) {
      setStep(step + 1);
      setSelected(null);
      setHoveredOption(null);
      setShowExplanation(false);
    } else {
      setIsFinished(true);
    }
  };

  const renderText = (text: string) => {
    return <MarkdownView content={text} />;
  };

  // Calculate stats for quit modal
  const attemptedCount = answered.filter(Boolean).length;
  const notAttemptedCount = questions.length - attemptedCount;

  return (
    <>
      {/* Loading State */}
      {loading || questions.length === 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            gap: "24px",
            color: "#64748b",
          }}
        >
          <div
            style={{ fontSize: "48px", animation: "spin 1s linear infinite" }}
          >
            ⚡
          </div>
          <div style={{ fontSize: "18px", fontWeight: "600" }}>
            {loading ? "Loading Quiz..." : "No questions available"}
          </div>
          {!loading && questions.length === 0 && (
            <button
              onClick={onQuit}
              style={{
                padding: "10px 20px",
                borderRadius: "8px",
                border: "none",
                background: "var(--primary)",
                color: "#fff",
                cursor: "pointer",
                fontWeight: "600",
              }}
            >
              Go Back
            </button>
          )}
        </div>
      ) : isFinished ? (
        // Finished state
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            gap: "20px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "64px" }}>🎉</div>
          <div
            style={{ fontSize: "24px", fontWeight: "800", color: "#1e1b4b" }}
          >
            Quiz Complete!
          </div>
          <div
            style={{
              fontSize: "48px",
              fontWeight: "800",
              color: "var(--primary)",
            }}
          >
            {Math.round((score / questions.length) * 100)}%
          </div>
          <div style={{ fontSize: "16px", color: "#64748b" }}>
            You got {score} out of {questions.length} correct
          </div>
          <button
            onClick={onQuit}
            style={{
              padding: "12px 28px",
              borderRadius: "20px",
              border: "none",
              background: "linear-gradient(135deg, #7c3aed, #ec4899)",
              color: "#fff",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "16px",
              marginTop: "12px",
            }}
          >
            Continue
          </button>
        </div>
      ) : (
        // Quiz Content
        <>
          {/* Quit modal */}
          {showQuitModal && (
            <div className="quiz-quit-overlay">
              <div className="quiz-quit-modal card">
                <h3 style={{ margin: "0 0 16px", fontSize: "1.3rem" }}>
                  Quit Quiz?
                </h3>
                <div className="quiz-quit-stats">
                  <div className="quit-stat-item attempted">
                    <span className="quit-stat-num">{attemptedCount}</span>
                    <span className="quit-stat-label">Attempted</span>
                  </div>
                  <div className="quit-stat-divider" />
                  <div className="quit-stat-item skipped">
                    <span className="quit-stat-num">{notAttemptedCount}</span>
                    <span className="quit-stat-label">Not Attempted</span>
                  </div>
                </div>
                <p
                  style={{
                    color: "var(--text-secondary)",
                    fontSize: "0.9rem",
                    margin: "16px 0 0",
                    textAlign: "center",
                  }}
                >
                  Your progress so far will not be saved.
                </p>
                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    marginTop: "20px",
                    justifyContent: "center",
                  }}
                >
                  <button
                    className="quiz-btn-secondary"
                    onClick={() => setShowQuitModal(false)}
                  >
                    Continue Quiz
                  </button>
                  <button className="quiz-btn-danger" onClick={onQuit}>
                    Quit &amp; Exit
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Wrong answer popup */}
          {showExplanation &&
            selected !== null &&
            selected !== questions[step].answer && (
              <div
                className="quiz-quit-overlay"
                onClick={() => setShowExplanation(false)}
              >
                <div
                  className="quiz-explanation-modal card"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className="quiz-modal-close"
                    onClick={() => setShowExplanation(false)}
                    type="button"
                    aria-label="Close"
                  >
                    ×
                  </button>
                  <h4
                    className="wrong-heading"
                    style={{ margin: "0 0 14px 0" }}
                  >
                    ❌ Incorrect
                  </h4>
                  <p style={{ marginBottom: "10px", margin: "0 0 10px 0" }}>
                    <strong>Correct Answer:</strong>{" "}
                    <span style={{ color: "#16a34a", fontWeight: 700 }}>
                      {questions[step]?.options[questions[step]?.answer] || ""}
                    </span>
                  </p>
                  <p
                    style={{
                      color: "#334155",
                      lineHeight: 1.65,
                      margin: 0,
                      fontSize: "0.95rem",
                    }}
                  >
                    {questions[step]?.explanation &&
                    questions[step].explanation !== "No explanation provided."
                      ? questions[step].explanation
                      : (() => {
                          const q = questions[step]?.q || "";
                          const ans =
                            questions[step]?.options[questions[step]?.answer] ||
                            "";
                          // Build a 2-3 line contextual explanation
                          return `The correct answer is "${ans}". ${q.endsWith("?") ? q.slice(0, -1) : q} — the answer can be found in the chapter text. Re-read the relevant section to understand why "${ans}" is correct.`;
                        })()}
                  </p>
                  <div style={{ display: "flex", marginTop: "20px" }}>
                    <button
                      className="quiz-btn-primary"
                      onClick={() => {
                        setShowExplanation(false);
                        handleNext();
                      }}
                      style={{ flex: 1 }}
                    >
                      Next Question ➔
                    </button>
                  </div>
                </div>
              </div>
            )}

          {/* Outer layout: quit button beside the card */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "center",
              gap: "12px",
              width: "100%",
              maxHeight: "100%",
            }}
          >
            {/* Quiz card */}
            <div
              className="quiz-card popquiz-view"
              style={{
                width: "100%",
                maxWidth: "620px",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                margin: 0,
                maxHeight: "100%",
              }}
            >
              {/* Scrollable content: question + options + answer feedback */}
              <div style={{ overflowY: "auto", paddingBottom: "4px" }}>
                {/* Content area */}
                <div className="quiz-q">
                  {renderText(questions[step]?.q || "")}
                </div>

                {/* Options */}
                <div className="quiz-options">
                  {questions[step]?.options?.map((option, idx) => {
                    const isSelected = selected === idx;
                    const isHovered = hoveredOption === idx;
                    const isCorrectAnswer = idx === questions[step].answer;
                    const optionClass = `option-${idx % 4}`;
                    const resultClass =
                      selected !== null
                        ? isCorrectAnswer
                          ? "correct"
                          : isSelected
                            ? "wrong"
                            : ""
                        : "";

                    return (
                      <button
                        key={idx}
                        className={`quiz-opt ${optionClass} ${isSelected ? "selected" : ""} ${isHovered ? "hovered" : ""} ${resultClass}`}
                        onClick={() => handleSelect(idx)}
                        onMouseEnter={() =>
                          selected === null && setHoveredOption(idx)
                        }
                        onMouseLeave={() => setHoveredOption(null)}
                        disabled={selected !== null}
                      >
                        <span className="opt-letter">
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <span className="option-text">
                          {renderText(option)}
                        </span>
                        {isCorrectAnswer && selected !== null && (
                          <span
                            className="correct-indicator"
                            style={{ color: "#16a34a" }}
                          >
                            ✓
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Correct answer inline — only when correct */}
                {selected !== null && selected === questions[step].answer && (
                  <div
                    style={{
                      marginTop: "10px",
                      padding: "8px 14px",
                      borderRadius: "10px",
                      background: "linear-gradient(135deg, #f0fdf4, #dcfce7)",
                      border: "1.5px solid #4ade80",
                      fontSize: "0.88rem",
                      color: "#166534",
                      lineHeight: 1.5,
                    }}
                  >
                    ✅ <strong>Correct!</strong>{" "}
                    {questions[step]?.explanation &&
                    questions[step].explanation !== "No explanation provided."
                      ? questions[step].explanation
                      : `"${questions[step]?.options[questions[step]?.answer] || ""}" is the right answer for this question.`}
                  </div>
                )}
              </div>

              {/* Footer — always visible at bottom */}
              <div
                className="quiz-nav"
                style={{
                  flexShrink: 0,
                  paddingTop: "12px",
                  borderTop: "1px solid rgba(236, 72, 153, 0.12)",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: "16px",
                }}
              >
                <button
                  className="quiz-icon-btn previous"
                  onClick={handlePrevious}
                  disabled={step === 0}
                  title="Previous"
                  type="button"
                >
                  ←
                </button>
                <button
                  className="quiz-icon-btn skip"
                  onClick={handleSkip}
                  title="Skip"
                  type="button"
                  style={{ fontSize: "1rem", width: "44px", height: "44px" }}
                >
                  ⏭
                </button>
                <span
                  style={{
                    fontSize: "1rem",
                    fontWeight: 700,
                    color: "#8b5cf6",
                    minWidth: "44px",
                    textAlign: "center",
                  }}
                >
                  {step + 1}/{questions.length}
                </span>
                <button
                  className="quiz-icon-btn next"
                  onClick={handleNext}
                  disabled={step === questions.length - 1 && selected === null}
                  title="Next"
                  type="button"
                >
                  →
                </button>
              </div>
            </div>

            {/* Quit button — beside the card */}
            <button
              className="quiz-icon-btn quit"
              onClick={() => setShowQuitModal(true)}
              title="Quit Quiz"
              type="button"
              style={{
                width: "40px",
                height: "40px",
                fontSize: "1rem",
                flexShrink: 0,
                marginTop: "4px",
              }}
            >
              ❌
            </button>
          </div>
        </>
      )}
    </>
  );
}

function SwotView({ subjectId }: { subjectId: string; chapterNumber: number }) {
  const [swot, setSwot] = useState({
    s: [] as string[],
    w: [] as string[],
    o: [] as string[],
    t: [] as string[],
  });

  useEffect(() => {
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const opportunities: string[] = [];
    const threats: string[] = [];

    // Assuming a max of 5 chapters for this MVP demo
    const maxChapters = 5;

    for (let i = 1; i <= maxChapters; i++) {
      const timeKey = `ekam_time_${subjectId}_${i}`;
      const timeSpent = parseInt(localStorage.getItem(timeKey) || "0", 10);
      const scoreKey = `ekam_quiz_score_${subjectId}_${i}`;
      const scoreRaw = localStorage.getItem(scoreKey);
      const score = scoreRaw ? parseInt(scoreRaw, 10) : null;

      const chapterName = `Chapter ${i}`;

      if (score !== null) {
        if (score >= 60) strengths.push(chapterName);
        else weaknesses.push(chapterName);
      } else if (timeSpent > 120) {
        // Spent over 2 minutes but took no quiz -> still a strength in reading
        strengths.push(chapterName);
      } else {
        opportunities.push(chapterName);
      }

      if (timeSpent > 0 && timeSpent < 10 && score !== null) {
        threats.push(
          `${chapterName} completed suspiciously fast (${timeSpent}s). Possible skimming evasion.`,
        );
      }
    }

    setSwot({ s: strengths, w: weaknesses, o: opportunities, t: threats });
  }, [subjectId]);

  return (
    <div className="swot-view" style={{ padding: "20px" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "20px",
          marginTop: "20px",
        }}
      >
        <div className="card swot-card">
          <h3 style={{ color: "#4caf50" }}>💪 Strengths</h3>
          {swot.s.length > 0 ? (
            <ul>
              {swot.s.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          ) : (
            <p className="opacity-70">Read more chapters and take quizzes.</p>
          )}
        </div>
        <div className="card swot-card">
          <h3 style={{ color: "#ff9800" }}>⚠️ Weaknesses</h3>
          {swot.w.length > 0 ? (
            <ul>
              {swot.w.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          ) : (
            <p className="opacity-70">No weaknesses yet! Great job.</p>
          )}
        </div>
        <div className="card swot-card">
          <h3 style={{ color: "#2196f3" }}>🚀 Opportunities</h3>
          {swot.o.length > 0 ? (
            <ul>
              {swot.o.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          ) : (
            <p className="opacity-70">You've covered all the curriculum!</p>
          )}
        </div>
        <div className="card swot-card">
          <h3 style={{ color: "#f44336" }}>🚨 Threats</h3>
          {swot.t.length > 0 ? (
            <ul>
              {swot.t.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          ) : (
            <p className="opacity-70">Your study patterns look healthy.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function LeaderboardView({ subjectId }: { subjectId: string }) {
  const [users, setUsers] = useState<
    { name: string; points: number; isMe: boolean }[]
  >([]);

  useEffect(() => {
    const dummyUsers = [
      { name: "Rahul Sharma", points: 850, isMe: false },
      { name: "Aisha Khan", points: 920, isMe: false },
      { name: "Tariq Ali", points: 640, isMe: false },
      { name: "Sneha Reddy", points: 710, isMe: false },
      { name: "Rohan Patel", points: 530, isMe: false },
    ];

    let myTotalPoints = 0;
    // Sum points from storage
    for (let i = 1; i <= 15; i++) {
      const scoreKey = `ekam_quiz_score_${subjectId}_${i}`;
      const scoreRaw = localStorage.getItem(scoreKey);
      if (scoreRaw) myTotalPoints += parseInt(scoreRaw, 10);
    }

    // Scale points to make it equivalent to dummy user points (e.g., 10x multiplier per percentage point)
    myTotalPoints = myTotalPoints * 5;

    // Combine and sort
    const all = [
      ...dummyUsers,
      { name: "You (Student)", points: myTotalPoints, isMe: true },
    ];
    all.sort((a, b) => b.points - a.points);
    setUsers(all);
  }, [subjectId]);

  return (
    <div className="leaderboard-view" style={{ padding: "20px" }}>
      <h3 style={{ marginBottom: "16px" }}>🏆 Leaderboard</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {users.map((u, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              background: u.isMe ? "#e8f0fe" : "var(--surface)",
              border: u.isMe
                ? "2px solid var(--primary)"
                : "1px solid var(--border)",
              borderRadius: "10px",
              padding: "10px 16px",
              fontWeight: u.isMe ? 700 : 400,
            }}
          >
            <span
              style={{
                width: "24px",
                fontWeight: 700,
                color:
                  i === 0
                    ? "#FFD700"
                    : i === 1
                      ? "#C0C0C0"
                      : i === 2
                        ? "#CD7F32"
                        : "var(--text-secondary)",
              }}
            >
              {i + 1}
            </span>
            <span style={{ flex: 1 }}>
              {u.name}
              {u.isMe ? " (You)" : ""}
            </span>
            <span style={{ color: "var(--primary)", fontWeight: 700 }}>
              {u.points} pts
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
