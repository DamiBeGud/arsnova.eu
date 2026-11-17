import {
  MODERATION_ANALYSIS_CONTEXT_CONTRACT_VERSION,
  MODERATION_PROMPT_CONTEXT_MINIMAL_FIXTURE_V1,
  MODERATION_PROMPT_CONTEXT_REFERENCE_FIXTURE_V1,
  ModerationAnalysisContextV1Schema,
  type AppLocale,
  type ModerationAnalysisContextV1,
} from '@arsnova/shared-types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  QA_SUMMARY_MODERATION_PACKING_PROFILE,
  QA_SUMMARY_TECHNICAL_DEFINITION_TEXT,
  QA_SUMMARY_TECHNICAL_INSTRUCTION_TEXT,
  prepareModerationSummaryContextFromAnalysis,
  qaSummaryTechnicalHandoffTokenCounts,
  resolveQaSummaryAdapterPlan,
} from './moderationSummaryContext';
import { createExtractiveQaSummaryOutput } from './qaSummaryExtractive';

function analysisFixture(
  fixture:
    | typeof MODERATION_PROMPT_CONTEXT_REFERENCE_FIXTURE_V1
    | typeof MODERATION_PROMPT_CONTEXT_MINIMAL_FIXTURE_V1,
  locale: AppLocale = 'de',
): ModerationAnalysisContextV1 {
  const clone = structuredClone(fixture);
  return ModerationAnalysisContextV1Schema.parse({
    schemaVersion: clone.schemaVersion,
    contractVersion: MODERATION_ANALYSIS_CONTEXT_CONTRACT_VERSION,
    assembledAt: '2026-01-15T10:05:00.000Z',
    context: { ...clone.context, locale, representation: 'analysis-candidates' },
  });
}

const plan = {
  capabilities: resolveQaSummaryAdapterPlan().capabilities,
  selectedMode: 'full-context' as const,
  fallback: null,
  inferenceConfigured: true,
};

