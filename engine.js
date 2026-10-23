export class AnalysisError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
export const messages = {
  NOT_CONFIGURED: 'AI 분석 엔진이 아직 연결되지 않았습니다. 입력 내용은 유지되며 기록은 생성되지 않습니다.',
  INVALID_FILE: '내용을 확인할 수 있는 MP4 파일을 선택해 주세요.',
  INVALID_INPUT: '날짜와 온라인 송출담당자를 입력해 주세요.',
  BUSY: '이미 처리 중입니다. 잠시 기다려 주세요.',
  TIMEOUT: '응답을 기다리는 시간이 초과되었습니다. 처리 여부 확인이 필요하며 자동으로 재요청하지 않습니다.',
  INVALID_RESPONSE: '분석 결과 형식이 올바르지 않아 기록을 확정하지 않았습니다.',
  NETWORK: '분석 연결에 실패했습니다. 입력 내용은 유지됩니다. 서버 처리 여부를 확인한 후 다시 시도해 주세요.'
};
export function validate(input) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date || '') || !input.operator?.trim()) throw new AnalysisError('INVALID_INPUT');
  if (!input.file || !/\.mp4$/i.test(input.file.name) || input.file.size <= 0) throw new AnalysisError('INVALID_FILE');
}
// Future adapter must provide analyze(input, {signal, requestId}).
// The server must enforce idempotency and verify actual media contents.
export function createEngine(adapter = null, timeoutMs = 120000) {
  let busy = false;
  return {
    async analyze(input, requestId) {
      if (busy) throw new AnalysisError('BUSY');
      validate(input);
      if (!adapter) throw new AnalysisError('NOT_CONFIGURED');
      busy = true;
      const controller = new AbortController();
      let timer;
      try {
        const result = await Promise.race([
          adapter.analyze(input, {signal: controller.signal, requestId}),
          new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new AnalysisError('TIMEOUT')); }, timeoutMs); })
        ]);
        if (!result || typeof result.summary !== 'string' || !result.summary.trim() || !Array.isArray(result.findings)) throw new AnalysisError('INVALID_RESPONSE');
        return result;
      } catch (error) {
        throw error instanceof AnalysisError ? error : new AnalysisError('NETWORK');
      } finally { clearTimeout(timer); busy = false; }
    }
  };
}
