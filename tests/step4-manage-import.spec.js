// 4단계 테스트: 문제관리 + DocStore 연동
const { test, expect } = require('@playwright/test');

async function loginAndGo(page, path) {
  await page.goto(path);
  await page.evaluate(() => {
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('user', JSON.stringify({ name: 'test', admin: true }));
  });
  await page.reload();
}

test.describe('4단계: 문제관리 + DocStore 연동', () => {

  test('문제관리 탭에 필터와 추가 버튼이 렌더링된다', async ({ page }) => {
    await loginAndGo(page, '/manage');
    await expect(page.getByRole('heading', { name: '문제 관리' })).toBeVisible();
    await expect(page.locator('text=+ 문제 추가')).toBeVisible();
    const selects = page.locator('select');
    const count = await selects.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('DocStore 연동 탭에 칸반 + 도구가 렌더링된다', async ({ page }) => {
    await loginAndGo(page, '/import');
    await expect(page.getByRole('heading', { name: 'DocStore 연동' })).toBeVisible();
    // 3단계 라벨 확인
    await expect(page.locator('text=1.대상조회')).toBeVisible();
    // 처리 로그 확인
    await expect(page.locator('text=처리 로그')).toBeVisible();
  });

  test('칸반 전체 접기/펼치기 버튼이 동작한다', async ({ page }) => {
    await loginAndGo(page, '/import');
    const toggleBtn = page.locator('text=전체 접기');
    await expect(toggleBtn).toBeVisible();
    await toggleBtn.click();
    await expect(page.locator('text=전체 펼치기')).toBeVisible();
  });

  test('문제관리에서 문제추가 모달이 열린다', async ({ page }) => {
    await loginAndGo(page, '/manage');
    await page.locator('text=+ 문제 추가').click();
    await expect(page.locator('text=문제 추가').first()).toBeVisible();
    // 폼 필드 확인
    await expect(page.locator('textarea[placeholder*="문제 본문"]')).toBeVisible();
  });

});