describe('moderationSummaryContext', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('bindet die exakten technischen Texte an die konservativen UTF-8-Zähler', () => {
    const counts = qaSummaryTechnicalHandoffTokenCounts();
    expect(counts).toEqual({
      instructionTokens: Buffer.byteLength(QA_SUMMARY_TECHNICAL_INSTRUCTION_TEXT, 'utf8'),
      definitionTokens: Buffer.byteLength(QA_SUMMARY_TECHNICAL_DEFINITION_TEXT, 'utf8'),
    });
    const prepared = prepareModerationSummaryContextFromAnalysis({
      analysis: analysisFixture(MODERATION_PROMPT_CONTEXT_MINIMAL_FIXTURE_V1),
      plan,
    });
    expect(prepared.request.promptContext.budget).toMatchObject(counts);
    expect(
      prepared.request.promptContext.budget.packedInputTokens +
        prepared.request.promptContext.budget.reservedOutputTokens +
        prepared.request.promptContext.budget.safetyMarginTokens,
    ).toBeLessThanOrEqual(QA_SUMMARY_MODERATION_PACKING_PROFILE.contextWindowTokens);
  });

  it('erhält drei priorisierte Referenzfragen und zusätzliche Quellen im größeren Budget', () => {
    const prepared = prepareModerationSummaryContextFromAnalysis({
      analysis: analysisFixture(MODERATION_PROMPT_CONTEXT_REFERENCE_FIXTURE_V1),
      plan,
    });
    const sources = prepared.request.promptContext.context.sources;
    expect(sources).toHaveLength(6);
    expect(sources.some((source) => source.kind === 'learning-objective')).toBe(true);
    const questions = prepared.request.promptContext.context.questions;
    expect(questions.state).toBe('available');
    if (questions.state !== 'available') throw new Error('Expected packed questions.');
    expect(questions.corpus.represented).toBe(3);
    expect(questions.items.map((question) => question.sourceId)).toEqual([
      'qa-question:11111111-1111-4111-8111-111111111111',
      'qa-question:33333333-3333-4333-8333-333333333333',
      'qa-question:55555555-5555-4555-8555-555555555555',
    ]);
    expect(prepared.request.promptContext.context.limitations).toContainEqual(
      expect.objectContaining({ code: 'budget-truncated', section: 'topics' }),
    );
    expect(prepared.request.promptContext.budget.truncations).toContainEqual(
      expect.objectContaining({ section: 'questions', omittedItems: 3, reason: 'token-budget' }),
    );
  });

  it('fällt bei weiterhin übergroßen Metadaten auf die quellengebundene Textprojektion zurück', () => {
    const analysis = analysisFixture(MODERATION_PROMPT_CONTEXT_REFERENCE_FIXTURE_V1);
    analysis.context.limitations = Array.from({ length: 80 }, (_, index) => ({
      code: 'budget-truncated' as const,
      section: 'topics' as const,
      detail: `${index}: ${'Zusätzliche Metadaten. '.repeat(10)}`,
    }));
    const prepared = prepareModerationSummaryContextFromAnalysis({ analysis, plan });
    const packed = prepared.request.promptContext;
    expect(packed.context.sources).toHaveLength(6);
    expect(packed.context.sources.every((source) => source.kind === 'qa-question')).toBe(true);
    expect(packed.context.topics.state).toBe('disabled');
    expect(
      packed.budget.packedInputTokens +
        packed.budget.reservedOutputTokens +
        packed.budget.safetyMarginTokens,
    ).toBeLessThanOrEqual(8_192);
  });

  it('verwendet für Vorschau und Auftrag dasselbe gepackte Objekt ohne technische Prompttexte', () => {
    const prepared = prepareModerationSummaryContextFromAnalysis({
      analysis: analysisFixture(MODERATION_PROMPT_CONTEXT_MINIMAL_FIXTURE_V1),
      plan,
    });
    expect(prepared.preview.promptContext).toEqual(prepared.request.promptContext);
    expect(prepared.preview).not.toHaveProperty('instructionText');
    expect(prepared.preview).not.toHaveProperty('definitionText');
  });

  it('wählt Full-context, Legacy oder extraktiv anhand expliziter Adapterkonfiguration', () => {
    vi.stubEnv('OPEN_WEIGHT_LLM_ENABLED', 'true');
    vi.stubEnv('OPEN_WEIGHT_LLM_URL', 'http://127.0.0.1:8080');
    vi.stubEnv('OPEN_WEIGHT_LLM_TOKEN', 'a'.repeat(32));
    expect(resolveQaSummaryAdapterPlan()).toMatchObject({
      selectedMode: 'full-context',
      fallback: null,
      inferenceConfigured: true,
    });

    vi.stubEnv('OPEN_WEIGHT_LLM_ENABLED', 'false');
    vi.stubEnv('OPEN_WEIGHT_LLM_URL', '');
    vi.stubEnv('OPEN_WEIGHT_LLM_TOKEN', '');
    vi.stubEnv('QA_SUMMARY_INFERENCE_URL', 'http://127.0.0.1:8787/summary');
    expect(resolveQaSummaryAdapterPlan()).toMatchObject({
      selectedMode: 'legacy-text',
      fallback: { mode: 'legacy-text', reason: 'adapter_incompatible' },
    });

    vi.stubEnv('QA_SUMMARY_INFERENCE_URL', '');
    expect(resolveQaSummaryAdapterPlan()).toMatchObject({
      selectedMode: null,
      inferenceConfigured: false,
      fallback: { mode: 'extractive', reason: 'disabled', retry: 'not-applicable' },
    });
  });

  it.each([
    ['de', '»', '«'],
    ['en', '“', '”'],
    ['fr', '« ', ' »'],
    ['es', '«', '»'],
    ['it', '«', '»'],
  ] as const)(
    'formatiert den extraktiven Beleg in %s mit lokalen Anführungszeichen',
    (locale, open, close) => {
      const prepared = prepareModerationSummaryContextFromAnalysis({
        analysis: analysisFixture(MODERATION_PROMPT_CONTEXT_MINIMAL_FIXTURE_V1, locale),
        plan,
      });
      const output = createExtractiveQaSummaryOutput(prepared.request.promptContext);
      expect(output.status).toBe('ready');
      expect(output.statements[0]?.text).toContain(open);
      expect(output.statements[0]?.text).toContain(close);
      expect(output.statements[0]?.sourceIds).toEqual([
        prepared.request.promptContext.context.sources[0]?.id,
      ]);
    },
  );
});
