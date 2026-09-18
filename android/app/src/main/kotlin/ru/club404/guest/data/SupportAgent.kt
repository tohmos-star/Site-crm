package ru.club404.guest.data

/**
 * Офлайн-заглушка вместо реального вызова LLM. В полной версии бэкенда
 * (backend/src/lib/llm) это один вызов LLMClient.complete(system, messages)
 * с сюда собранным system-промптом; здесь — простой поиск по ключевым словам,
 * чтобы приложение работало без сети и без API-ключа. Конвенция ESCALATE:
 * та же — если вопрос не покрыт контекстом гостя и FAQ, эскалируем.
 */
object SupportAgent {

    fun buildSystemPrompt(context: GuestSupportContext, faq: List<FaqEntry>): String {
        val faqText = faq.joinToString("\n\n") { "Q: ${it.question}\nA: ${it.answer}" }
        return buildString {
            appendLine("Ты — ассистент техподдержки компьютерного клуба 404 Киберхаус.")
            appendLine("Отвечай ТОЛЬКО на основе данных гостя и базы знаний ниже. Никогда не")
            appendLine("выдумывай факты, тарифы или коды. Если вопрос выходит за пределы этих")
            appendLine("данных — ответь строго одной строкой, начинающейся с \"ESCALATE:\".")
            appendLine()
            appendLine("Данные гостя: $context")
            appendLine()
            appendLine("База знаний (FAQ):")
            append(faqText)
        }
    }

    fun reply(context: GuestSupportContext, faq: List<FaqEntry>, message: String): String {
        val m = message.lowercase()

        if (Regex("тариф|сколько стоит|цена").containsMatchIn(m)) {
            return "Ваш текущий тариф: ${context.tariffLabel}."
        }
        if (m.contains("бонус")) {
            return "На вашем счету ${context.bonusPoints} бонусных баллов."
        }
        if (Regex("баланс|деньги на счету|сколько денег").containsMatchIn(m)) {
            return "Баланс: ${context.balanceRub} ₽."
        }
        if (Regex("код|дверь|зайти|вход в клуб|открой").containsMatchIn(m)) {
            return when (val d = context.doorCode) {
                is DoorCodeInfo.Available -> "Код от двери: ${d.code}. Действует до конца оплаченной сессии."
                is DoorCodeInfo.Unavailable -> {
                    val next = context.nextBooking
                    val hint = if (next != null) {
                        "Ближайшая бронь: ${next.stationLabel}, ${formatDateTime(next.startAt)}."
                    } else {
                        "Забронируйте место, чтобы получить код."
                    }
                    "Код от двери выдаётся только во время активной сессии — сейчас: ${d.reason}. $hint"
                }
            }
        }
        if (Regex("сесси|брон").containsMatchIn(m) && !Regex("забронировать|как забронир").containsMatchIn(m)) {
            val active = context.activeSession
            val next = context.nextBooking
            return when {
                active != null -> "У вас активна сессия на месте «${active.stationLabel}» до ${formatDateTime(active.endsAt)}."
                next != null -> "Активной сессии нет. Ближайшая бронь: «${next.stationLabel}», ${formatDateTime(next.startAt)}."
                else -> "Активной сессии и броней не найдено."
            }
        }

        val faqHit = faq.firstOrNull { entry ->
            entry.question.lowercase().split(Regex("\\s+")).filter { it.length > 3 }.any { m.contains(it) }
        }
        if (faqHit != null) return faqHit.answer

        return "ESCALATE: вопрос не покрыт данными гостя и базой знаний (\"$message\")"
    }
}
