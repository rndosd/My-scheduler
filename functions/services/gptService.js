// functions/services/gptService.js

// v1/v2 호환: functions.config() 또는 환경변수 사용
const { defineSecret } = require('firebase-functions/params');

// v2 시크릿 정의 (선택적)
const openaiApiKey = defineSecret('OPENAI_API_KEY');

function getApiKey() {
  // v2 환경변수 우선
  if (process.env.OPENAI_API_KEY) {
    return process.env.OPENAI_API_KEY;
  }
  
  // v1 functions.config() 호환
  try {
    const functions = require('firebase-functions');
    return functions.config().openai?.key;
  } catch {
    return null;
  }
}

// Node.js 18+에서는 fetch가 내장되어 있음
class GPTService {
  /**
   * @param {string} [apiKey]  OpenAI API 키
   * @param {string} [baseURL] API 엔드포인트
   */
  constructor(
    apiKey = getApiKey(),
    baseURL = 'https://api.openai.com/v1'
  ) {
    // 런타임에 체크하도록 변경
    this.apiKey = apiKey || getApiKey();
    if (!this.apiKey) {
      throw new Error('OPENAI API 키가 설정되지 않았습니다. functions.config().openai.key 또는 OPENAI_API_KEY 환경변수를 설정하세요.');
    }
    this.baseURL = baseURL;
    this.defaultModel = 'gpt-3.5-turbo';
  }

  /* ──────────────────────────────────────────────── */
  /* 내부 헬퍼                                         */
  /* ──────────────────────────────────────────────── */
  async _postJSON(path, payload) {
    const res = await fetch(`${this.baseURL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI ${res.status} – ${errText}`);
    }
    return res.json();
  }

  /* ──────────────────────────────────────────────── */
  /* 채팅 컴플리션                                     */
  /* ──────────────────────────────────────────────── */
  async createCompletion(messages, opts = {}) {
    const {
      model        = this.defaultModel,
      temperature  = 0.7,
      maxTokens    = 1000,
      stream       = false
    } = opts;

    return this._postJSON('/chat/completions', {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream
    });
  }

  async sendMessage(userMessage, systemPrompt = null, opts = {}) {
    const msgs = [];
    if (systemPrompt) msgs.push({ role: 'system', content: systemPrompt });
    msgs.push({ role: 'user', content: userMessage });

    return this.createCompletion(msgs, opts);
  }

  async generateText(prompt, opts = {}) {
    const res = await this.sendMessage(prompt, null, opts);
    return res.choices?.[0]?.message?.content ?? '';
  }

  /* ──────────────────────────────────────────────── */
  /* 텍스트 처리 - 메인 함수 (index.js에서 호출)        */
  /* ──────────────────────────────────────────────── */
  async processText(transcription, type = 'schedule') {
    const systemPrompts = {
      schedule: `당신은 한국어 음성을 일정 데이터로 변환하는 AI입니다.
사용자의 음성을 분석하여 다음 JSON 형식으로 반환해주세요:

{
  "processed": {
    "title": "일정 제목",
    "date": "YYYY-MM-DD",
    "time": "HH:MM",
    "location": "장소 (없으면 null)",
    "category": "업무|개인|약속|기타",
    "description": "세부 내용 (없으면 null)",
    "priority": "높음|보통|낮음"
  },
  "originalText": "원본 음성 텍스트"
}

날짜나 시간이 명시되지 않은 경우 적절히 추정해주세요.`,

      diary: `당신은 한국어 음성을 일기 데이터로 변환하는 AI입니다.
사용자의 음성을 분석하여 다음 JSON 형식으로 반환해주세요:

{
  "processed": {
    "title": "일기 제목 (자동 생성)",
    "content": "정리된 일기 내용",
    "mood": "기쁨|보통|슬픔|화남|기타",
    "tags": ["태그1", "태그2"],
    "date": "YYYY-MM-DD"
  },
  "originalText": "원본 음성 텍스트"
}`,

      memo: `당신은 한국어 음성을 메모 데이터로 변환하는 AI입니다.
사용자의 음성을 분석하여 다음 JSON 형식으로 반환해주세요:

{
  "processed": {
    "title": "메모 제목 (자동 생성)",
    "content": "정리된 메모 내용",
    "category": "아이디어|할일|쇼핑|기타",
    "tags": ["태그1", "태그2"],
    "priority": "높음|보통|낮음"
  },
  "originalText": "원본 음성 텍스트"
}`
    };

    const systemPrompt = systemPrompts[type] || systemPrompts.schedule;

    try {
      const response = await this.sendMessage(transcription, systemPrompt, {
        temperature: 0.3,
        maxTokens: 1500
      });

      const result = response.choices?.[0]?.message?.content;
      
      // JSON 파싱 시도
      try {
        const parsed = JSON.parse(result);
        return {
          ...parsed,
          originalText: transcription,
          processedAt: new Date().toISOString(),
          type
        };
      } catch (parseError) {
        // JSON 파싱 실패 시 기본 구조 반환
        return {
          processed: {
            title: type === 'schedule' ? '음성 일정' : type === 'diary' ? '음성 일기' : '음성 메모',
            content: result,
            date: new Date().toISOString().split('T')[0]
          },
          originalText: transcription,
          processedAt: new Date().toISOString(),
          type,
          note: 'GPT 응답을 JSON으로 파싱할 수 없어 기본 형식으로 저장됨'
        };
      }
    } catch (error) {
      console.error('GPT processing error:', error);
      throw new Error(`텍스트 처리 실패: ${error.message}`);
    }
  }

  /* ──────────────────────────────────────────────── */
  /* 스트리밍 응답 (Server‑Sent Events)                */
  /* ──────────────────────────────────────────────── */
  async streamCompletion(messages, opts = {}, onChunk) {
    const payload = {
      model:       opts.model || this.defaultModel,
      messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens:  opts.maxTokens  ?? 1000,
      stream:      true
    };

    const res = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI stream ${res.status} – ${err}`);
    }

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let   buffer  = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const raw of lines) {
        const line = raw.trim();
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();

        if (data === '[DONE]') return;
        try {
          const json = JSON.parse(data);
          const content = json.choices?.[0]?.delta?.content;
          if (content && onChunk) onChunk(content);
        } catch {/* ignore malformed JSON */}
      }
    }
  }

  /* ──────────────────────────────────────────────── */
  /* 유틸                                             */
  /* ──────────────────────────────────────────────── */
  async getModels() {
    const res = await fetch(`${this.baseURL}/models`, {
      headers: { Authorization: `Bearer ${this.apiKey}` }
    });
    if (!res.ok) throw new Error(`OpenAI models ${res.status}`);
    return res.json();
  }

  setModel(model) { this.defaultModel = model; }
  setApiKey(key)  { this.apiKey = key; }

  /* 헬스체크 */
  async healthCheck() {
    try {
      await this.getModels();
      return true;
    } catch {
      return false;
    }
  }
}

// 지연 초기화 - 실제 사용할 때 생성
let gptServiceInstance = null;

function getGPTService() {
  if (!gptServiceInstance) {
    gptServiceInstance = new GPTService();
  }
  return gptServiceInstance;
}

// CommonJS exports
module.exports = {
  GPTService,
  processText: (transcription, type) => getGPTService().processText(transcription, type),
  healthCheck: () => getGPTService().healthCheck(),
  generateText: (prompt, opts) => getGPTService().generateText(prompt, opts),
  sendMessage: (message, systemPrompt, opts) => getGPTService().sendMessage(message, systemPrompt, opts)
};