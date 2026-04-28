// Fisher-Yates 셔플 알고리즘 — 배열을 무작위로 섞어주는 유틸
// 원본 배열을 변경하지 않고 새 배열을 반환합니다
export default function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
