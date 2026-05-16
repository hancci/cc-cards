import type { SessionCard, Source } from "./types";

// Deterministic placeholders for screenshot/demo mode.
// Keeps card visuals realistic without exposing real project/branch/prompt content.

const PROJECT_NAMES = [
  "acme-web",
  "blog-engine",
  "data-pipeline",
  "cli-tools",
  "api-gateway",
  "docs-site",
  "auth-svc",
  "design-tokens",
  "notes-app",
  "search-index",
];

const BRANCHES = [
  "main",
  "feat/cards-rework",
  "fix/timing-edge",
  "chore/cleanup",
  "feat/streaming",
  "fix/race-bug",
  "main",
  "feat/sse",
];

const PROMPTS = [
  "이 컴포넌트 좀 더 깔끔하게 리팩토링해줘",
  "테스트 코드 추가하고 싶어",
  "에러 메시지가 이상해, 분석 부탁",
  "디자인 톤을 통일하고 싶어",
  "API 응답 형식 정리해줘",
  "이 부분 성능이 느린 것 같아",
  "타입 정의가 너무 느슨해서 다듬자",
  "리드미 다시 작성해보자",
  "캐시 전략을 어떻게 가져갈까",
  "스트리밍 응답 처리 추가해줘",
];

const FOLLOWUPS = [
  "방금 수정한 거 빌드 한 번 돌려봐",
  "이 라인 수가 너무 많은데 분리해보자",
  "조금 더 명시적으로 바꿀 수 있을까",
  "테스트 한 번 더 돌리고 결과 알려줘",
  "로그 메시지 다듬자",
  "이 부분 주석 한 줄 추가",
];

function hash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function pick<T>(arr: T[], seed: string): T {
  return arr[hash(seed) % arr.length];
}

function maskSource(s: Source): Source {
  return s.kind === "local" ? s : { kind: "ccs", instance: "demo" };
}

export function maskCard(c: SessionCard): SessionCard {
  const id = c.id;
  const projectName = pick(PROJECT_NAMES, id);
  const projectPath = `/Users/demo/projects/${projectName}`;
  return {
    ...c,
    projectName,
    projectPath,
    projectPathFromDir: projectPath,
    gitBranch: c.gitBranch ? pick(BRANCHES, id + ":b") : undefined,
    firstPrompt: c.firstPrompt ? pick(PROMPTS, id + ":f") : undefined,
    lastPrompt: c.lastPrompt ? pick(FOLLOWUPS, id + ":l") : undefined,
    summary: c.summary ? pick(PROMPTS, id + ":s") : undefined,
    customTitle: c.customTitle ? `demo-${(hash(id) % 99) + 1}` : undefined,
    jsonlPath: `/Users/demo/.claude/projects/${projectName}/${id}.jsonl`,
    source: maskSource(c.source),
  };
}

export function isDemoFlag(v: string | string[] | undefined): boolean {
  if (Array.isArray(v)) return v[0] === "1";
  return v === "1";
}
