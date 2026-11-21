export type View = 'front' | 'left' | 'right' | 'back';
export type Mode = 'demo' | 'manual-import' | 'codex-lab' | 'api';
export type Operation = 'complete-look' | 'structure' | 'texture' | 'color' | 'view' | 'imagined-view' | 'category-sheet';
export type PromptCategory = 'style-common' | 'style-bold' | 'color-common' | 'color-bold';
export interface CategorySpec { version: '5.0.0'; id: PromptCategory; presetIds: string[]; base: 'real-front'; background: 'cream' }
export type Status = 'draft' | 'waiting_for_operator' | 'running' | 'needs_review' | 'approved' | 'rejected' | 'blocked_missing_input' | 'blocked_tool_unavailable' | 'failed' | 'cancelled';
export interface Consent { portraitAuthorized: boolean; cloudProcessingApproved: boolean; publicDemoApproved: boolean }
export interface Preferences {
  length: '保持长度' | '短发' | '中长发' | '长发';
  perm: boolean; dye: boolean; bleach: boolean;
  budget: string; minutes: string; keep: string; avoid: string;
  hairTexture: string; density: string; history: string;
  currentLength?: '不确定' | '短发' | '齐肩' | '长发';
  presentation?: '不限风格' | '男生方向' | '女生方向' | '中性方向';
  fringe?: '都可以' | '保留刘海' | '露额';
  tieUp?: boolean; growOut?: boolean; styling?: boolean;
  goal?: '自然整理' | '明显变化' | '多看一些';
}
export interface CompleteLook {
  version: '4.0'; family: string; cutId: string; color: string; colorHex: string;
  reason: string; requiresDye: boolean; requiresBleach: boolean; requiresPerm: boolean;
  requiresGrowOut: boolean; requiresStyling: boolean;
}
export interface StyleSpec {
  id: string; name: string; direction: string; length: string; fringe: string;
  parting: string; sides: string; crown: string; texture: string; ears: string;
  nape: string; maintenance: string; services: string[]; unknowns: string[];
  source: 'rules' | 'human'; target?: string; view?: View; parentTaskId?: string;
  look?: CompleteLook;
  category?: CategorySpec;
}
export interface Asset {
  id: string; caseId: string; kind: 'original' | 'normalized' | 'generated';
  view: View; isRealPhoto: boolean; sha256: string; width: number; height: number;
  mime: string; bytes: number; path: string; createdAt: string;
  normalization?: { sourceAssetId: string; rotation: number; crop: 'full' | 'portrait' };
}
export interface Reference {
  assetId: string; role: 'edit-base' | 'identity-reference' | 'hairstyle-reference' | 'approved-parent';
  view: View | 'unknown'; isRealPhoto: boolean; sha256: string | null;
}
export interface Review {
  status: 'unreviewed' | 'approved' | 'rejected';
  reviewerType: 'none' | 'human' | 'assisted-human';
  identity: number | null; instruction: number | null; realism: number | null; comparison: number | null;
  hardFailures: string[]; feasibility: 'unreviewed' | 'needs_more_info' | 'stylist_confirmed'; notes: string;
}
export interface Job {
  schemaVersion: '1.0'; taskId: string; caseId: string; mode: Mode; operation: Operation;
  promptVersion: string; compiledPrompt: string; references: Reference[]; parameters: StyleSpec;
  status: Status; attempt: number; consent: Consent;
  execution: { toolName: string | null; modelId: string | null; startedAt: string | null; finishedAt: string | null; usage: Record<string, unknown> | null; costUSD: number | null };
  resultAssetIds: string[]; review: Review;
}
export interface HairCase {
  id: string; name: string; createdAt: string; updatedAt: string;
  consent: Consent; preferences: Preferences; photos: Partial<Record<View, string>>;
  assets: Asset[]; jobs: Job[]; selectedJobId: string | null; favoriteJobIds: string[];
  workflowVersion?: '4.0' | '5.0'; planningNotes?: string[]; selectionNotes?: string;
}
export interface ResultManifest {
  version: '1.0'; caseId: string; taskId: string; operation: Operation; mode: Mode;
  referenceHashes: string[]; outputSha256: string;
}
export const VIEW_NAMES: Record<View, string> = { front: '正面', left: '左侧', right: '右侧', back: '背面' };
export const STATUS_NAMES: Record<Status, string> = {
  draft: '草稿', waiting_for_operator: '等待制作', running: '正在制作预览',
  needs_review: '等待本人审核', approved: '视觉审核通过', rejected: '需要重做',
  blocked_missing_input: '缺少必要照片', blocked_tool_unavailable: '当前工具不可用',
  failed: '执行失败', cancelled: '已取消',
};
