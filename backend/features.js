// Feature flags — управляются через Render environment variables.
//
// Форматы значения переменной FEATURE_<FLAG>:
//   "true"  — включено для всех пользователей
//   "false" — выключено для всех (или переменная не задана)
//   "10"    — включено для ~10% пользователей (по userId % 100)
//
// Пример добавления новой гипотезы:
//   1. Обернуть код за флагом: if (features.isEnabled('NEW_STATS', userId)) { ... }
//   2. На staging: FEATURE_NEW_STATS=true
//   3. В прод первые дни: FEATURE_NEW_STATS=10  (10% пользователей)
//   4. Если ок: FEATURE_NEW_STATS=true
//   5. Если не ок: убрать переменную или FEATURE_NEW_STATS=false

function isEnabled(flag, userId) {
    const val = process.env[`FEATURE_${flag}`];
    if (!val || val === 'false') return false;
    if (val === 'true') return true;
    const pct = parseInt(val, 10);
    if (isNaN(pct)) return false;
    return (Number(userId) % 100) < pct;
}

// Возвращает объект { FLAG_NAME: true/false } для данного userId.
// Используется в /api/features — фронт получает актуальный список флагов.
function getFeatures(userId) {
    const result = {};
    for (const [key, val] of Object.entries(process.env)) {
        if (!key.startsWith('FEATURE_')) continue;
        const flag = key.slice('FEATURE_'.length);
        result[flag] = isEnabled(flag, userId);
    }
    return result;
}

module.exports = { isEnabled, getFeatures };
