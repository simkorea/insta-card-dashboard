// 영상 하단 자막(캡션) 조판.
//
// 쇼츠·릴스는 세로 화면에서 소리 없이 먼저 읽힌다. 그래서 자막이
//   (1) 화면 폭의 8% 안팎으로 크고,
//   (2) 카드 본문과 겹치지 않는 자기 자리를 갖고,
//   (3) 숫자·금액은 노란색으로 한 번 더 걸리게
// 보여야 한다. 여기서는 그 조판만 계산한다 — 그리는 쪽은 /video-generator.
//
// 글자를 캔버스에 직접 그리므로 블록 렌더러와 달리 DOM 측정에 기대지 않는다.
// 폭은 글자 하나씩 재서 한국어답게 글자 단위로 끊는다(어절을 넘겨도 괜찮다 —
// 기존 drawSubtitle 도 그렇게 했다). 다만 한 글자 때문에 줄이 비지 않도록
// 문장부호는 앞줄에 붙인다.

export type CaptionRun = { text: string; hl: boolean };

export type CaptionLine = {
  runs: { text: string; hl: boolean; x: number }[];
  width: number;
};

export type CaptionSegment = {
  lines: CaptionLine[];
  from: number;   // 슬라이드 유지 시간 중 이 대목을 보여줄 구간 (0~1)
  to: number;
};

export type CaptionPlan = {
  size: number;
  lineHeight: number;
  segments: CaptionSegment[];
};

/** 강조해서 노랗게 칠할 것 — 숫자·금액·비율, 그리고 카드에서 이미 강조한 낱말. */
const HIGHLIGHT_RE =
  /\d[\d,.]*\s*(?:억|만원|만|천|백|%|년|개월|주|평|세대|가구|원|대|층|㎡|m²|개)?|최고|최저|마감|완판|분양가|역세권|즉시입주|선착순/g;

/** 글자마다 강조 여부를 표시한다. */
function highlightFlags(text: string): boolean[] {
  const flags = new Array<boolean>(text.length).fill(false);
  HIGHLIGHT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = HIGHLIGHT_RE.exec(text)) !== null) {
    if (!m[0]) { HIGHLIGHT_RE.lastIndex++; continue; }
    for (let i = m.index; i < m.index + m[0].length; i++) flags[i] = true;
  }
  return flags;
}

/** 미리보기(DOM)에서도 같은 규칙으로 색을 준다. */
export function captionRuns(text: string): CaptionRun[] {
  const flags = highlightFlags(text);
  const out: CaptionRun[] = [];
  for (let i = 0; i < text.length; i++) {
    const last = out[out.length - 1];
    if (last && last.hl === flags[i]) last.text += text[i];
    else out.push({ text: text[i], hl: flags[i] });
  }
  return out;
}

const NO_LINE_START = '.,!?·)]}…%';

type FontSpec = { weight: string; family: string };

function setFont(ctx: CanvasRenderingContext2D, size: number, f: FontSpec) {
  ctx.font = `${f.weight} ${size}px ${f.family}`;
}

/** 한 크기에서 문장을 줄로 나눈다. */
function layoutAt(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  size: number,
  font: FontSpec,
): CaptionLine[] {
  setFont(ctx, size, font);
  const flags = highlightFlags(text);
  const lines: CaptionLine[] = [];
  let runs: CaptionLine['runs'] = [];
  let x = 0;

  const flush = () => {
    if (runs.length === 0) return;
    lines.push({ runs, width: x });
    runs = [];
    x = 0;
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\n') { flush(); continue; }
    const w = ctx.measureText(ch).width;
    if (x + w > maxW && runs.length > 0) {
      // 문장부호가 줄 첫머리로 떨어지면 읽기 나쁘다 — 앞줄 끝에 붙여 둔다.
      if (NO_LINE_START.includes(ch)) {
        const prev = runs[runs.length - 1];
        prev.text += ch;
        x += w;
        flush();
        continue;
      }
      flush();
    }
    const hl = flags[i];
    const last = runs[runs.length - 1];
    if (last && last.hl === hl) last.text += ch;
    else runs.push({ text: ch, hl, x });
    x += w;
  }
  flush();
  return lines;
}

const SHRINK = [1, 0.94, 0.88, 0.82, 0.76, 0.7];

