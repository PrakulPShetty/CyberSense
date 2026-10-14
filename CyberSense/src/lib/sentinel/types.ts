/** SENTINEL-X domain contracts. Engines, persistence, API, and UI share these types. */

export const ASSESSMENT_STATUSES = [
  "CREATED",
  "AUTHORIZED",
  "RUNNING",
  "COLLECTING",
  "NORMALIZING",
  "ANALYZING",
  "GRAPH_READY",
  "RISK_READY",
  "COMPLETED",
  "PARTIAL",
  "FAILED",
  "CANCELLED",
] as const;
export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];

export const PIPELINE_STAGES = [
  "authorization",
  "source_planning",
  "collection",
  "normalization",
  "asset_resolution",
  "evidence",
  "relationships",
  "exposure_twin",
  "attack_graph",
  "attack_paths",
  "risk",
  "uncertainty",
  "momentum",
  "ready",
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const ASSET_TYPES = [
  "organization",
  "domain",
  "subdomain",
  "ip",
  "service",
  "application",
  "api",
  "authentication_endpoint",
  "repository",
  "cloud_resource",
  "technology",
  "identity_surface",
  "development_environment",
  "staging_environment",
  "production_environment",
  "data_asset",
  "certificate",
  "third_party_dependency",
] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export const CRITICALITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type Criticality = (typeof CRITICALITIES)[number];

export const RISK_BANDS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type RiskBand = (typeof RISK_BANDS)[number];

export const FRESHNESS_STATES = ["FRESH", "AGING", "STALE", "EXPIRED"] as const;
export type FreshnessState = (typeof FRESHNESS_STATES)[number];

export const VERIFICATION_STATES = [
  "UNVERIFIED",
  "NEEDS_REVIEW",
  "VERIFIED",
  "REJECTED",
] as const;
export type VerificationState = (typeof VERIFICATION_STATES)[number];

export const RECOMMENDATION_CLASSES = ["REMEDIATE", "VERIFY", "MONITOR"] as const;
export type RecommendationClass = (typeof RECOMMENDATION_CLASSES)[number];

export const SOURCE_RUN_STATUSES = [
  "PENDING",
  "RUNNING",
  "COMPLETED",
  "PARTIAL",
  "FAILED",
  "UNAVAILABLE",
] as const;
export type SourceRunStatus = (typeof SOURCE_RUN_STATUSES)[number];

export const RELATIONSHIP_TYPES = [
  "OWNS",
  "HOSTS",
  "USES",
  "ASSOCIATED_WITH",
  "DEPENDS_ON",
  "AUTHENTICATES",
  "EXPOSES",
  "RESOLVES_TO",
  "DEPLOYED_ON",
  "REFERENCES",
  "POTENTIALLY_AFFECTS",
  "CONNECTS_TO",
] as const;
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

export const GRAPH_NODE_TYPES = [
  "INTERNET",
  "ASSET",
  "IDENTITY",
  "AUTHENTICATION",
  "SERVICE",
  "APPLICATION",
  "DATA_ASSET",
  "SECURITY_CONTROL",
  "CONDITION",
] as const;
export type GraphNodeType = (typeof GRAPH_NODE_TYPES)[number];

export const CONTROL_IDS = [
  "MFA",
  "CREDENTIAL_ROTATION",
  "REMOVE_PUBLIC_EXPOSURE",
  "RESTRICT_EXTERNAL_ACCESS",
  "NETWORK_SEGMENTATION",
  "DISABLE_UNNECESSARY_SERVICE",
  "REMOVE_PUBLIC_REPOSITORY",
  "IMPROVE_ACCESS_CONTROL",
  "WAF",
  "PRIVILEGED_ACCESS_CONTROL",
] as const;
export type ControlId = (typeof CONTROL_IDS)[number];

export const DRIFT_EVENT_TYPES = [
  "NEW_ASSET",
  "REMOVED_ASSET",
  "NEW_EXPOSURE",
  "RESOLVED_EXPOSURE",
  "NEW_RELATIONSHIP",
  "REMOVED_RELATIONSHIP",
  "NEW_ATTACK_PATH",
  "REMOVED_ATTACK_PATH",
  "RISK_INCREASE",
  "RISK_REDUCTION",
  "CRITICALITY_CHANGE",
  "EVIDENCE_CONFIDENCE_CHANGE",
] as const;
export type DriftEventType = (typeof DRIFT_EVENT_TYPES)[number];

export const CLAIM_KINDS = ["OBSERVED", "MODELED", "INFERRED", "UNKNOWN"] as const;
export type ClaimKind = (typeof CLAIM_KINDS)[number];

export type AssessmentMode = "DEMO" | "LIVE";

export interface Organization {
  id: string;
  name: string;
  canonicalDomain: string;
  sector: string;
}

export interface KnownInventoryItem {
  canonicalId: string;
  displayName: string;
  assetType: AssetType;
  criticality: Criticality;
}

export interface AuthorizationRecord {
  id: string;
  assessmentId: string;
  target: string;
  authorizedBy: string;
  authorizationType: "OWNER" | "WRITTEN" | "HACKATHON" | "SYNTHETIC_DEMO";
  scope: {
    domains: string[];
    modules: string[];
    passiveOnly: boolean;
  };
  startTime: string;
  endTime: string | null;
  allowedModules: string[];
  restrictions: string[];
  confirmationText: string;
  status: "GRANTED" | "DENIED" | "EXPIRED";
}

export interface SourceRun {
  id: string;
  assessmentId: string;
  sourceName: string;
  sourceType: string;
  status: SourceRunStatus;
  startedAt: string;
  completedAt: string | null;
  errorClass: string | null;
  errorMessage: string | null;
  observationCount: number;
  notes: string | null;
}

export interface RawObservation {
  id: string;
  sourceName: string;
  sourceType: string;
  observationType: string;
  observedAt: string;
  target: string;
  rawReference: string;
  value: string;
  metadata: Record<string, string | number | boolean | null>;
  sourceReliability: number;
  confidence: number;
}

export interface Asset {
  id: string;
  assessmentId: string;
  canonicalId: string;
  displayName: string;
  type: AssetType;
  status: "ACTIVE" | "HISTORICAL" | "UNKNOWN";
  criticality: Criticality;
  exposureState: "PUBLIC" | "INTERNAL" | "UNKNOWN";
  ownershipState: "KNOWN" | "POTENTIAL_SHADOW" | "UNKNOWN";
  confidence: number;
  firstSeen: string;
  lastSeen: string;
  sourceCount: number;
  tags: string[];
  metadata: Record<string, string | number | boolean | null>;
}

export interface Observation {
  id: string;
  assessmentId: string;
  assetId: string | null;
  observationType: string;
  sourceId: string;
  timestamp: string;
  rawReference: string;
  normalizedValue: string;
  confidence: number;
  verificationStatus: VerificationState;
  freshness: FreshnessState;
  sourceReliability: number;
  notes: string | null;
}

export interface EvidenceRecord {
  id: string;
  assessmentId: string;
  observationId: string;
  assetIds: string[];
  relationshipIds: string[];
  pathIds: string[];
  source: string;
  sourceType: string;
  observationTimestamp: string;
  ingestionTimestamp: string;
  sourceReliability: number;
  evidenceConfidence: number;
  freshness: FreshnessState;
  corroborationCount: number;
  verificationState: VerificationState;
  provenance: string;
  rawObservationReference: string;
  normalized: Record<string, string>;
  kind: ClaimKind;
  stale: boolean;
}

export interface Relationship {
  id: string;
  assessmentId: string;
  sourceAssetId: string;
  targetAssetId: string;
  type: RelationshipType;
  confidence: number;
  evidenceIds: string[];
  firstSeen: string;
  lastSeen: string;
  status: "ACTIVE" | "HISTORICAL";
  kind: ClaimKind;
  difficulty: number;
  assumptions: string[];
  controlDependencies: ControlId[];
}

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  assetId: string | null;
  label: string;
  criticality: Criticality | null;
  exposureState: Asset["exposureState"] | "EXTERNAL";
  confidence: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: RelationshipType | "REACHES";
  relationshipId: string | null;
  confidence: number;
  difficulty: number;
  evidenceIds: string[];
  prerequisites: string[];
  controlDependencies: ControlId[];
  blocked: boolean;
  kind: ClaimKind;
  assumptions: string[];
}

