import { useEffect, useState, useCallback } from 'react';

const POMODORO_MINS = 25;
const SECS_PER_MIN = 60;

interface PomodoroTimerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PomodoroTimer({ isOpen, onClose }: PomodoroTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState(POMODORO_MINS * SECS_PER_MIN);
  const [isRunning, setIsRunning] = useState(false);

  const totalSecs = POMODORO_MINS * SECS_PER_MIN;
  const progress = ((totalSecs - secondsLeft) / totalSecs) * 100;

  useEffect(() => {
    if (!isOpen) {
      setSecondsLeft(totalSecs);
      setIsRunning(false);
    }
  }, [isOpen, totalSecs]);

  useEffect(() => {
    if (!isRunning || secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [isRunning, secondsLeft]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const display = `${mins}:${secs.toString().padStart(2, '0')}`;

  const reset = useCallback(() => {
    setSecondsLeft(totalSecs);
    setIsRunning(false);
  }, [totalSecs]);

  if (!isOpen) return null;

  return (
    <div className="pomodoro-overlay" role="dialog" aria-label="Pomodoro timer">
      <div className="pomodoro-modal">
        <button type="button" className="pomodoro-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h3 className="pomodoro-title">Focus session</h3>
        <p className="pomodoro-duration">{POMODORO_MINS} minutes</p>
        <div className="pomodoro-time">{display}</div>
        <div className="pomodoro-progress-bar">
          <div className="pomodoro-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="pomodoro-actions">
          <button type="button" className="btn-pomodoro-toggle" onClick={() => setIsRunning((r) => !r)}>
            {isRunning ? 'Pause' : 'Start'}
          </button>
          <button type="button" className="btn-pomodoro-reset" onClick={reset}>
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
