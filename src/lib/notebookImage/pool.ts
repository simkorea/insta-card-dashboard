/**
 * 이미지 생성을 몇 개씩 나눠 돌리기 위한 도구.
 *
 * 왜 필요한가: 9장을 Promise.all로 한꺼번에 던졌더니 Gemini 쪽에서 서로 밀려
 * 호출마다 120초 제한에 걸렸고, 재시도까지 겹쳐 라우트가 300초를 넘겨 죽었다.
 * (실제 로그: "Task timed out after 300 seconds")
 * 동시에 도는 개수를 줄이면 한 장당 시간이 짧아져 오히려 전체가 빨리 끝난다.
 */

/** 동시에 limit개까지만 돌린다. 결과 순서는 입력 순서를 유지한다. */
export async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let cursor = 0;

  const worker = async () => {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await fn(items[i], i);
    }
  };

  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker)
  );
  return out;
}

/**
 * 남은 시간을 재는 예산.
 * 라우트가 죽어서 통째로 실패하는 것보다, 시간이 다하면 그때까지 만든 것을
 * 돌려주고 나머지는 기본 스타일로 남기는 편이 낫다.
 */
export function budget(ms: number) {
  const deadline = Date.now() + ms;
  return {
    left: () => deadline - Date.now(),
    /** 한 장을 더 시작할 만큼 시간이 남았는지 */
    canStart: (needMs = 60_000) => deadline - Date.now() > needMs,
  };
}