export interface AttackGraph {
  id: string;
  assessmentId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  generatedAt: string;
}

export interface AttackPath {
  id: string;
  assessmentId: string;
  displayId: string;
  entryPoint: string;
  destination: string;
  destinationAssetId: string;
  nodeIds: string[];
  edgeIds: string[];
  labels: string[];
  confidence: number;
  risk: number;
  impact: number;
  uncertainty: number;
  assumptions: string[];
  evidenceIds: string[];
  controlDependencies: ControlId[];
  kind: ClaimKind;
  recommendationClass: RecommendationClass;
  crownJewel: boolean;
  summary: string;
}

export interface RiskFactor {
  id: string;
  name: string;
  points: number;
  max: number;
  rationale: string;
}

export interface PathRiskBreakdown {
  pathId: string;
  score: number;
  band: RiskBand;
  factors: RiskFactor[];
}

export interface RiskAssessment {
  id: string;
  assessmentId: string;
  overallScore: number;
  band: RiskBand;
  confidence: number;
  uncertainty: number;
  evidenceQuality: number;
  /**
   * True when no modeled path exists, so there is nothing to score. The UI must
   * show "insufficient evidence" rather than a reassuring low number: absence of
   * observed exposure is not evidence of a low risk.
   */
  insufficientEvidence: boolean;
  factors: RiskFactor[];
  pathBreakdowns: PathRiskBreakdown[];
  criticalPathCount: number;
  highPathCount: number;
  crownJewelReachability: number;
  generatedAt: string;
}

