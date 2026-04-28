// KISA 드릴 — SRS/통계 조회 공용 React Hook
// 여러 컴포넌트(Dashboard, Stats)에서 재사용.
// 로딩 상태 관리 + refresh 함수 제공.
import { useState, useEffect, useCallback } from 'react';
import { apiGet } from '../lib/api';

export function useKisaStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiGet('/api/kisa-review?action=stats');
      setStats(data);
    } catch (e) {
      setError(e.message);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { stats, loading, error, refresh };
}

export function useKisaReviewQueue(limit = 20) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiGet(`/api/kisa-review?action=queue&limit=${limit}`);
      setItems(data.items || []);
    } catch (e) {
      setError(e.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { items, loading, error, refresh };
}
