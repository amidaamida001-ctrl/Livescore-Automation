'use strict';

function makePredictionKey(fixtureId, modelVersion) {
  if (fixtureId == null || !modelVersion) throw new Error('fixtureId and modelVersion are required.');
  return `${String(fixtureId)}|${modelVersion}`;
}

function decidePrediction(existingRows, fixtureId, modelVersion) {
  const key = makePredictionKey(fixtureId, modelVersion);
  const matches = (existingRows || []).filter((row) =>
    row.prediction_key === key ||
    (String(row.fixture_id) === String(fixtureId) && row.model_version === modelVersion),
  );
  if (matches.length > 1) return { action: 'reconcile', reason: 'duplicate_log_rows', key };
  if (matches.length === 0) return { action: 'create_pending', reason: 'new_prediction', key };
  const row = matches[0];
  if (row.status === 'sent') return { action: 'skip', reason: 'already_sent', key };
  if (row.status === 'pending') return { action: 'reconcile', reason: 'pending_requires_manual_review', key };
  if (row.status === 'failed') return { action: 'reconcile', reason: 'failed_requires_manual_review', key };
  return { action: 'reconcile', reason: `unknown_status:${row.status}`, key };
}

function createPendingPrediction(prediction, predictedAt = new Date().toISOString()) {
  return {
    ...prediction,
    prediction_key: makePredictionKey(prediction.fixture_id, prediction.model_version),
    status: 'pending',
    predicted_at: predictedAt,
    attempt_count: 0,
    last_attempt_at: null,
    sent_at: null,
    telegram_message_id: null,
    error_message: null,
  };
}

function markSent(row, sentAt, messageId) {
  if (row.status !== 'pending') throw new Error('Only pending predictions can transition to sent.');
  return { ...row, status: 'sent', attempt_count: row.attempt_count + 1, last_attempt_at: sentAt, sent_at: sentAt, telegram_message_id: messageId == null ? null : String(messageId), error_message: null };
}

function markFailed(row, attemptedAt, safeError) {
  if (row.status !== 'pending') throw new Error('Only pending predictions can transition to failed.');
  return { ...row, status: 'failed', attempt_count: row.attempt_count + 1, last_attempt_at: attemptedAt, error_message: String(safeError || 'telegram_send_failed').slice(0, 500) };
}

function keepPendingForReconciliation(row, attemptedAt, safeError) {
  if (row.status !== 'pending') throw new Error('Only pending predictions can be reconciled.');
  return { ...row, attempt_count: row.attempt_count + 1, last_attempt_at: attemptedAt, error_message: String(safeError || 'delivery_outcome_ambiguous').slice(0, 500) };
}

module.exports = {
  makePredictionKey,
  decidePrediction,
  createPendingPrediction,
  markSent,
  markFailed,
  keepPendingForReconciliation,
};
