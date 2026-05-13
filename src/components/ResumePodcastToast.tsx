import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { GlobalAudioProgress } from '@/hooks/useAudioProgress';
import './ResumePodcastToast.css';

export default function ResumePodcastToast() {
  const [resumeData, setResumeData] = useState<GlobalAudioProgress | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkGlobalProgress = async () => {
      const userId = localStorage.getItem('app_user_id') || 'anonymous';
      let progress: GlobalAudioProgress | null = null;

      // 1. Check local storage first
      const localDataStr = localStorage.getItem(`global_last_podcast_${userId}`);
      if (localDataStr) {
        try {
          progress = JSON.parse(localDataStr);
        } catch (e) {
          console.error(e);
        }
      }

      // 2. Check Firestore (authoritative)
      if (userId && userId !== 'anonymous') {
        try {
          const docRef = doc(db, 'global_podcast_progress', `user_${userId}`);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const cloudProgress = docSnap.data() as GlobalAudioProgress;
            if (!progress || cloudProgress.updatedAt > progress.updatedAt) {
              progress = cloudProgress;
              localStorage.setItem(`global_last_podcast_${userId}`, JSON.stringify(progress));
            }
          }
        } catch (error) {
          console.warn('Failed to fetch global progress from Firestore.', error);
        }
      }

      if (progress && progress.currentTime > 0 && progress.wasPaused) {
        setResumeData(progress);
        setIsVisible(true);
      }
    };

    checkGlobalProgress();
  }, []);

  if (!isVisible || !resumeData) return null;

  const handleResume = () => {
    setIsVisible(false);
    const { subjectId, chapterNumber, chapterName, persona, track } = resumeData;
    
    // Build navigation URL exactly as ClassSubjectSelection does
    const baseParams = `cId=${subjectId}&className=Resumed&sId=${subjectId}&subjectName=${encodeURIComponent(subjectId)}`;
    
    navigate(`/chapters?${baseParams}&persona=${persona}`, {
      state: { 
        autoPlayPodcast: true,
        resumeTrack: track,
        chapterNumber,
        chapterName
      }
    });
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsVisible(false);
  };

  return (
    <div className="sv-resume-toast" onClick={handleResume}>
      <div className="sv-resume-icon">🎧</div>
      <div className="sv-resume-content">
        <h4>Welcome back!</h4>
        <p>Continue listening to <strong>{resumeData.chapterName || `Chapter ${resumeData.chapterNumber}`}</strong></p>
      </div>
      <button className="sv-resume-close" onClick={handleDismiss} aria-label="Dismiss">✕</button>
    </div>
  );
}
