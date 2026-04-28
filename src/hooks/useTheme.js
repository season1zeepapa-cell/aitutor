// 다크모드 토글 훅 — 시스템 설정 자동 감지 + 수동 전환
import { useState, useEffect } from 'react';

export default function useTheme() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // 시스템 다크모드 변경 감지 — 사용자가 수동 설정하지 않았으면 자동 따라감
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => {
      // 사용자가 수동으로 테마를 바꾼 적이 없으면 시스템 설정을 따름
      const manual = localStorage.getItem('theme_manual');
      if (!manual) setTheme(e.matches ? 'dark' : 'light');
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const toggleTheme = () => {
    localStorage.setItem('theme_manual', 'true'); // 수동 전환 표시
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return { theme, toggleTheme };
}