export interface UncertaintyContribution {
  subjectId: string;
  subjectType: "NODE" | "EDGE" | "RELATIONSHIP" | "EVIDENCE" | "ASSUMPTION";
  share: number;
  reason: string;
}

export interface UncertaintyReport {
  assessmentId: string;
  overall: number;
  pathContributions: Record<string, UncertaintyContribution[]>;
  missingEvidence: string[];
  staleEvidenceIds: string[];
  conflicting: string[];
}

export interface EvidenceGap {
  id: string;
  assessmentId: string;
  pathIds: string[];
  relationshipId: string | null;
  currentConfidence: number;
  potentialImprovement: number;
  affectedRisk: number;
  priority: Criticality;
  recommendedVerification: string;
  candidateSources: string[];
}

export interface VerificationTask {
  id: string;
  assessmentId: string;
  title: string;
  recommendationClass: RecommendationClass;
  status: VerificationState;
  evidenceIds: string[];
  pathIds: string[];
  notes: string | null;
}

export interface ShadowAsset {
  assetId: string;
  reason: string;
  rankScore: number;
  requiresVerification: boolean;
}

export interface DriftEvent {
  id: string;
  type: DriftEventType;
  summary: string;
  details: string;
  subjectIds: string[];
  previousValue: string | null;
  currentValue: string | null;
}

export interface DriftReport {
  previousAssessmentId: string;
  currentAssessmentId: string;
  events: DriftEvent[];
  causalExplanation: string;
  previousRisk: number;
  currentRisk: number;
}

export interface MomentumComponent {
  id: string;
  name: string;
  delta: number;
  weight: number;
  contribution: number;
}

export interface ExposureMomentum {
  /** SENTINEL-X project metric, not an industry standard. Positive = more dangerous. */
  score: number;
  direction: "DETERIORATING" | "STABLE" | "IMPROVING";
  components: MomentumComponent[];
  asOf: string;
  previousAssessmentId: string | null;
  label: "SENTINEL-X Exposure Momentum";
}

export interface StageLogEntry {
  stage: PipelineStage;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "SKIPPED";
  startedAt: string | null;
  completedAt: string | null;
  detail: string | null;
}

export interface ControlDef {
  id: ControlId;
  name: string;
  description: string;
  category: string;
  applicableAssetTypes: AssetType[];
  estimatedCost: number;
  implementationDifficulty: "LOW" | "MEDIUM" | "HIGH";
  reductionDimensions: string[];
}

