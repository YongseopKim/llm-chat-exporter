/**
 * Content Script
 * Background Script의 메시지를 받아 대화 내용을 추출
 * Phase 2: 더미 데이터 반환
 */

interface ExportMessage {
  type: 'EXPORT_CONVERSATION';
}

interface ExportResponse {
  success: boolean;
  data?: string;
  error?: string;
}

/**
 * 메시지 리스너 등록
 */
chrome.runtime.onMessage.addListener(
  (
    message: ExportMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: ExportResponse) => void
  ) => {
    if (message.type === 'EXPORT_CONVERSATION') {
      console.log('LLM Chat Exporter: Export request received');

      // Phase 2: 더미 데이터 반환
      // Phase 3/4에서 실제 파싱 로직으로 교체 예정
      const dummyMessages = [
        { role: 'user', content: 'Hello, this is a test message.', timestamp: new Date().toISOString() },
        { role: 'assistant', content: 'Hi! This is a dummy response from LLM Chat Exporter. The extension is working correctly!', timestamp: new Date().toISOString() },
      ];

      const jsonl = dummyMessages.map((msg) => JSON.stringify(msg)).join('\n');

      sendResponse({ success: true, data: jsonl });
    }

    // 비동기 응답을 위해 true 반환
    return true;
  }
);

console.log('LLM Chat Exporter content script loaded on:', window.location.hostname);
