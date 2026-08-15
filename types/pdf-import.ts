export type PdfDocType = 'PL1' | 'DHSX' | 'OTHER';
export type PdfReviewStatus = 'AUTO_OK' | 'NEED_REVIEW' | 'CONFLICT' | 'UNMAPPED' | 'VERIFIED' | 'SKIP';

export type PdfExtractedPage = {
  page: number;
  text: string;
  lines: string[];
};

export type PdfExtractedDocument = {
  name: string;
  size: number;
  fingerprint: string;
  docType?: PdfDocType;
  pages: PdfExtractedPage[];
};

export type PdfFieldConflict = {
  field: keyof PdfNumericValues;
  left?: number;
  right?: number;
  sourceLeft?: string;
  sourceRight?: string;
};

export type PdfNumericValues = {
  actualMonth?: number;
  planMonth?: number;
  actualYtd?: number;
  planYtd?: number;
  planYear?: number;
  samePeriodMonth?: number;
  samePeriodYtd?: number;
};

export type PdfImportRecord = {
  rowId: string;
  period: string;
  docType: PdfDocType;
  kpiId?: string;
  domainId?: string;
  label: string;
  unit?: string;
  sourceLabel?: string;
  values: PdfNumericValues;
  statusText?: string;
  confidence: number;
  sourceFile: string;
  sourcePage: number;
  sourceExcerpt: string;
  reviewStatus: PdfReviewStatus;
  issues: string[];
  conflicts?: PdfFieldConflict[];
  rememberAlias?: boolean;
  reviewNote?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  updatedAt?: string;
};

export type PdfPeriodSummary = {
  total: number;
  pass: number;
  partial: number;
  fail: number;
  detected: boolean;
};

export type PdfParseResult = {
  ok: boolean;
  importId: string;
  period: string;
  documents: Array<{ name: string; fingerprint: string; docType: PdfDocType; pages: number }>;
  records: PdfImportRecord[];
  summary: PdfPeriodSummary;
  stats: {
    total: number;
    autoOk: number;
    needReview: number;
    conflict: number;
    unmapped: number;
  };
  notes: string[];
};

export type PdfImportListItem = {
  importId: string;
  period: string;
  files: string;
  status: string;
  total: number;
  autoOk: number;
  needReview: number;
  conflict: number;
  unmapped: number;
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
};


export type PdfApprovedHistoryItem = {
  period: string;
  kpiId: string;
  label: string;
  unit: string;
  values: PdfNumericValues;
  status: string;
  tone: string;
  valueStatus: string;
  sourceFile?: string;
  sourcePage?: number;
};

export type PdfStagingSyncResult = {
  ok: boolean;
  importId: string;
  period: string;
  records: PdfImportRecord[];
  summary?: PdfPeriodSummary;
  sheetUrl?: string;
  updatedAt?: string;
};
