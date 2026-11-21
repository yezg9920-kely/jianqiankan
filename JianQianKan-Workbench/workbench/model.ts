export const fields = {
  length: '整体长度',
  fringe: '刘海',
  parting: '分线',
  sides: '两侧',
  crown: '顶部',
  texture: '纹理',
  color: '发色',
  care: '日常打理',
} as const;
export type Field = keyof typeof fields;

export interface Preferences {
  currentLength: '不确定' | '短发' | '齐肩' | '长发';
  targetLength: '保持长度' | '中长发' | '短发';
  fringe: '都可以' | '保留刘海' | '露额';
  styling: boolean;
  dye: boolean;
  direction: '中性发型' | '男生发型' | '女生发型';
  goal: string;
}
export const defaults: Preferences = {
  currentLength: '不确定', targetLength: '保持长度', fringe: '都可以', styling: false, dye: false, direction: '中性发型', goal: '',
};

export interface Finding {
  label: string;
  value: string;
  detail: string;
}

export interface Analysis {
  source: 'vision' | 'portable' | 'history';
  status: 'ready' | 'retake';
  advice: string;
  findings: Finding[];
  at?: string;
  photoHash?: string;
  vertical?: 'longer' | 'balanced' | 'wider';
  jaw?: 'tapered' | 'soft' | 'unknown';
}

export interface Photo {
  id: string;
  view: string;
  url: string;
  thumb: string;
}

export interface Plan {
  id: string;
  code: string;
  name: string;
  round: string;
  category: string;
  description: string;
  fullSpec: string;
  spec: Partial<Record<Field, string>>;
  conditions: string[];
  source: 'history' | 'rules' | 'revision';
  image?: Photo;
  imageSource?: 'generated' | 'imported';
  cutId?: string;
  at?: string;
  parentId?: string;
  revision?: number;
  recommended?: boolean;
  change?: { field: Field; before: string; after: string };
}

export interface Round {
  id: string;
  label: string;
  count: number;
  at?: string;
}

export interface Report {
  id: string;
  round: string;
  title: string;
  url: string;
}
export interface ImageTask {
  id: string;
  planId: string;
  createdAt: string;
  state: 'waiting' | 'attached';
}
export interface CaseSummary {
  id: string;
  title: string;
  date: string;
  count: number;
  photo?: Photo;
}

export interface Activity {
  id: string;
  kind: 'analysis' | 'round' | 'revision' | 'selection' | 'image';
  title: string;
  detail: string;
  at: string;
  planId?: string;
  roundId?: string;
  photo?: Photo;
}
export interface Consultation extends CaseSummary {
  preferences: Preferences;
  originals: Photo[];
  analysis?: Analysis;
  historyAnalysis?: Analysis;
  reports: Report[];
  tasks: ImageTask[];
  workflows: WorkflowRun[];
  baseline?: Photo;
  rounds: Round[];
  activeRound: string | null;
  plans: Plan[];
  activity: Activity[];
  selected: string | null;
  remaining: number;
  notes: string[];
}

export const workflowKinds = {
  cut: {name:'发型设计', detail:'比较剪裁、长度和刘海轮廓'},
  look: {name:'发型＋发色', detail:'试戴不同剪裁与发色组合'},
  color: {name:'同款发色', detail:'保留剪裁，只比较颜色'},
  texture: {name:'同款卷度', detail:'保留剪裁，只比较发束弧度'},
} as const;
export const workflowMoods = {
  natural: '顺势自然', clean: '利落硬朗', soft: '柔和层次',
  french: '法式松弛', retro: '复古线条', bold: '个性变化',
} as const;
export type WorkflowKind = keyof typeof workflowKinds;
export type WorkflowMood = keyof typeof workflowMoods;
export type WorkflowStage = 'queued'|'checking'|'planning'|'making'|'ready'|'partial'|'failed'|'retake'|'stopped'|'interrupted';
export type SlotStage = 'queued'|'making'|'attached'|'failed'|'stopped';
export interface WorkflowSlot {
  id:string;
  role:'baseline'|'look';
  name:string;
  planId?:string;
  status:SlotStage;
  message?:string;
  picture?:Photo;
}
export interface WorkflowRun {
  id:string;
  kind:WorkflowKind;
  mood:WorkflowMood;
  purpose:'new'|'more'|'revision'|'single';
  createdAt:string;
  stage:WorkflowStage;
  slots:WorkflowSlot[];
  preferences:Preferences;
  analysis?:Analysis;
  baseline?:Photo;
  round?:string;
  message?:string;
  reportUrl:string;
}
export const activeWorkflow = (stage:WorkflowStage) => ['queued','checking','planning','making'].includes(stage);

