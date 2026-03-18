// 5단계 테스트: 설정 + 최종 마무리
const { test, expect } = require('@playwright/test');

async function loginAndGo(page, path) {
  await page.goto(path);
  await page.evaluate(() => {
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('user', JSON.stringify({ name: 'test', admin: true }));
  });
  await page.reload();
}

test.describe('5단계: 설정 + 최종', () => {

  test('설정 탭에 서브탭이 표시된다', async ({ page }) => {
    await loginAndGo(page, '/settings');
    await expect(page.getByRole('heading', { name: '설정' })).toBeVisible();
    await expect(page.locator('button >> text=카테고리')).toBeVisible();
    await expect(page.locator('button >> text=AI 설정')).toBeVisible();
  });

  test('카테고리 관리 섹션이 렌더링된다', async ({ page }) => {
    await loginAndGo(page, '/settings');
    await expect(page.locator('text=카테고리 관리')).toBeVisible();
    await expect(page.locator('input[placeholder="새 카테고리명"]')).toBeVisible();
  });

  test('AI 설정 섹션으로 전환 가능', async ({ page }) => {
    await loginAndGo(page, '/settings');
    await page.getByRole('button', { name: 'AI 설정' }).click();
    await expect(page.locator('text=AI 모델 설정')).toBeVisible();
    await expect(page.locator('text=Gemini').first()).toBeVisible();
    await expect(page.locator('text=OpenAI').first()).toBeVisible();
    await expect(page.locator('text=Claude').first()).toBeVisible();
  });

  test('전체 앱 빌드가 성공한다', async ({ page }) => {
    // 모든 탭 순회하며 렌더링 에러 확인
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await loginAndGo(page, '/quiz');
    await page.waitForTimeout(500);
    await page.locator('nav button >> text=관리').click();
    await page.waitForTimeout(500);
    await page.locator('nav button >> text=연동').click();
    await page.waitForTimeout(500);
    await page.locator('nav button >> text=설정').click();
    await page.waitForTimeout(500);

    const critical = errors.filter(e => !e.includes('fetch') && !e.includes('ECONNREFUSED') && !e.includes('NetworkError'));
    expect(critical).toHaveLength(0);
  });

  test('전체 Vite 빌드 성공', async ({}) => {
    const { execSync } = require('child_process');
    const result = execSync('cd /Users/2team/aifac/workspace/aitutor && npm run build:fe 2>&1', { encoding: 'utf8' });
    expect(result).toContain('built in');
  });

});
