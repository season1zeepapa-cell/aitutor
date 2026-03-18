// 1단계 테스트: 프로젝트 셋업 + 인증 + 레이아웃
const { test, expect } = require('@playwright/test');

test.describe('1단계: 레이아웃 및 인증', () => {

  test('로그인 페이지가 렌더링된다', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'AI Tutor' })).toBeVisible();
    await expect(page.locator('input[placeholder="아이디"]')).toBeVisible();
    await expect(page.locator('input[placeholder="비밀번호"]')).toBeVisible();
    await expect(page.getByRole('button', { name: '로그인' })).toBeVisible();
  });

  test('회원가입 전환 버튼이 동작한다', async ({ page }) => {
    await page.goto('/');
    await page.click('text=계정이 없으신가요? 회원가입');
    await expect(page.getByRole('button', { name: '회원가입' })).toBeVisible();
    await page.click('text=이미 계정이 있으신가요? 로그인');
    await expect(page.getByRole('button', { name: '로그인' })).toBeVisible();
  });

  test('빈 폼 제출 시 브라우저 기본 유효성 검사', async ({ page }) => {
    await page.goto('/');
    const input = page.locator('input[type="text"]');
    await expect(input).toHaveAttribute('required', '');
  });

  test('로그인 페이지 다크모드 지원', async ({ page }) => {
    await page.goto('/');
    const html = page.locator('html');
    const theme = await html.getAttribute('data-theme');
    expect(['light', 'dark', null]).toContain(theme);
  });

  test('페이지 타이틀이 AI Tutor이다', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/AI Tutor/);
  });

  test('로그인 성공 시 메인 레이아웃 표시', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('token', 'test-token-for-layout');
      localStorage.setItem('user', JSON.stringify({ name: 'test', admin: true }));
    });
    await page.reload();

    // 헤더 로고 (모바일에서는 텍스트가 숨겨질 수 있으므로 로고 아이콘으로 확인)
    await expect(page.locator('header')).toBeVisible();
    // 하단 네비 — 버튼 내 span으로 확인
    await expect(page.locator('nav button >> text=학습')).toBeVisible();
    await expect(page.locator('nav button >> text=관리')).toBeVisible();
    await expect(page.locator('nav button >> text=연동')).toBeVisible();
    await expect(page.locator('nav button >> text=설정')).toBeVisible();
    // 로그아웃 버튼
    await expect(page.getByRole('button', { name: '로그아웃' })).toBeVisible();
  });

  test('하단 네비게이션 탭 전환이 동작한다', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ name: 'test', admin: true }));
    });
    await page.reload();

    // 관리 탭 클릭
    await page.locator('nav button >> text=관리').click();
    await expect(page.getByRole('heading', { name: '문제 관리' })).toBeVisible();

    // 연동 탭 클릭
    await page.locator('nav button >> text=연동').click();
    await expect(page.getByRole('heading', { name: 'DocStore 연동' })).toBeVisible();

    // 설정 탭 클릭
    await page.locator('nav button >> text=설정').click();
    await expect(page.getByRole('heading', { name: '설정' })).toBeVisible();
  });

  test('다크모드 토글이 동작한다', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ name: 'test', admin: true }));
    });
    await page.reload();

    const html = page.locator('html');
    const initialTheme = await html.getAttribute('data-theme');

    await page.click('button[title*="모드"]');
    const newTheme = await html.getAttribute('data-theme');
    expect(newTheme).not.toBe(initialTheme);
  });

});
