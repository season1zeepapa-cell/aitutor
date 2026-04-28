// 마크다운 → HTML 변환 유틸리티
// AI 해설 저장 시 마크다운 텍스트를 HTML로 변환

export default function mdToHtml(md) {
  if (!md) return '';

  // 줄 단위로 분리
  const lines = md.split('\n');
  const result = [];
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // heading: ### → h4, ## → h3
    if (/^### (.+)$/.test(line)) {
      if (inList) { result.push('</ul>'); inList = false; }
      line = `<h4>${line.replace(/^### /, '')}</h4>`;
      result.push(line);
      continue;
    }
    if (/^## (.+)$/.test(line)) {
      if (inList) { result.push('</ul>'); inList = false; }
      line = `<h3>${line.replace(/^## /, '')}</h3>`;
      result.push(line);
      continue;
    }

    // 리스트 아이템: - 로 시작
    if (/^[-*] (.+)$/.test(line)) {
      if (!inList) { result.push('<ul>'); inList = true; }
      const content = line.replace(/^[-*] /, '');
      result.push(`<li>${inlineFormat(content)}</li>`);
      continue;
    }

    // 리스트가 아닌 줄이면 리스트 닫기
    if (inList) { result.push('</ul>'); inList = false; }

    // 빈 줄
    if (line.trim() === '') {
      result.push('');
      continue;
    }

    // 일반 텍스트
    result.push(inlineFormat(line));
  }

  if (inList) result.push('</ul>');

  // 빈 줄 기준으로 단락 분리 (<p> 래핑)
  const html = groupParagraphs(result);
  return html;
}

// 인라인 포맷: **bold**, *italic*, `code`
function inlineFormat(text) {
  // code (backtick) — 먼저 처리
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  // bold
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // italic
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return text;
}

// 빈 줄 기준으로 단락 그룹화
function groupParagraphs(lines) {
  const blocks = [];
  let current = [];

  for (const line of lines) {
    if (line === '') {
      if (current.length > 0) {
        blocks.push(current);
        current = [];
      }
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) blocks.push(current);

  return blocks.map(block => {
    const joined = block.join('\n');
    // 이미 HTML 블록 태그로 시작하면 래핑하지 않음
    if (/^<(h[1-6]|ul|ol|li|div|table|blockquote)/.test(joined)) {
      return joined;
    }
    // 여러 줄이면 <br>로 연결
    return `<p>${block.join('<br>')}</p>`;
  }).join('\n');
}
