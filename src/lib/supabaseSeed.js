import { getSupabaseClient, getSupabaseTableName } from './supabase.js';
import { seedDB, withDemoData } from './seed.js';

function normalizePayload(row) {
  return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined));
}

async function upsertRows(table, rows) {
  const client = getSupabaseClient();
  if (!client) return { ok: false, reason: 'not_configured' };
  if (!rows.length) return { ok: true, inserted: 0, table };
  const payload = rows.map(normalizePayload);
  const { error } = await client.from(table).upsert(payload, { onConflict: 'id' });
  if (error) throw error;
  return { ok: true, inserted: payload.length, table };
}

async function safeUpsertRows(results, table, rows) {
  try {
    results.push(await upsertRows(table, rows));
  } catch (error) {
    results.push({ ok: false, reason: error?.message || 'upsert_failed', table });
  }
}

export async function seedSupabaseFromAppData() {
  const base = withDemoData(seedDB());
  const client = getSupabaseClient();
  if (!client) return { ok: false, reason: 'not_configured' };

  const table = getSupabaseTableName();
  try {
    await client.from(table).upsert({ key: 'seed:app', value: base, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  } catch (error) {
    return { ok: false, reason: error?.message || 'app_state_write_failed' };
  }

  const results = [];
  const usersRows = base.users.map((u) => ({
    id: u.id,
    role: u.role,
    full_name: u.fullName,
    email: u.email,
    password: u.password,
    phone: u.phone || null,
    status: u.status,
    email_verified_at: u.emailVerifiedAt || null,
    created_at: u.createdAt || null,
    updated_at: u.createdAt || null,
    demo: Boolean(u.demo),
    metadata: {
      fullName: u.fullName,
      profile: u.profile || null,
    },
  }));

  await safeUpsertRows(results, 'users', usersRows);

  const profilesRows = base.users
    .filter((u) => u.role === 'PSYCHOLOGIST' && u.profile)
    .map((u) => ({
      user_id: u.id,
      education: u.profile.education || null,
      specializations: u.profile.specializations || [],
      experience_years: u.profile.experienceYears || 0,
      about: u.profile.about || null,
      verification_status: u.profile.verificationStatus || 'PENDING',
      verified_at: u.profile.verifiedAt || null,
      submitted_at: u.profile.submittedAt || null,
      rejection_reason: u.profile.rejectionReason || null,
      admin_comment: u.profile.adminComment || null,
      created_at: u.createdAt || null,
      updated_at: u.createdAt || null,
    }));
  await safeUpsertRows(results, 'psychologist_profiles', profilesRows);

  const testsRows = base.tests.map((t) => ({
    id: t.id,
    author_id: t.authorId,
    title: t.title,
    description: t.description || null,
    category: t.category || null,
    instruction: t.instruction || null,
    minutes: t.minutes || 5,
    disclaimer: t.disclaimer || null,
    status: t.status,
    created_at: t.createdAt || null,
    published_at: t.publishedAt || null,
    hidden_reason: t.hiddenReason || null,
    demo: Boolean(t.demo),
    metadata: {
      ranges: t.ranges || [],
      questions: t.questions || [],
    },
  }));
  await safeUpsertRows(results, 'tests', testsRows);

  const questionRows = [];
  const optionRows = [];
  const rangeRows = [];
  base.tests.forEach((test) => {
    (test.questions || []).forEach((q, index) => {
      questionRows.push({
        id: q.id,
        test_id: test.id,
        position: index,
        text: q.text,
        created_at: test.createdAt || null,
      });
      (q.options || []).forEach((opt, optionIndex) => {
        optionRows.push({
          id: opt.id,
          question_id: q.id,
          position: optionIndex,
          text: opt.text,
          score: opt.score || 0,
          created_at: test.createdAt || null,
        });
      });
    });
    (test.ranges || []).forEach((range, index) => {
      rangeRows.push({
        id: range.id,
        test_id: test.id,
        position: index,
        min_score: range.min || 0,
        max_score: range.max || 0,
        title: range.title,
        text: range.text || null,
        recommendation: range.rec || null,
        created_at: test.createdAt || null,
      });
    });
  });
  await safeUpsertRows(results, 'questions', questionRows);
  await safeUpsertRows(results, 'question_options', optionRows);
  await safeUpsertRows(results, 'test_ranges', rangeRows);

  const attemptRows = base.attempts.map((attempt) => ({
    id: attempt.id,
    student_id: attempt.studentId,
    psychologist_id: attempt.psychologistId || null,
    test_id: attempt.testId,
    status: attempt.status,
    total_score: attempt.totalScore || null,
    range_id: attempt.rangeId || null,
    started_at: attempt.startedAt || null,
    completed_at: attempt.completedAt || null,
    shared: Boolean(attempt.shared),
    shared_at: attempt.sharedAt || null,
    review_status: attempt.reviewStatus || null,
    reviewed_at: attempt.reviewedAt || null,
    note: attempt.note || '',
    demo: Boolean(attempt.demo),
    created_at: attempt.startedAt || null,
    updated_at: attempt.completedAt || attempt.startedAt || null,
  }));
  await safeUpsertRows(results, 'attempts', attemptRows);

  const answerRows = [];
  base.attempts.forEach((attempt) => {
    (attempt.answers || []).forEach((ans) => {
      answerRows.push({
        id: `${attempt.id}-${ans.questionId}`,
        attempt_id: attempt.id,
        question_id: ans.questionId,
        question_text: ans.questionText || '',
        option_id: ans.optionId || null,
        option_text: ans.optionText || null,
        score: ans.score || 0,
        created_at: attempt.startedAt || null,
      });
    });
  });
  await safeUpsertRows(results, 'attempt_answers', answerRows);

  const eventRows = (base.events || []).map((ev) => ({
    id: ev.id,
    name: ev.name,
    occurred_at: ev.at || null,
    user_id: ev.userId || null,
    test_id: ev.testId || null,
    attempt_id: ev.attemptId || null,
    demo: Boolean(ev.demo),
    metadata: {
      original: ev,
    },
  }));
  await safeUpsertRows(results, 'events', eventRows);

  const failedResults = results.filter((item) => item && item.ok === false);
  if (failedResults.length) {
    return { ok: false, reason: 'some_tables_unavailable', results };
  }
  return { ok: true, results };
}
