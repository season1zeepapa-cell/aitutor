// 계정 탈퇴 API — 사용자 본인의 모든 데이터 삭제
const { query } = require('./db');
const { withAuth } = require('./middleware');

module.exports = withAuth(async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST 요청만 허용됩니다.' });
  }

  const { confirm } = req.body || {};
  if (confirm !== '탈퇴합니다') {
    return res.status(400).json({ error: '"탈퇴합니다"를 정확히 입력해주세요.' });
  }

  const userId = req.user.uid;
  if (!userId) {
    return res.status(400).json({ error: '사용자 정보를 확인할 수 없습니다.' });
  }

  try {
    // 관련 데이터 삭제 (외래키 순서)
    await query('DELETE FROM memo_files WHERE memo_id IN (SELECT id FROM question_memos WHERE user_id = $1)', [userId]);
    await query('DELETE FROM question_memos WHERE user_id = $1', [userId]);
    await query('DELETE FROM bookmarks WHERE user_id = $1', [userId]);
    await query('DELETE FROM exam_results WHERE user_id = $1', [userId]);

    // 사용자 삭제
    await query('DELETE FROM public.users WHERE id = $1', [userId]);

    console.log(`[Auth] 계정 탈퇴: uid=${userId} (${req.user.name})`);

    // 쿠키 제거
    const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL;
    res.setHeader('Set-Cookie', [
      `token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${isProduction ? '; Secure' : ''}`,
    ]);

    res.json({ message: '계정이 삭제되었습니다.' });
  } catch (err) {
    console.error('[Auth] 계정 탈퇴 오류:', err.message);
    res.status(500).json({ error: '계정 삭제 중 오류가 발생했습니다.' });
  }
});
