import type { Recommendation, RootCause, SignalCollection } from './signals.js';

export interface ReportMetadata {
  teamName: string;
  generatedAt: string;
  periodDays: number;
  sourcesQueried: string[];
  sourcesMissing: string[];
}

export interface ManagerReport {
  type: 'manager';
  metadata: ReportMetadata;
  summary: string;
  signals: SignalCollection;
  rootCauses: RootCause[];
  recommendations: Recommendation[];
  velocitySection: string;
  loadSection: string;
  risksSection: string;
}

export interface EmployeeDigestItem {
  category: 'workload' | 'blocker' | 'action';
  description: string;
}

export interface EmployeeDigest {
  type: 'employee';
  metadata: ReportMetadata;
  engineerName: string;
  summary: string;
  currentWorkload: EmployeeDigestItem[];
  blockers: EmployeeDigestItem[];
  suggestedActions: EmployeeDigestItem[];
  rootCauses: RootCause[];
}

export type DeliveryConfidence = 'high' | 'medium' | 'low';

export interface ExecutiveReport {
  type: 'executive';
  metadata: ReportMetadata;
  summary: string;
  velocityTrend: string;
  deliveryConfidence: DeliveryConfidence;
  engineeringRisk: string;
  rootCauses: RootCause[];
  recommendations: Recommendation[];
  doraSummary?: string;
}

export type Report = ManagerReport | EmployeeDigest | ExecutiveReport;

export interface ReportInput {
  metadata: ReportMetadata;
  signals: SignalCollection;
  rootCauses: RootCause[];
  recommendations: Recommendation[];
}

export type DeliveryChannel = 'slack' | 'email' | 'terminal';

export interface SlackDeliveryConfig {
  webhookUrl?: string;
  channel: string;
}

export interface EmailDeliveryConfig {
  to: string[];
  from: string;
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
}

export interface DeliveryConfig {
  slack?: SlackDeliveryConfig;
  email?: EmailDeliveryConfig;
}

export interface DeliveryPayload {
  subject: string;
  body: string;
  markdown?: string;
}

export interface DeliveryResult {
  channel: DeliveryChannel;
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface DeliveryRequest {
  report: Report;
  payload: DeliveryPayload;
  channel: DeliveryChannel;
}
