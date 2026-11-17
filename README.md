# Claude Pets · tikinson-pet

Мод для Claude Code: персонаж **Tikinson** (автор — Andrey / [Andryuha40](https://github.com/Andryuha40), из коллекции [codexpets](https://github.com/Andryuha40/codexpets)) живёт в панели рядом с чатом и показывает, чем занят Claude:

| Что делает Claude | Анимация Тикинсона |
| --- | --- |
| начал ход, думает | рука у подбородка |
| вызывает инструмент | бежит, подпись — имя инструмента |
| ждёт ответа (AskUserQuestion, план) | разводит руками |
| закончил ход | большой палец вверх, через 6 с — отдых |
| прерван / ошибка | расстроен |

Команда `/tikinson` снова открывает панель. Анимация рисуется в приложении Claude Desktop; в терминале показывается только текст состояния.

## Установка

В терминальной сессии Claude Code:

```
/plugin install tikinson-pet --marketplace Andryuha40/claude-pets
```

Ответьте `y` на вопрос о добавлении маркетплейса, затем выберите область (user — для всех сессий).

Из командной строки:

```bash
claude plugin install tikinson-pet --marketplace Andryuha40/claude-pets
```

В приложении Claude Desktop, где `/plugin` не работает: нажмите **+** рядом с полем ввода → **Plugins** → **Add marketplace** с `Andryuha40/claude-pets` → **Add plugin**.

## Лицензия

Tikinson, его изображения и анимации — © Andrey (Andryuha40), только личное некоммерческое использование, без изменения графики. Полный текст — в [LICENSE.md](LICENSE.md). Кадры взяты из атласа codexpets без изменения рисунка (нарезаны в полосы и сжаты в WebP).
