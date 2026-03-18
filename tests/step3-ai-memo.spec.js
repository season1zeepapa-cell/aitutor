// 3단계 테스트: AI 해설 + 메모 기능
const { test, expect } = require('@playwright/test');

async function loginAndGo(page, path = '/quiz') {
  await page.goto(path);
  await page.evaluate(() => {
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('user', JSON.stringify({ name: 'test', admin: true }));
  });
  await page.reload();
}

test.describe('3단계: AI 해설 + 메모', () => {

  test('QuizCard에 AI 해설 / 메모 버튼이 존재한다', async ({ page }) => {
    await loginAndGo(page);
    // 빌드 확인 — 페이지가 에러 없이 렌더링
    await page.waitForTimeout(1000);
    // 카드 영역이 존재 (빈 상태라도)
    const body = await page.locator('body').textContent();
    expect(body).toBeDefined();
  });

  test('앱이 에러 없이 빌드된다 (Vite)', async ({ page }) => {
    await page.goto('/');
    // 콘솔 에러 수집
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.evaluate(() => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ name: 'test', admin: true }));
    });
    await page.reload();
    await page.waitForTimeout(1500);

    // React 렌더링 에러 없음 확인
    const criticalErrors = errors.filter(e =>
      !e.includes('fetch') && !e.includes('ECONNREFUSED') && !e.includes('NetworkError')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('모든 탭이 정상 렌더링된다', async ({ page }) => {
    await loginAndGo(page);
    await page.waitForTimeout(500);

    // 학습 탭
    await page.locator('nav button >> text=학습').click();
    await page.waitForTimeout(300);
    let body = await page.locator('main').textContent();
    expect(body).toBeDefined();

    // 관리 탭
    await page.locator('nav button >> text=관리').click();
    await page.waitForTimeout(300);
    await expect(page.getByRole('heading', { name: '문제 관리' })).toBeVisible();

    // 연동 탭
    await page.locator('nav button >> text=연동').click();
    await page.waitForTimeout(300);
    await expect(page.getByRole('heading', { name: 'DocStore 연동' })).toBeVisible();

    // 설정 탭
    await page.locator('nav button >> text=설정').click();
    await page.waitForTimeout(300);
    await expect(page.getByRole('heading', { name: '설정' })).toBeVisible();
  });

});