/** 어절 경계를 지키며 문장을 여러 토막으로 나눈다(너무 길 때 순서대로 넘긴다). */
function chunkText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let cur = '';
  for (const w of words) {
    if (!cur) { cur = w; continue; }
    if (cur.length + 1 + w.length > maxChars) { chunks.push(cur); cur = w; }
    else cur += ` ${w}`;
  }
  if (cur) chunks.push(cur);
  return chunks;
}

/**
 * 자막 하나를 화면에 그릴 계획으로 바꾼다.
 * 기본 크기로 정해진 줄 수 안에 들어가면 그대로, 안 들어가면 조금씩 줄이고,
 * 그래도 안 되면 문장을 토막 내 순서대로 보여준다(쇼츠 자막처럼 바뀐다).
 */
export function planCaption(
  ctx: CanvasRenderingContext2D,
  text: string,
  opts: { maxWidth: number; baseSize: number; maxLines: number; weight?: string; family?: string },
): CaptionPlan {
  const font: FontSpec = {
    weight: opts.weight ?? '800',
    family: opts.family ?? '"Noto Sans KR", "Apple SD Gothic Neo", sans-serif',
  };
  const t = (text || '').replace(/\s+/g, ' ').trim();
  const lineHeightOf = (s: number) => Math.round(s * 1.3);

  if (!t) return { size: opts.baseSize, lineHeight: lineHeightOf(opts.baseSize), segments: [] };

  for (const f of SHRINK) {
    const size = Math.round(opts.baseSize * f);
    const lines = layoutAt(ctx, t, opts.maxWidth, size, font);
    if (lines.length <= opts.maxLines) {
      return { size, lineHeight: lineHeightOf(size), segments: [{ lines, from: 0, to: 1 }] };
    }
  }

  const size = Math.round(opts.baseSize * SHRINK[SHRINK.length - 1]);
  setFont(ctx, size, font);
  const perLine = Math.max(6, Math.floor(opts.maxWidth / size));
  const chunks = chunkText(t, perLine * opts.maxLines - 2);
  const segments: CaptionSegment[] = chunks.map((c, i) => ({
    lines: layoutAt(ctx, c, opts.maxWidth, size, font),
    from: i / chunks.length,
    to: (i + 1) / chunks.length,
  }));
  return { size, lineHeight: lineHeightOf(size), segments };
}

/** 슬라이드 하단에 까는 어두운 그라데이션. 자막이 사진 위에서도 읽히게 한다. */
export function drawCaptionBand(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  bandTop: number,
) {
  const start = Math.max(0, bandTop - height * 0.04);
  const g = ctx.createLinearGradient(0, start, 0, height);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.3, 'rgba(0,0,0,0.45)');
  g.addColorStop(0.62, 'rgba(0,0,0,0.78)');
  g.addColorStop(1, 'rgba(0,0,0,0.92)');
  ctx.fillStyle = g;
  ctx.fillRect(0, start, width, height - start);
}

/**
 * 자막을 그린다. progress(0~1)로 지금 보여줄 토막을 고른다.
 * bottomY 는 마지막 줄의 아랫변 — 화면 밖으로 나가지 않게 여기서부터 위로 쌓는다.
 */
export function drawCaption(
  ctx: CanvasRenderingContext2D,
  plan: CaptionPlan,
  opts: { centerX: number; bottomY: number; progress: number; color?: string; accent?: string },
) {
  if (!plan.segments.length) return;
  const p = Math.min(0.999, Math.max(0, opts.progress));
  const seg =
    plan.segments.find(s => p >= s.from && p < s.to) || plan.segments[plan.segments.length - 1];

  const lineH = plan.lineHeight;
  const blockH = seg.lines.length * lineH;
  let y = opts.bottomY - blockH;

  const family = '"Noto Sans KR", "Apple SD Gothic Neo", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = `800 ${plan.size}px ${family}`;
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = plan.size * 0.35;
  ctx.shadowOffsetY = plan.size * 0.06;

  for (const line of seg.lines) {
    const x0 = opts.centerX - line.width / 2;
    for (const run of line.runs) {
      ctx.fillStyle = run.hl ? (opts.accent ?? '#FFD54A') : (opts.color ?? '#FFFFFF');
      ctx.fillText(run.text, x0 + run.x, y);
    }
    y += lineH;
  }

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}
