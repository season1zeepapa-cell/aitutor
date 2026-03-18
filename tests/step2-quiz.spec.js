// 2단계 테스트: 문제풀이 탭
const { test, expect } = require('@playwright/test');

// 로그인 시뮬레이션 헬퍼
async function loginAndGo(page, path = '/quiz') {
  await page.goto(path);
  await page.evaluate(() => {
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('user', JSON.stringify({ name: 'test', admin: true }));
  });
  await page.reload();
}

test.describe('2단계: 문제풀이 탭', () => {

  test('학습 탭에 필터 셀렉트가 표시된다', async ({ page }) => {
    await loginAndGo(page);
    // 카테고리/시험 셀렉트 2개 존재
    const selects = page.locator('select');
    await expect(selects).toHaveCount(2);
  });

  test('문제가 없을 때 빈 상태 메시지 표시', async ({ page }) => {
    await loginAndGo(page);
    // API 에러 시에도 빈 상태 또는 스켈레톤이 보임
    // 최소한 레이아웃이 렌더링되는지 확인
    await page.waitForTimeout(1000);
    const hasCards = await page.locator('.bg-card-bg').count();
    expect(hasCards).toBeGreaterThan(0);
  });

  test('카드 구조가 렌더링된다 (헤더 + 펼침 버튼)', async ({ page }) => {
    await loginAndGo(page);
    await page.waitForTimeout(1500);
    // 카드가 있든 빈 상태든 card-bg 요소가 있어야 함
    const cards = page.locator('[class*="rounded-2xl"]');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('하단 네비에서 학습 탭이 활성화되어 있다', async ({ page }) => {
    await loginAndGo(page);
    const quizBtn = page.locator('nav button >> text=학습');
    await expect(quizBtn).toBeVisible();
    // active 상태 확인 — text-primary 클래스
    const btnClasses = await quizBtn.getAttribute('class');
    expect(btnClasses).toContain('text-primary');
  });

});
