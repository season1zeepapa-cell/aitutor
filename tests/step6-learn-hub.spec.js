// 6단계 테스트: 학습 허브 + 랜덤 학습 + 카드 학습
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

test.describe('6-1: 학습 허브 (LearnHub)', () => {

  test('/quiz 접속 시 학습 허브가 렌더링된다', async ({ page }) => {
    await loginAndGo(page, '/quiz');
    // 대시보드 통계 카드 3개 (카테고리, 시험, 문제수)
    await expect(page.getByText('카테고리', { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('시험', { exact: true })).toBeVisible();
    await expect(page.getByText('문제수', { exact: true })).toBeVisible();
  });

  test('학습 유형 제목이 표시된다', async ({ page }) => {
    await loginAndGo(page, '/quiz');
    await expect(page.getByText('학습 유형')).toBeVisible({ timeout: 5000 });
  });

  test('학습 유형 카드 3개가 표시된다', async ({ page }) => {
    await loginAndGo(page, '/quiz');
    await expect(page.getByText('카테고리 학습')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('랜덤 학습')).toBeVisible();
    await expect(page.getByText('카드 학습')).toBeVisible();
  });

  test('카테고리 학습 클릭 시 /quiz/category로 이동', async ({ page }) => {
    await loginAndGo(page, '/quiz');
    await page.getByText('카테고리 학습').click();
    await expect(page).toHaveURL(/\/quiz\/category/);
    // QuizTab의 필터 셀렉트가 표시됨
    const selects = page.locator('select');
    await expect(selects.first()).toBeVisible({ timeout: 5000 });
  });

  test('랜덤 학습 클릭 시 /quiz/random으로 이동', async ({ page }) => {
    await loginAndGo(page, '/quiz');
    await page.getByText('랜덤 학습').click();
    await expect(page).toHaveURL(/\/quiz\/random/);
    await expect(page.getByText('랜덤 학습').first()).toBeVisible({ timeout: 5000 });
  });

  test('카드 학습 클릭 시 /quiz/card로 이동', async ({ page }) => {
    await loginAndGo(page, '/quiz');
    await page.getByText('카드 학습').click();
    await expect(page).toHaveURL(/\/quiz\/card/);
    await expect(page.getByText('카드 학습').first()).toBeVisible({ timeout: 5000 });
  });

  test('하단 네비 학습 탭이 /quiz에서 활성화', async ({ page }) => {
    await loginAndGo(page, '/quiz');
    const quizBtn = page.locator('nav button >> text=학습');
    await expect(quizBtn).toBeVisible();
    const btnClasses = await quizBtn.getAttribute('class');
    expect(btnClasses).toContain('text-primary');
  });

});

test.describe('6-2: BottomNav 활성 탭 (서브 라우트)', () => {

  test('/quiz/category에서 학습 탭 활성화', async ({ page }) => {
    await loginAndGo(page, '/quiz/category');
    const quizBtn = page.locator('nav button >> text=학습');
    const btnClasses = await quizBtn.getAttribute('class');
    expect(btnClasses).toContain('text-primary');
  });

  test('/quiz/random에서 학습 탭 활성화', async ({ page }) => {
    await loginAndGo(page, '/quiz/random');
    const quizBtn = page.locator('nav button >> text=학습');
    const btnClasses = await quizBtn.getAttribute('class');
    expect(btnClasses).toContain('text-primary');
  });

  test('/quiz/card에서 학습 탭 활성화', async ({ page }) => {
    await loginAndGo(page, '/quiz/card');
    const quizBtn = page.locator('nav button >> text=학습');
    const btnClasses = await quizBtn.getAttribute('class');
    expect(btnClasses).toContain('text-primary');
  });

});

test.describe('6-3: 랜덤 학습 (RandomQuiz)', () => {

  test('setup UI가 렌더링된다', async ({ page }) => {
    await loginAndGo(page, '/quiz/random');
    // 뒤로가기 버튼
    await expect(page.getByText('학습 허브')).toBeVisible({ timeout: 5000 });
    // 카테고리/시험 셀렉트
    await expect(page.getByText('카테고리', { exact: false }).first()).toBeVisible();
    // 문제 수 레이블
    await expect(page.getByText('문제 수')).toBeVisible();
    // 학습 시작 버튼
    await expect(page.getByRole('button', { name: '학습 시작' })).toBeVisible();
  });

  test('문제 수 레이블과 피커 영역이 존재한다', async ({ page }) => {
    await loginAndGo(page, '/quiz/random');
    await page.waitForTimeout(500);
    // 문제 수 레이블 확인
    await expect(page.getByText('문제 수')).toBeVisible({ timeout: 5000 });
    // 피커 또는 스켈레톤이 렌더링됨 (API 미연결 시 스켈레톤)
    const pickerOrSkeleton = page.locator('.rounded-2xl');
    await expect(pickerOrSkeleton.first()).toBeVisible();
  });

  test('뒤로가기 버튼이 학습 허브로 이동', async ({ page }) => {
    await loginAndGo(page, '/quiz/random');
    await page.getByText('학습 허브').click();
    await expect(page).toHaveURL(/\/quiz$/);
    await expect(page.getByText('학습 유형')).toBeVisible({ timeout: 5000 });
  });

});

test.describe('6-4: 카드 학습 (CardStudy)', () => {

  test('setup UI가 렌더링된다', async ({ page }) => {
    await loginAndGo(page, '/quiz/card');
    // 뒤로가기 버튼
    await expect(page.getByText('학습 허브')).toBeVisible({ timeout: 5000 });
    // 카테고리/시험 셀렉트
    const selects = page.locator('select');
    await expect(selects).toHaveCount(2);
    // 학습 시작 버튼
    await expect(page.getByRole('button', { name: '학습 시작' })).toBeVisible();
  });

  test('뒤로가기 버튼이 학습 허브로 이동', async ({ page }) => {
    await loginAndGo(page, '/quiz/card');
    await page.getByText('학습 허브').click();
    await expect(page).toHaveURL(/\/quiz$/);
    await expect(page.getByText('학습 유형')).toBeVisible({ timeout: 5000 });
  });

});
