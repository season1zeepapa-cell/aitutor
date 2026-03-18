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

  test('문제관리 탭에 필터와 목록 영역이 렌더링된다', async ({ page }) => {
    await loginAndGo(page, '/manage');
    await expect(page.getByRole('heading', { name: '문제 관리' })).toBeVisible();
    const selects = page.locator('select');
    await expect(selects).toHaveCount(2);
  });

  test('DocStore 연동 탭에 칸반 보드가 렌더링된다', async ({ page }) => {
    await loginAndGo(page, '/import');
    await expect(page.getByRole('heading', { name: 'DocStore 연동' })).toBeVisible();
    // 3단계 표시 확인
    await expect(page.locator('text=대상조회').first()).toBeVisible();
    await expect(page.locator('text=문제이관').first()).toBeVisible();
    await expect(page.locator('text=해설생성 및 완료').first()).toBeVisible();
    // 소스 시험 선택 셀렉트 확인
    await expect(page.locator('select')).toBeVisible();
  });

  test('칸반 전체 접기/펼치기 버튼이 동작한다', async ({ page }) => {
    await loginAndGo(page, '/import');
    const toggleBtn = page.locator('text=전체 접기');
    await expect(toggleBtn).toBeVisible();
    await toggleBtn.click();
    await expect(page.locator('text=전체 펼치기')).toBeVisible();
  });

  test('문제관리에서 문항 수 표시', async ({ page }) => {
    await loginAndGo(page, '/manage');
    // "0문항" 또는 "N문항" 텍스트가 표시
    await page.waitForTimeout(1000);
    const text = await page.locator('body').textContent();
    expect(text).toContain('문항');
  });

});