export interface Survivability {
  totalPathsBefore: number;
  totalPathsAfter: number;
  criticalBefore: number;
  criticalAfter: number;
  highBefore: number;
  highAfter: number;
  crownJewelReachabilityBefore: number;
  crownJewelReachabilityAfter: number;
  residualRisk: number;
  residualBand: RiskBand;
  removedPathIds: string[];
  survivingPathIds: string[];
}

export interface SimulationResult {
  id: string;
  assessmentId: string;
  name: string;
  controlIds: ControlId[];
  survivability: Survivability;
  beforeRisk: number;
  afterRisk: number;
  afterBand: RiskBand;
  afterPaths: AttackPath[];
  afterGraph: AttackGraph;
  afterRiskAssessment: RiskAssessment;
  changedEdgeIds: string[];
  createdAt: string;
}

export interface DefenseStrategyItem {
  controlId: ControlId;
  reason: string;
}

export interface DefenseStrategy {
  id: string;
  name: string;
  items: DefenseStrategyItem[];
  totalCost: number;
  controlCount: number;
  criticalPathsRemoved: number;
  criticalPathSurvival: number;
  residualRisk: number;
  riskReduction: number;
  costPerRisk: number;
  defenseEfficiency: number;
  recommendationConfidence: number;
  whySelected: string;
  whyRejected: string | null;
}

export interface OptimizationResult {
  id: string;
  assessmentId: string;
  constraints: OptimizationConstraints;
  strategies: DefenseStrategy[];
  selectedStrategyId: string | null;
  createdAt: string;
}

export interface OptimizationConstraints {
  budget: number | null;
  maxControls: number;
  required: ControlId[];
  excluded: ControlId[];
  minimumRiskReduction: number | null;
}

export interface TwinSnapshot {
  id: string;
  assessmentId: string;
  timestamp: string;
  organization: Organization;
  target: string;
  mode: AssessmentMode;
  status: AssessmentStatus;
  authorization: AuthorizationRecord | null;
  sourceRuns: SourceRun[];
  assets: Asset[];
  observations: Observation[];
  evidence: EvidenceRecord[];
  relationships: Relationship[];
  graph: AttackGraph;
  paths: AttackPath[];
  risk: RiskAssessment;
  uncertainty: UncertaintyReport;
  evidenceGaps: EvidenceGap[];
  verificationTasks: VerificationTask[];
  shadowAssets: ShadowAsset[];
  knownInventory: KnownInventoryItem[];
  momentum: ExposureMomentum | null;
  drift: DriftReport | null;
  stageLog: StageLogEntry[];
}

export interface AssessmentSummary {
  id: string;
  organizationName: string;
  target: string;
  mode: AssessmentMode;
  status: AssessmentStatus;
  currentStage: string;
  overallScore: number | null;
  band: RiskBand | null;
  confidence: number | null;
  criticalPaths: number | null;
  assetCount: number | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface AIClaim {
  text: string;
  evidenceIds: string[];
  pathIds: string[];
  kind: ClaimKind;
}

export interface AIExplanation {
  summary: string;
  severity: RiskBand;
  confidence: number;
  claims: AIClaim[];
  uncertainties: { description: string; evidenceGapIds: string[] }[];
  recommendations: {
    controlId: ControlId | null;
    reason: string;
    simulationId: string | null;
  }[];
  insufficientEvidence: boolean;
}

export interface ReportContent {
  title: string;
  generatedAt: string;
  assessmentId: string;
  mode: AssessmentMode;
  executiveSummary: string;
  posture: { score: number; band: RiskBand; confidence: number };
  /**
   * False when no modeled path existed, i.e. `posture.score` is a landscape
   * floor rather than a scored posture. Optional so reports persisted before
   * this field existed still render.
   */
  postureIsScored?: boolean;
  sections: { heading: string; body: string; references: string[] }[];
  languageDisclaimer: string;
}

export interface ApiErrorShape {
  error_code: string;
  message: string;
  request_id: string;
  details: Record<string, string>;
}
